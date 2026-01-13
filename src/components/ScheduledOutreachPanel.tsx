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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Mail, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Calendar,
  Building2,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Bot,
  Eye,
  Check,
  AlertCircle,
  Sparkles,
  Save,
  Trash2,
  CheckSquare,
  Square
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

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
  source_type: 'invoice_workflow' | 'account_level';
  status: 'pending_approval' | 'approved';
  subject?: string;
  message_body?: string;
  step_number?: number;
  created_at?: string;
  updated_at?: string;
  invoice_status?: string;
}

// Nicolas is the dedicated account-level agent
const ACCOUNT_LEVEL_PERSONA = 'nicolas';

interface ScheduledOutreachPanelProps {
  selectedPersona?: string | null;
  onPersonaFilterClear?: () => void;
}

const PAGE_SIZE = 15;

// Get persona based on days past due - must match AgentScheduleCards logic exactly
const getPersonaKeyByDpd = (daysPastDue: number | null | undefined): string => {
  const dpd = daysPastDue ?? 0;
  
  // Handle current/pre-due invoices - assign to Sam (0-30 DPD agent)
  if (dpd <= 0) return "sam";
  
  // Handle past due invoices by finding matching persona bucket
  for (const [key, config] of Object.entries(personaConfig)) {
    if (key === 'nicolas') continue; // Skip account-level agent
    
    if (config.bucketMax === null) {
      // Unbounded max (e.g., 150+ DPD)
      if (dpd >= config.bucketMin) return key;
    } else {
      if (dpd >= config.bucketMin && dpd <= config.bucketMax) {
        return key;
      }
    }
  }
  
  // Default fallback to Sam if no match
  return "sam";
};

export function ScheduledOutreachPanel({ selectedPersona, onPersonaFilterClear }: ScheduledOutreachPanelProps) {
  const navigate = useNavigate();
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Preview state
  const [previewItem, setPreviewItem] = useState<ScheduledItem | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBody, setPreviewBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ScheduledItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const fetchScheduledOutreach = async (showRefreshing = false) => {
    if (accountLoading || !effectiveAccountId) return;
    
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Fetch invoice-level AI drafts (pending/approved) 
      // We'll filter inactive invoices on the client side after fetching
      const invoiceDraftsQuery = supabase
        .from('ai_drafts')
        .select(`
          id,
          invoice_id,
          subject,
          message_body,
          status,
          recommended_send_date,
          days_past_due,
          step_number,
          channel,
          created_at,
          updated_at,
          invoices!inner(
            id,
            invoice_number,
            amount,
            amount_outstanding,
            aging_bucket,
            debtor_id,
            status,
            debtors(id, company_name, account_outreach_enabled, total_open_balance)
          )
        `)
        .eq('user_id', effectiveAccountId)
        .in('status', ['pending_approval', 'approved'])
        .is('sent_at', null)
        .not('invoice_id', 'is', null)
        .order('recommended_send_date', { ascending: true });

      // Fetch account-level AI drafts (invoice_id is null)
      const accountDraftsQuery = supabase
        .from('ai_drafts')
        .select(`
          id,
          invoice_id,
          subject,
          message_body,
          status,
          recommended_send_date,
          days_past_due,
          step_number,
          channel,
          created_at,
          updated_at,
          applied_brand_snapshot
        `)
        .eq('user_id', effectiveAccountId)
        .in('status', ['pending_approval', 'approved'])
        .is('sent_at', null)
        .is('invoice_id', null)
        .order('recommended_send_date', { ascending: true });

      const [invoiceResult, accountResult] = await Promise.all([
        invoiceDraftsQuery,
        accountDraftsQuery
      ]);

      if (invoiceResult.error) throw invoiceResult.error;
      if (accountResult.error) throw accountResult.error;

      // Inactive invoice statuses to exclude from outreach
      const excludedInvoiceStatuses = ['Paid', 'Canceled', 'Voided', 'WrittenOff', 'Credited'];
      
      // Map and filter invoice-level drafts - exclude inactive invoices on client side
      const invoiceItems: ScheduledItem[] = (invoiceResult.data || [])
        .filter((d: any) => {
          if (!d.invoices) return false;
          // Exclude invoices with terminal statuses
          const invoiceStatus = d.invoices.status;
          return !excludedInvoiceStatuses.includes(invoiceStatus);
        })
        .map((draft: any) => {
          const invoice = draft.invoices;
          const debtor = invoice?.debtors;
          const agingBucket = invoice?.aging_bucket || 'dpd_1_30';
          // Use days_past_due from draft to match AgentScheduleCards logic
          const personaKey = getPersonaKeyByDpd(draft.days_past_due);

          return {
            id: draft.id,
            invoice_id: invoice?.id,
            invoice_number: invoice?.invoice_number,
            debtor_id: debtor?.id,
            company_name: debtor?.company_name || 'Unknown',
            amount: invoice?.amount_outstanding || invoice?.amount || 0,
            scheduled_date: draft.recommended_send_date || new Date().toISOString(),
            days_past_due: draft.days_past_due || 0,
            aging_bucket: agingBucket,
            persona_key: personaKey,
            source_type: 'invoice_workflow' as const,
            status: draft.status as 'pending_approval' | 'approved',
            subject: draft.subject,
            message_body: draft.message_body,
            step_number: draft.step_number,
            created_at: draft.created_at,
            updated_at: draft.updated_at,
            invoice_status: invoice?.status,
          };
        });

      // For account-level drafts, we need to fetch debtor balances separately
      const accountDrafts = accountResult.data || [];
      
      // Extract debtor IDs from snapshots - check multiple possible locations
      const debtorIds = accountDrafts
        .map((draft: any) => {
          const snapshot = draft.applied_brand_snapshot || {};
          const context = snapshot.context || {};
          const invoices = context.invoices || [];
          
          // Check multiple possible locations for debtor_id
          return snapshot.debtor_id || 
                 context.debtor_id || 
                 (invoices.length > 0 ? invoices[0].debtor_id : null) ||
                 null;
        })
        .filter((id: string | null): id is string => !!id);

      // Fetch debtor balances if we have IDs
      let debtorBalances: Record<string, { balance: number; companyName: string }> = {};
      if (debtorIds.length > 0) {
        const { data: debtorsData } = await supabase
          .from('debtors')
          .select('id, total_open_balance, company_name')
          .in('id', debtorIds);
        
        if (debtorsData) {
          debtorBalances = debtorsData.reduce((acc, d) => {
            acc[d.id] = { 
              balance: d.total_open_balance || 0,
              companyName: d.company_name || ''
            };
            return acc;
          }, {} as Record<string, { balance: number; companyName: string }>);
        }
      }

      // Map account-level drafts with real debtor balances
      // Account-level outreach always uses Nicolas as the agent
      const accountItems: ScheduledItem[] = accountDrafts.map((draft: any) => {
        const snapshot = draft.applied_brand_snapshot || {};
        const context = snapshot.context || {};
        const invoices = context.invoices || [];
        
        // Get debtor ID from multiple possible locations
        const debtorId = snapshot.debtor_id || 
                        context.debtor_id || 
                        (invoices.length > 0 ? invoices[0].debtor_id : '') ||
                        '';
        
        // Get debtor info from our fetched data
        const debtorInfo = debtorBalances[debtorId];
        
        // Calculate total outstanding from invoices in snapshot if no debtor balance
        const snapshotTotal = invoices.reduce((sum: number, inv: any) => {
          return sum + (inv.amount_outstanding || inv.amount || 0);
        }, 0);
        
        // Use real debtor balance first, then snapshot invoice totals, then context values
        const amount = debtorInfo?.balance || 
                      snapshotTotal || 
                      context.totalOutstanding ||
                      context.totalAmount || 
                      snapshot.total_amount || 
                      0;

        // Get company name - prefer real data, then snapshot
        const companyName = debtorInfo?.companyName || 
                           snapshot.debtor_name || 
                           context.accountName || 
                           snapshot.company_name || 
                           'Account Summary';

        return {
          id: draft.id,
          invoice_id: null,
          invoice_number: null,
          debtor_id: debtorId,
          company_name: companyName,
          amount: amount,
          scheduled_date: draft.recommended_send_date || new Date().toISOString(),
          days_past_due: draft.days_past_due || 0,
          aging_bucket: 'account_level',
          persona_key: ACCOUNT_LEVEL_PERSONA, // Always use Nicolas for account-level
          source_type: 'account_level' as const,
          status: draft.status as 'pending_approval' | 'approved',
          subject: draft.subject,
          message_body: draft.message_body,
          step_number: draft.step_number,
          created_at: draft.created_at,
          updated_at: draft.updated_at,
        };
      });

      // Combine and sort
      const allItems = [...invoiceItems, ...accountItems].sort(
        (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      );

      setItems(allItems);
    } catch (error) {
      console.error("Error fetching scheduled outreach:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScheduledOutreach();
  }, [effectiveAccountId, accountLoading]);

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

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    // Persona filter - handle 'nicolas' for account-level
    if (selectedPersona) {
      if (selectedPersona === ACCOUNT_LEVEL_PERSONA) {
        result = result.filter(item => item.source_type === 'account_level');
      } else {
        result = result.filter(item => item.persona_key === selectedPersona);
      }
    }

    return result;
  }, [items, searchFilter, sourceFilter, statusFilter, selectedPersona]);
  
  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchFilter, sourceFilter, statusFilter, selectedPersona]);

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
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 gap-1">
            <FileText className="h-3 w-3" />
            Invoice
          </Badge>
        );
      case 'account_level':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 gap-1">
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

  const getStatusBadge = (status: string, scheduledDate: string, createdAt?: string, updatedAt?: string) => {
    const scheduled = new Date(scheduledDate);
    const now = new Date();
    const isScheduledFuture = scheduled > now;
    const scheduledDateFormatted = format(scheduled, "MMM d, h:mm a");
    
    if (status === 'approved') {
      // Approved draft - differentiate between ready to send vs scheduled for future
      if (isScheduledFuture) {
        return (
          <div className="flex flex-col gap-0.5">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 gap-1 w-fit">
              <Calendar className="h-3 w-3" />
              Scheduled
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Sends {format(scheduled, "MMM d, h:mm a")}
            </span>
          </div>
        );
      }
      // Ready to send - show when it will be sent (next batch run)
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 gap-1 w-fit">
            <Check className="h-3 w-3" />
            Ready to Send
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {scheduledDateFormatted}
          </span>
        </div>
      );
    }
    // Pending approval - show when it's scheduled to be sent once approved
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 gap-1 w-fit">
          <AlertCircle className="h-3 w-3" />
          Needs Approval
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          Target: {scheduledDateFormatted}
        </span>
      </div>
    );
  };
  
  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map(item => item.id)));
    }
  };
  
  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkApproving(true);
    
    try {
      const idsToApprove = Array.from(selectedIds).filter(id => {
        const item = items.find(i => i.id === id);
        return item?.status === 'pending_approval';
      });
      
      if (idsToApprove.length === 0) {
        toast.info("No pending drafts selected to approve");
        return;
      }
      
      const { error } = await supabase
        .from('ai_drafts')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .in('id', idsToApprove);

      if (error) throw error;
      toast.success(`${idsToApprove.length} draft(s) approved`);
      setSelectedIds(new Set());
      fetchScheduledOutreach(true);
    } catch (error) {
      console.error("Error bulk approving drafts:", error);
      toast.error("Failed to approve drafts");
    } finally {
      setIsBulkApproving(false);
    }
  };
  
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      toast.success(`${selectedIds.size} draft(s) deleted`);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      fetchScheduledOutreach(true);
    } catch (error) {
      console.error("Error bulk deleting drafts:", error);
      toast.error("Failed to delete drafts");
    } finally {
      setIsBulkDeleting(false);
    }
  };
  
  const selectedPendingCount = Array.from(selectedIds).filter(id => {
    const item = items.find(i => i.id === id);
    return item?.status === 'pending_approval';
  }).length;

  // Convert HTML to plain text for display
  const stripHtmlTags = (html: string): string => {
    // Replace <br/> and </p><p> with newlines
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n');
    // Remove any remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Clean up extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  };

  const handlePreview = (item: ScheduledItem) => {
    setPreviewItem(item);
    setPreviewSubject(item.subject || '');
    setPreviewBody(item.message_body || '');
    setIsEditing(false);
  };

  const handleApprove = async (item: ScheduledItem) => {
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;
      toast.success("Draft approved");
      fetchScheduledOutreach(true);
    } catch (error) {
      console.error("Error approving draft:", error);
      toast.error("Failed to approve draft");
    }
  };

  const handleSavePreview = async () => {
    if (!previewItem) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .update({
          subject: previewSubject,
          message_body: previewBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', previewItem.id);

      if (error) throw error;
      toast.success("Draft updated");
      setPreviewItem(null);
      setIsEditing(false);
      fetchScheduledOutreach(true);
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('ai_drafts')
        .delete()
        .eq('id', deleteItem.id);

      if (error) throw error;
      toast.success("Draft deleted");
      setDeleteItem(null);
      fetchScheduledOutreach(true);
    } catch (error) {
      console.error("Error deleting draft:", error);
      toast.error("Failed to delete draft");
    } finally {
      setIsDeleting(false);
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
    <>
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
                  Approved drafts are sent automatically. "Needs Approval" requires your review before sending.
                  Closed invoices (Paid, Canceled, Voided) are excluded from outreach.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedPersona && onPersonaFilterClear && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPersonaFilterClear}
                    className="text-muted-foreground"
                  >
                    Clear filter
                  </Button>
                )}
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
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="invoice_workflow">Invoice Workflow</SelectItem>
                  <SelectItem value="account_level">Account Level</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_approval">Needs Approval</SelectItem>
                  <SelectItem value="approved">Ready / Scheduled</SelectItem>
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
                {searchFilter || sourceFilter !== 'all' || statusFilter !== 'all'
                  ? "No matching scheduled outreach found."
                  : "No scheduled outreach yet."}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                AI-generated drafts will appear here when created.
              </p>
            </div>
          ) : (
            <>
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 mb-4 bg-muted rounded-lg border">
                  <span className="text-sm font-medium">
                    {selectedIds.size} selected
                  </span>
                  <div className="h-4 w-px bg-border" />
                  {selectedPendingCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkApprove}
                      disabled={isBulkApproving}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {isBulkApproving ? "Approving..." : `Approve (${selectedPendingCount})`}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={isBulkDeleting}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {isBulkDeleting ? "Deleting..." : "Delete"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginatedItems.length > 0 && selectedIds.size === paginatedItems.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Account / Invoice</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const persona = item.persona_key === ACCOUNT_LEVEL_PERSONA 
                      ? { name: 'Nicolas', color: '#8b5cf6' } 
                      : personaConfig[item.persona_key];
                    const scheduleInfo = getScheduleLabel(item.scheduled_date);
                    const isSelected = selectedIds.has(item.id);

                    return (
                      <TableRow key={item.id} className={cn(isSelected && "bg-muted/50")}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectItem(item.id)}
                            aria-label={`Select ${item.company_name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PersonaAvatar persona={item.persona_key} size="sm" />
                            <span className="text-sm font-medium">{persona?.name || item.persona_key}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p 
                              className="font-medium text-sm hover:underline cursor-pointer"
                              onClick={() => {
                                if (item.invoice_id) {
                                  navigate(`/invoices/${item.invoice_id}`);
                                } else if (item.debtor_id) {
                                  navigate(`/debtors/${item.debtor_id}`);
                                }
                              }}
                            >
                              {item.company_name}
                            </p>
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
                          {getStatusBadge(item.status, item.scheduled_date, item.created_at, item.updated_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {item.status === 'pending_approval' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(item)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteItem(item)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
      
      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Draft(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected {selectedIds.size} draft(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <span>Draft Preview</span>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                {previewItem && personaConfig[previewItem.persona_key] && (
                  <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted">
                    <PersonaAvatar persona={previewItem.persona_key} size="xs" />
                    <span className="text-xs font-medium">{personaConfig[previewItem.persona_key].name}</span>
                  </div>
                )}
                {previewItem && (
                  <Badge variant={previewItem.status === 'approved' ? 'default' : 'secondary'}>
                    {previewItem.status === 'approved' ? 'Approved' : 'Pending'}
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {previewItem && (
            <div className="space-y-4">
              {/* Context Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Account:</strong> {previewItem.company_name}</div>
                  <div><strong>Type:</strong> {previewItem.source_type === 'account_level' ? 'Account Level' : 'Invoice Workflow'}</div>
                  {previewItem.invoice_number && (
                    <div><strong>Invoice:</strong> #{previewItem.invoice_number}</div>
                  )}
                  <div><strong>Amount:</strong> {formatCurrency(previewItem.amount)}</div>
                  <div><strong>Scheduled:</strong> {format(new Date(previewItem.scheduled_date), "MMM d, yyyy")}</div>
                  {previewItem.step_number && (
                    <div><strong>Step:</strong> {previewItem.step_number}</div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? "Cancel Edit" : "Edit"}
                </Button>
                {previewItem.status === 'pending_approval' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      handleApprove(previewItem);
                      setPreviewItem(null);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                )}
              </div>

              {/* Email Content */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                    <Badge variant="outline">Email</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <Input
                      value={previewSubject}
                      onChange={(e) => setPreviewSubject(e.target.value)}
                      placeholder="Email subject"
                      className="font-medium"
                    />
                  ) : (
                    <div className="p-3 bg-accent rounded border">
                      <p className="font-medium">{previewSubject || "No subject"}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Body</p>
                    {isEditing ? (
                      <Textarea
                        value={previewBody}
                        onChange={(e) => setPreviewBody(e.target.value)}
                        placeholder="Email body"
                        className="min-h-[200px]"
                      />
                    ) : (
                      <div className="p-4 bg-background rounded border max-h-[300px] overflow-y-auto">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {stripHtmlTags(previewBody) || "No content"}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewItem(null)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            {isEditing && (
              <Button
                onClick={handleSavePreview}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pending draft for "{deleteItem?.company_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ScheduledOutreachPanel;
