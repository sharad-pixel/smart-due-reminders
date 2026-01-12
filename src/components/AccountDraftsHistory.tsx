import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { 
  Mail, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Bot,
  Search,
  Filter,
  FileText,
  Building2,
  CheckCircle,
  Clock,
  Send,
  XCircle,
  Sparkles
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DraftItem {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  debtor_id: string;
  company_name: string;
  subject: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  recommended_send_date: string | null;
  days_past_due: number | null;
  step_number: number;
  channel: string;
  persona_key: string;
  source_type: 'invoice_workflow' | 'account_level';
}

interface AccountDraftsHistoryProps {
  debtorId?: string;
}

const PAGE_SIZE = 15;

const getPersonaFromDpd = (dpd: number | null): string => {
  if (!dpd) return 'james';
  if (dpd <= 30) return 'sam';
  if (dpd <= 60) return 'james';
  if (dpd <= 90) return 'katy';
  if (dpd <= 120) return 'troy';
  if (dpd <= 150) return 'jimmy';
  return 'rocco';
};

export function AccountDraftsHistory({ debtorId }: AccountDraftsHistoryProps) {
  const navigate = useNavigate();
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const fetchDrafts = async () => {
    if (accountLoading || !effectiveAccountId) return;
    setLoading(true);
    
    try {
      // Fetch invoice-level drafts
      const invoiceDraftsQuery = supabase
        .from('ai_drafts')
        .select(`
          id,
          invoice_id,
          subject,
          status,
          created_at,
          sent_at,
          recommended_send_date,
          days_past_due,
          step_number,
          channel,
          applied_brand_snapshot,
          invoices(
            id,
            invoice_number,
            debtor_id,
            debtors(id, company_name, account_outreach_enabled)
          )
        `)
        .eq('user_id', effectiveAccountId)
        .not('invoice_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      // Fetch account-level drafts (invoice_id is null)
      const accountDraftsQuery = supabase
        .from('ai_drafts')
        .select(`
          id,
          invoice_id,
          subject,
          status,
          created_at,
          sent_at,
          recommended_send_date,
          days_past_due,
          step_number,
          channel,
          applied_brand_snapshot
        `)
        .eq('user_id', effectiveAccountId)
        .is('invoice_id', null)
        .order('created_at', { ascending: false })
        .limit(100);

      const [invoiceResult, accountResult] = await Promise.all([
        invoiceDraftsQuery,
        accountDraftsQuery
      ]);

      if (invoiceResult.error) throw invoiceResult.error;
      if (accountResult.error) throw accountResult.error;

      // Process invoice-level drafts
      const invoiceDraftItems: DraftItem[] = (invoiceResult.data || [])
        .filter((d: any) => d.invoices)
        .map((draft: any) => {
          const invoice = draft.invoices;
          const debtor = invoice?.debtors;
          const personaKey = getPersonaFromDpd(draft.days_past_due);

          return {
            id: draft.id,
            invoice_id: invoice?.id,
            invoice_number: invoice?.invoice_number,
            debtor_id: debtor?.id,
            company_name: debtor?.company_name || 'Unknown',
            subject: draft.subject,
            status: draft.status,
            created_at: draft.created_at,
            sent_at: draft.sent_at,
            recommended_send_date: draft.recommended_send_date,
            days_past_due: draft.days_past_due,
            step_number: draft.step_number,
            channel: draft.channel,
            persona_key: personaKey,
            source_type: 'invoice_workflow' as const,
          };
        });

      // Process account-level drafts (get debtor info from applied_brand_snapshot or metadata)
      const accountDraftItems: DraftItem[] = (accountResult.data || []).map((draft: any) => {
        const snapshot = draft.applied_brand_snapshot || {};
        const personaKey = getPersonaFromDpd(draft.days_past_due);

        return {
          id: draft.id,
          invoice_id: null,
          invoice_number: null,
          debtor_id: snapshot.debtor_id || null,
          company_name: snapshot.debtor_name || snapshot.company_name || 'Account Summary',
          subject: draft.subject,
          status: draft.status,
          created_at: draft.created_at,
          sent_at: draft.sent_at,
          recommended_send_date: draft.recommended_send_date,
          days_past_due: draft.days_past_due,
          step_number: draft.step_number,
          channel: draft.channel,
          persona_key: personaKey,
          source_type: 'account_level' as const,
        };
      });

      // Combine and sort by created_at
      let allDrafts = [...invoiceDraftItems, ...accountDraftItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Filter by debtor if specified
      if (debtorId) {
        allDrafts = allDrafts.filter(d => d.debtor_id === debtorId);
      }

      setDrafts(allDrafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [effectiveAccountId, accountLoading, debtorId]);

  // Apply filters
  const filteredDrafts = useMemo(() => {
    let result = [...drafts];

    // Search filter
    if (searchFilter) {
      const query = searchFilter.toLowerCase();
      result = result.filter(item =>
        item.company_name.toLowerCase().includes(query) ||
        item.invoice_number?.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'sent') {
        result = result.filter(item => item.sent_at);
      } else if (statusFilter === 'pending') {
        result = result.filter(item => !item.sent_at && item.status === 'pending_approval');
      } else if (statusFilter === 'approved') {
        result = result.filter(item => !item.sent_at && item.status === 'approved');
      }
    }

    // Source type filter
    if (sourceFilter !== 'all') {
      result = result.filter(item => item.source_type === sourceFilter);
    }

    return result;
  }, [drafts, searchFilter, statusFilter, sourceFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredDrafts.length / PAGE_SIZE);
  const paginatedDrafts = filteredDrafts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getStatusBadge = (draft: DraftItem) => {
    if (draft.sent_at) {
      return (
        <Badge variant="default" className="bg-green-600 gap-1">
          <Send className="h-3 w-3" />
          Sent
        </Badge>
      );
    }
    if (draft.status === 'approved') {
      return (
        <Badge variant="default" className="bg-blue-600 gap-1">
          <CheckCircle className="h-3 w-3" />
          Approved
        </Badge>
      );
    }
    if (draft.status === 'pending_approval') {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
    if (draft.status === 'rejected') {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    }
    return <Badge variant="outline">{draft.status}</Badge>;
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
        return <Badge variant="outline">Unknown</Badge>;
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
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Drafts History
            </CardTitle>
            <CardDescription>
              All AI-generated message drafts with their status. Filter by Invoice-level or Account-level.
            </CardDescription>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search drafts..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="invoice_workflow">Invoice AI-Workflow</SelectItem>
                <SelectItem value="account_level">Account-Level AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredDrafts.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {searchFilter || statusFilter !== 'all' || sourceFilter !== 'all'
                ? "No matching drafts found."
                : "No AI drafts generated yet."}
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
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDrafts.map((draft) => {
                  const persona = personaConfig[draft.persona_key];

                  return (
                    <TableRow 
                      key={draft.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        if (draft.invoice_id) {
                          navigate(`/invoices/${draft.invoice_id}`);
                        } else if (draft.debtor_id) {
                          navigate(`/debtors/${draft.debtor_id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PersonaAvatar persona={draft.persona_key} size="sm" />
                          <div>
                            <span className="text-sm font-medium">{persona?.name || draft.persona_key}</span>
                            {draft.step_number && (
                              <p className="text-xs text-muted-foreground">Step {draft.step_number}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{draft.company_name}</p>
                          {draft.invoice_number && (
                            <p className="text-xs text-muted-foreground font-mono">{draft.invoice_number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getSourceBadge(draft.source_type)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate">{draft.subject || 'No subject'}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(draft.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(draft)}
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
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredDrafts.length)} of {filteredDrafts.length}
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
