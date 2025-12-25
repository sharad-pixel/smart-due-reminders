import { useState, useEffect, useCallback, useMemo } from "react";
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
  User,
  Building2,
  ExternalLink,
  RefreshCw,
  Eye,
  History,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import OutreachMessagePreview from "./OutreachMessagePreview";

interface OutreachItem {
  id: string;
  invoice_id: string;
  invoice_number: string;
  debtor_id: string;
  company_name: string;
  amount: number;
  due_date: string;
  days_past_due: number;
  aging_bucket: string;
  bucket_entered_at: string;
  outreach_sequence: number;
  scheduled_date: Date;
  persona_key: string;
  is_account_level: boolean;
  account_outreach_persona?: string;
}

interface UpcomingOutreachLogProps {
  selectedPersona?: string | null;
  onPersonaFilterClear?: () => void;
}

const PAGE_SIZE = 15;

// Day offsets for workflow steps
const STEP_DAY_OFFSETS = [3, 7, 14, 21, 30];

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

type SortField = 'scheduled_date' | 'company_name' | 'amount' | 'days_past_due';
type SortDirection = 'asc' | 'desc';

const UpcomingOutreachLog = ({ selectedPersona, onPersonaFilterClear }: UpcomingOutreachLogProps) => {
  const navigate = useNavigate();
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  const [outreachItems, setOutreachItems] = useState<OutreachItem[]>([]);
  const [allOutreachItems, setAllOutreachItems] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [previewItem, setPreviewItem] = useState<OutreachItem | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historicalActivities, setHistoricalActivities] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // New filter + sort state
  const [accountFilter, setAccountFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>('scheduled_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Unique account names for dropdown
  const uniqueAccounts = useMemo(() => {
    const names = allOutreachItems.map(item => item.company_name);
    return Array.from(new Set(names)).sort();
  }, [allOutreachItems]);

  const fetchUpcomingOutreach = useCallback(async (showRefreshing = false) => {
    if (accountLoading || !effectiveAccountId) return;
    
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // First, fetch approved draft templates to know which aging buckets have approved outreach
      const { data: approvedTemplates, error: templatesError } = await supabase
        .from('draft_templates')
        .select('aging_bucket, status')
        .eq('user_id', effectiveAccountId)
        .eq('status', 'approved')
        .eq('channel', 'email');

      if (templatesError) throw templatesError;

      // Build a set of aging buckets that have at least one approved template
      const approvedBuckets = new Set<string>();
      approvedTemplates?.forEach((template: any) => {
        if (template.aging_bucket) {
          approvedBuckets.add(template.aging_bucket);
        }
      });

      // If no approved templates, show empty state
      if (approvedBuckets.size === 0) {
        setOutreachItems([]);
        setTotalCount(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch all open invoices with their debtor info using effective account ID
      const { data: invoices, error, count } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          aging_bucket,
          bucket_entered_at,
          created_at,
          status,
          debtors!inner(
            id,
            company_name,
            account_outreach_enabled,
            account_outreach_persona
          )
        `, { count: 'exact' })
        .eq('user_id', effectiveAccountId)
        .in('status', ['Open', 'InPaymentPlan'])
        .not('aging_bucket', 'is', null)
        .neq('aging_bucket', 'current')
        .neq('aging_bucket', 'paid')
        .order('due_date', { ascending: true });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate outreach schedule for each invoice
      const outreachList: OutreachItem[] = [];

      invoices?.forEach((invoice: any) => {
        // Only include if there's an approved template for this aging bucket
        if (!approvedBuckets.has(invoice.aging_bucket)) {
          return; // Skip - no approved template for this bucket
        }

        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        const bucketEnteredDate = new Date(invoice.bucket_entered_at || invoice.created_at || invoice.due_date);
        bucketEnteredDate.setHours(0, 0, 0, 0);
        const daysSinceEntered = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

        // Find current sequence and next outreach date
        let currentSequence = 1;
        let nextOutreachDayOffset = STEP_DAY_OFFSETS[0];

        for (let i = STEP_DAY_OFFSETS.length - 1; i >= 0; i--) {
          if (daysSinceEntered >= STEP_DAY_OFFSETS[i]) {
            currentSequence = i + 2;
            nextOutreachDayOffset = STEP_DAY_OFFSETS[Math.min(i + 1, STEP_DAY_OFFSETS.length - 1)];
            break;
          }
        }

        if (daysSinceEntered < STEP_DAY_OFFSETS[0]) {
          currentSequence = 1;
          nextOutreachDayOffset = STEP_DAY_OFFSETS[0];
        }

        if (currentSequence > STEP_DAY_OFFSETS.length) {
          currentSequence = STEP_DAY_OFFSETS.length;
        }

        const scheduledDate = addDays(bucketEnteredDate, nextOutreachDayOffset);

        // Get persona info
        const personaInfo = getPersonaForBucket(invoice.aging_bucket);
        
        // Check if account-level outreach
        const isAccountLevel = invoice.debtors?.account_outreach_enabled === true;
        const accountPersona = invoice.debtors?.account_outreach_persona;

        outreachList.push({
          id: `${invoice.id}-${currentSequence}`,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          debtor_id: invoice.debtors?.id,
          company_name: invoice.debtors?.company_name || 'Unknown',
          amount: invoice.amount,
          due_date: invoice.due_date,
          days_past_due: daysPastDue,
          aging_bucket: invoice.aging_bucket,
          bucket_entered_at: invoice.bucket_entered_at || invoice.created_at,
          outreach_sequence: currentSequence,
          scheduled_date: scheduledDate,
          persona_key: isAccountLevel && accountPersona ? accountPersona : (personaInfo?.key || 'james'),
          is_account_level: isAccountLevel,
          account_outreach_persona: accountPersona
        });
      });

      // Sort by scheduled date (soonest first) - initial default
      outreachList.sort((a, b) => a.scheduled_date.getTime() - b.scheduled_date.getTime());

      // Store all items before filtering
      setAllOutreachItems(outreachList);
    } catch (error) {
      console.error("Error fetching outreach schedule:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveAccountId, accountLoading]);

  // Apply filters + sorting + pagination
  useEffect(() => {
    let filtered = [...allOutreachItems];

    // Persona filter
    if (selectedPersona) {
      filtered = filtered.filter(item => item.persona_key === selectedPersona);
    }

    // Account name filter
    if (accountFilter) {
      filtered = filtered.filter(item => 
        item.company_name.toLowerCase().includes(accountFilter.toLowerCase())
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'scheduled_date':
          comparison = a.scheduled_date.getTime() - b.scheduled_date.getTime();
          break;
        case 'company_name':
          comparison = a.company_name.localeCompare(b.company_name);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'days_past_due':
          comparison = a.days_past_due - b.days_past_due;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setTotalCount(filtered.length);

    // Pagination
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const paginatedItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

    setOutreachItems(paginatedItems);
  }, [allOutreachItems, selectedPersona, accountFilter, sortField, sortDirection, currentPage]);

  useEffect(() => {
    fetchUpcomingOutreach();
  }, [fetchUpcomingOutreach]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const fetchHistoricalOutreach = useCallback(async () => {
    if (accountLoading || !effectiveAccountId) return;
    
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection_activities')
        .select(`
          id, activity_type, channel, direction, subject, message_body,
          sent_at, delivered_at, opened_at, responded_at, created_at,
          invoices!inner(id, invoice_number, amount, due_date),
          debtors!inner(id, company_name, name)
        `)
        .eq('user_id', effectiveAccountId)
        .eq('direction', 'outbound')
        .in('activity_type', ['ai_outreach', 'manual_outreach', 'account_level_outreach'])
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHistoricalActivities(data || []);
    } catch (error) {
      console.error("Error fetching historical outreach:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [effectiveAccountId, accountLoading]);

  useEffect(() => {
    if (showHistory) {
      fetchHistoricalOutreach();
    }
  }, [showHistory, fetchHistoricalOutreach]);

  const getScheduleLabel = (date: Date) => {
    const timeStr = format(date, "h:mm a"); // Local time
    if (isPast(date) && !isToday(date)) {
      return { label: 'Overdue', time: timeStr, className: 'bg-destructive/10 text-destructive border-destructive/20' };
    }
    if (isToday(date)) {
      return { label: 'Today', time: timeStr, className: 'bg-primary/10 text-primary border-primary/20' };
    }
    if (isTomorrow(date)) {
      return { label: 'Tomorrow', time: timeStr, className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' };
    }
    return { label: format(date, "MMM d"), time: timeStr, className: 'bg-muted text-muted-foreground' };
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleRowClick = (invoiceId: string) => {
    navigate(`/invoices/${invoiceId}`);
  };

  const handleRefresh = () => {
    fetchUpcomingOutreach(true);
    if (showHistory) {
      fetchHistoricalOutreach();
    }
  };

  // Get the selected persona config for display
  const selectedPersonaConfig = selectedPersona ? personaConfig[selectedPersona] : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const clearFilters = () => {
    setAccountFilter("");
    setSortField('scheduled_date');
    setSortDirection('asc');
    setCurrentPage(1);
    if (onPersonaFilterClear) onPersonaFilterClear();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {showHistory ? "Outreach History" : "Upcoming Outreach Schedule"}
              </CardTitle>
              <CardDescription>
                {showHistory 
                  ? "Historical log of sent collection outreach. Click any row to view invoice details."
                  : "Real-time log of scheduled collection outreach. Click any row to view invoice details."
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch 
                  id="show-history" 
                  checked={showHistory} 
                  onCheckedChange={setShowHistory}
                />
                <Label htmlFor="show-history" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <History className="h-4 w-4" />
                  History
                </Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || historyLoading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", (refreshing || historyLoading) && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Persona Filter Indicator */}
          {selectedPersona && selectedPersonaConfig && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50 border">
              <PersonaAvatar persona={selectedPersonaConfig} size="xs" />
              <span className="text-sm">
                Filtering by <strong>{selectedPersonaConfig.name}</strong>
              </span>
              <Badge variant="secondary" className="text-xs">
                {totalCount} invoice{totalCount !== 1 ? 's' : ''}
              </Badge>
              {onPersonaFilterClear && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto"
                  onClick={onPersonaFilterClear}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Historical Outreach View */}
        {showHistory ? (
          historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : historicalActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No outreach history found</p>
              <p className="text-sm mt-1">Past sent collection emails will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[140px]">Sent</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalActivities.map((activity: any) => {
                      const invoice = activity.invoices as any;
                      const debtor = activity.debtors as any;
                      const sentDate = activity.sent_at ? new Date(activity.sent_at) : new Date(activity.created_at);
                      
                      return (
                        <TableRow
                          key={activity.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => invoice?.id && handleRowClick(invoice.id)}
                        >
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium">
                                {format(sentDate, "MMM d, yyyy")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(sentDate, "h:mm a")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate max-w-[200px]">
                                {debtor?.company_name || debtor?.name || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-mono">
                              #{invoice?.invoice_number || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {invoice?.amount ? formatCurrency(invoice.amount) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {activity.responded_at ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Responded
                              </Badge>
                            ) : activity.opened_at ? (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Opened
                              </Badge>
                            ) : activity.delivered_at ? (
                              <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                Delivered
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Sent
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (invoice?.id) handleRowClick(invoice.id);
                              }}
                              title="View invoice"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile View for History */}
              <div className="md:hidden space-y-2">
                {historicalActivities.map((activity: any) => {
                  const invoice = activity.invoices as any;
                  const debtor = activity.debtors as any;
                  const sentDate = activity.sent_at ? new Date(activity.sent_at) : new Date(activity.created_at);
                  
                  return (
                    <div
                      key={activity.id}
                      className="flex flex-col p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      onClick={() => invoice?.id && handleRowClick(invoice.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {format(sentDate, "MMM d, yyyy h:mm a")}
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                          #{invoice?.invoice_number || 'N/A'}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm mb-2 truncate">
                        {debtor?.company_name || debtor?.name || 'Unknown'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{invoice?.amount ? formatCurrency(invoice.amount) : '-'}</span>
                        {activity.responded_at ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                            Responded
                          </Badge>
                        ) : activity.opened_at ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">
                            Opened
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Sent</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : outreachItems.length === 0 && !accountFilter ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No upcoming outreach scheduled</p>
            <p className="text-sm mt-1">
              {selectedPersona 
                ? `No invoices assigned to ${selectedPersonaConfig?.name || 'this agent'}.`
                : "All invoices are either current or have completed their outreach sequences."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filter and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by account name..."
                    value={accountFilter}
                    onChange={(e) => {
                      setAccountFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 h-9"
                  />
                </div>
                {(accountFilter || selectedPersona) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-9 px-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sort by:</span>
                <Select
                  value={sortField}
                  onValueChange={(value: SortField) => {
                    setSortField(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled_date">Schedule Date</SelectItem>
                    <SelectItem value="company_name">Account Name</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="days_past_due">Days Past Due</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {outreachItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No results found</p>
                <p className="text-sm mt-1">Try adjusting your filter criteria.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead 
                          className="w-[140px] cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('scheduled_date')}
                        >
                          <span className="flex items-center">
                            Scheduled
                            {getSortIcon('scheduled_date')}
                          </span>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('company_name')}
                        >
                          <span className="flex items-center">
                            Account
                            {getSortIcon('company_name')}
                          </span>
                        </TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('amount')}
                        >
                          <span className="flex items-center justify-end">
                            Amount
                            {getSortIcon('amount')}
                          </span>
                        </TableHead>
                        <TableHead 
                          className="text-center cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('days_past_due')}
                        >
                          <span className="flex items-center justify-center">
                            DPD
                            {getSortIcon('days_past_due')}
                          </span>
                        </TableHead>
                        <TableHead className="text-center">Sequence</TableHead>
                        <TableHead>Assigned Agent</TableHead>
                        <TableHead className="w-[100px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                <TableBody>
                  {outreachItems.map((item) => {
                    const scheduleInfo = getScheduleLabel(item.scheduled_date);
                    const persona = personaConfig[item.persona_key];
                    
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => handleRowClick(item.invoice_id)}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs font-medium w-fit", scheduleInfo.className)}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {scheduleInfo.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground pl-0.5">
                              {scheduleInfo.time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {item.company_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            #{item.invoice_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              item.days_past_due > 90 && "bg-destructive/10 text-destructive",
                              item.days_past_due > 60 && item.days_past_due <= 90 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                              item.days_past_due > 30 && item.days_past_due <= 60 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            )}
                          >
                            {item.days_past_due}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs bg-primary/5">
                            Step {item.outreach_sequence}/{STEP_DAY_OFFSETS.length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {persona && <PersonaAvatar persona={persona} size="xs" />}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {persona?.name || 'Unknown'}
                              </span>
                              {item.is_account_level && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 w-fit">
                                  <User className="h-2 w-2 mr-0.5" />
                                  Account Level
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewItem(item);
                              }}
                              title="Preview message"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(item.invoice_id);
                              }}
                              title="View invoice"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-2">
              {outreachItems.map((item) => {
                const scheduleInfo = getScheduleLabel(item.scheduled_date);
                const persona = personaConfig[item.persona_key];
                
                return (
                  <div
                    key={item.id}
                    className="flex flex-col p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs font-medium", scheduleInfo.className)}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {scheduleInfo.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {scheduleInfo.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setPreviewItem(item)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Badge variant="outline" className="text-xs font-mono">
                          #{item.invoice_number}
                        </Badge>
                      </div>
                    </div>
                    
                    <p 
                      className="font-medium text-sm mb-2 truncate cursor-pointer hover:text-primary"
                      onClick={() => handleRowClick(item.invoice_id)}
                    >
                      {item.company_name}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(item.amount)}</span>
                      <span>{item.days_past_due} DPD</span>
                      <div className="flex items-center gap-1">
                        {persona && <PersonaAvatar persona={persona} size="xs" />}
                        <span>{persona?.name}</span>
                        {item.is_account_level && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            <User className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-muted-foreground">of</span>
                    <span className="text-sm font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </CardContent>

      {/* Message Preview Modal */}
      {previewItem && (
        <OutreachMessagePreview
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          invoiceId={previewItem.invoice_id}
          invoiceNumber={previewItem.invoice_number}
          companyName={previewItem.company_name}
          amount={previewItem.amount}
          dueDate={previewItem.due_date}
          personaKey={previewItem.persona_key}
          outreachSequence={previewItem.outreach_sequence}
        />
      )}
    </Card>
  );
};

export default UpcomingOutreachLog;
