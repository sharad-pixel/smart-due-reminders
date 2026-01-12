import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig, PersonaConfig } from "@/lib/personaConfig";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { 
  Mail, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Calendar,
  Building2,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Sparkles,
  Bot
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, addDays, isToday, isTomorrow, isPast } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ScheduledItem {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  debtor_id: string;
  company_name: string;
  amount: number;
  scheduled_date: string;
  days_past_due: number;
  aging_bucket: string;
  persona_key: string;
  source_type: 'invoice_workflow' | 'account_level' | 'ai_draft';
  status: string;
  subject?: string;
  step_number?: number;
}

interface AccountScheduledOutreachPanelProps {
  debtorId?: string;
  showAllAccounts?: boolean;
}

const PAGE_SIZE = 10;

const getPersonaForBucket = (agingBucket: string): { key: string; persona: PersonaConfig } | null => {
  const mapping: Record<string, string> = {
    'dpd_1_30': 'sam',
    'dpd_31_60': 'james',
    'dpd_61_90': 'katy',
    'dpd_91_120': 'troy',
    'dpd_121_150': 'jimmy',
    'dpd_150_plus': 'rocco'
  };
  
  const key = mapping[agingBucket];
  if (key && personaConfig[key]) {
    return { key, persona: personaConfig[key] };
  }
  return null;
};

export function AccountScheduledOutreachPanel({ debtorId, showAllAccounts = false }: AccountScheduledOutreachPanelProps) {
  const navigate = useNavigate();
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const fetchScheduledOutreach = async (showRefreshing = false) => {
    if (accountLoading || !effectiveAccountId) return;
    
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Fetch AI drafts (pending/approved) - these are the main scheduled outreach items
      let draftsQuery = supabase
        .from('ai_drafts')
        .select(`
          id,
          invoice_id,
          subject,
          status,
          recommended_send_date,
          days_past_due,
          step_number,
          channel,
          invoices(
            id,
            invoice_number,
            amount,
            aging_bucket,
            debtor_id,
            debtors(id, company_name, account_outreach_enabled)
          )
        `)
        .eq('user_id', effectiveAccountId)
        .in('status', ['pending_approval', 'approved'])
        .is('sent_at', null)
        .order('recommended_send_date', { ascending: true });

      // Filter by debtor if specified
      if (debtorId) {
        // We need to filter by debtor through the invoice relationship
        const { data: debtorInvoices } = await supabase
          .from('invoices')
          .select('id')
          .eq('debtor_id', debtorId);
        
        const invoiceIds = debtorInvoices?.map(i => i.id) || [];
        if (invoiceIds.length > 0) {
          draftsQuery = draftsQuery.in('invoice_id', invoiceIds);
        } else {
          setItems([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const { data: drafts, error: draftsError } = await draftsQuery;
      if (draftsError) throw draftsError;

      // Map drafts to scheduled items
      const scheduledItems: ScheduledItem[] = (drafts || [])
        .filter((d: any) => d.invoices)
        .map((draft: any) => {
          const invoice = draft.invoices;
          const debtor = invoice?.debtors;
          const agingBucket = invoice?.aging_bucket || 'dpd_1_30';
          const personaInfo = getPersonaForBucket(agingBucket);
          const isAccountLevel = debtor?.account_outreach_enabled === true;

          return {
            id: draft.id,
            invoice_id: invoice?.id,
            invoice_number: invoice?.invoice_number,
            debtor_id: debtor?.id,
            company_name: debtor?.company_name || 'Unknown',
            amount: invoice?.amount || 0,
            scheduled_date: draft.recommended_send_date || new Date().toISOString(),
            days_past_due: draft.days_past_due || 0,
            aging_bucket: agingBucket,
            persona_key: personaInfo?.key || 'james',
            source_type: isAccountLevel ? 'account_level' : 'invoice_workflow',
            status: draft.status,
            subject: draft.subject,
            step_number: draft.step_number,
          } as ScheduledItem;
        });

      setItems(scheduledItems);
    } catch (error) {
      console.error("Error fetching scheduled outreach:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScheduledOutreach();
  }, [effectiveAccountId, accountLoading, debtorId]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchFilter) {
      const query = searchFilter.toLowerCase();
      result = result.filter(item =>
        item.company_name.toLowerCase().includes(query) ||
        item.invoice_number?.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query)
      );
    }

    // Source type filter
    if (sourceFilter !== 'all') {
      result = result.filter(item => item.source_type === sourceFilter);
    }

    return result;
  }, [items, searchFilter, sourceFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getScheduleLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isPast(date) && !isToday(date)) {
      return { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    }
    if (isToday(date)) {
      return { label: 'Today', className: 'bg-primary/10 text-primary border-primary/20' };
    }
    if (isTomorrow(date)) {
      return { label: 'Tomorrow', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' };
    }
    return { label: format(date, "MMM d"), className: 'bg-muted text-muted-foreground' };
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'invoice_workflow':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <FileText className="h-3 w-3" />
            Invoice
          </Badge>
        );
      case 'account_level':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1">
            <Building2 className="h-3 w-3" />
            Account
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Bot className="h-3 w-3" />
            AI Draft
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduled Outreach
              </CardTitle>
              <CardDescription>
                AI-generated drafts scheduled for sending. Filter by Invoice-level or Account-level workflows.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchScheduledOutreach(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by account, invoice, or subject..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outreach Types</SelectItem>
                <SelectItem value="invoice_workflow">Invoice AI-Workflow</SelectItem>
                <SelectItem value="account_level">Account-Level AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {searchFilter || sourceFilter !== 'all' 
                ? "No matching scheduled outreach found."
                : "No scheduled outreach yet."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              AI-generated drafts will appear here when created.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Account / Invoice</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => {
                  const persona = personaConfig[item.persona_key];
                  const scheduleInfo = getScheduleLabel(item.scheduled_date);

                  return (
                    <TableRow 
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        if (item.invoice_id) {
                          navigate(`/invoices/${item.invoice_id}`);
                        } else if (item.debtor_id) {
                          navigate(`/debtors/${item.debtor_id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PersonaAvatar persona={item.persona_key} size="sm" />
                          <span className="text-sm font-medium">{persona?.name || item.persona_key}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.company_name}</p>
                          {item.invoice_number && (
                            <p className="text-xs text-muted-foreground font-mono">{item.invoice_number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getSourceBadge(item.source_type)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate">{item.subject || 'No subject'}</p>
                        {item.step_number && (
                          <p className="text-xs text-muted-foreground">Step {item.step_number}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", scheduleInfo.className)}>
                          <Clock className="h-3 w-3 mr-1" />
                          {scheduleInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'approved' ? 'default' : 'secondary'}>
                          {item.status === 'approved' ? 'Ready' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
