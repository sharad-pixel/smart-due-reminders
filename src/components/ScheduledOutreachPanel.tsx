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
  Trash2
} from "lucide-react";
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
}

interface ScheduledOutreachPanelProps {
  selectedPersona?: string | null;
  onPersonaFilterClear?: () => void;
}

const PAGE_SIZE = 15;

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

  const fetchScheduledOutreach = async (showRefreshing = false) => {
    if (accountLoading || !effectiveAccountId) return;
    
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Fetch invoice-level AI drafts (pending/approved)
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

      // Map invoice-level drafts
      const invoiceItems: ScheduledItem[] = (invoiceResult.data || [])
        .filter((d: any) => d.invoices)
        .map((draft: any) => {
          const invoice = draft.invoices;
          const debtor = invoice?.debtors;
          const agingBucket = invoice?.aging_bucket || 'dpd_1_30';
          const personaInfo = getPersonaForBucket(agingBucket);

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
            source_type: 'invoice_workflow' as const,
            status: draft.status as 'pending_approval' | 'approved',
            subject: draft.subject,
            message_body: draft.message_body,
            step_number: draft.step_number,
            created_at: draft.created_at,
            updated_at: draft.updated_at,
          };
        });

      // Map account-level drafts
      const accountItems: ScheduledItem[] = (accountResult.data || []).map((draft: any) => {
        const snapshot = draft.applied_brand_snapshot || {};
        const personaInfo = getPersonaForBucket('dpd_1_30'); // Default persona for account level

        return {
          id: draft.id,
          invoice_id: null,
          invoice_number: null,
          debtor_id: snapshot.debtor_id || '',
          company_name: snapshot.debtor_name || snapshot.company_name || 'Account Summary',
          amount: snapshot.total_amount || 0,
          scheduled_date: draft.recommended_send_date || new Date().toISOString(),
          days_past_due: draft.days_past_due || 0,
          aging_bucket: 'account_level',
          persona_key: personaInfo?.key || 'nicolas',
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

    // Persona filter
    if (selectedPersona) {
      result = result.filter(item => item.persona_key === selectedPersona);
    }

    return result;
  }, [items, searchFilter, sourceFilter, statusFilter, selectedPersona]);

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

  const getStatusBadge = (status: string, createdAt?: string, updatedAt?: string) => {
    const date = updatedAt || createdAt;
    const formattedDate = date ? format(new Date(date), "MMM d, h:mm a") : '';
    
    if (status === 'approved') {
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 gap-1 w-fit">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
          {formattedDate && (
            <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="secondary" className="gap-1 w-fit">
          <AlertCircle className="h-3 w-3" />
          Pending
        </Badge>
        {formattedDate && (
          <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
        )}
      </div>
    );
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
                  AI-generated drafts pending review or ready to send. Filter by type (Invoice or Account) and status.
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
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_approval">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const persona = personaConfig[item.persona_key];
                    const scheduleInfo = getScheduleLabel(item.scheduled_date);

                    return (
                      <TableRow key={item.id}>
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
                          {getStatusBadge(item.status, item.created_at, item.updated_at)}
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteItem(item)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
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
                        <div className="whitespace-pre-wrap text-sm">
                          {previewBody || "No content"}
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
