import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, AlertCircle, XCircle, Info, Copy, Check, Sparkles, Edit, Plus, DollarSign, Mail, FileText, ChevronRight, X, PauseCircle, PlayCircle, Search, MessageSquare, CreditCard, FileX } from "lucide-react";
import { InvoiceTransactionLog } from "@/components/InvoiceTransactionLog";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { PersonaCommandInput } from "@/components/PersonaCommandInput";
import { DraftPreviewModal } from "@/components/DraftPreviewModal";
import { TasksSummaryCard } from "@/components/TasksSummaryCard";
import type { CollectionTask } from "@/hooks/useCollectionTasks";
import { getPaymentTermsOptions, calculateDueDate } from "@/lib/paymentTerms";
import CreateTaskModal from "@/components/CreateTaskModal";
import { OutreachDetailModal, OutreachRecord } from "@/components/OutreachDetailModal";
import { OutreachSummaryRow } from "@/components/OutreachSummaryRow";

import { InvoiceWorkflowCard } from "@/components/InvoiceWorkflowCard";
import { IntegrationSourceBanner } from "@/components/IntegrationSourceBanner";
import { useOverrideWarning, useStatusActionWarning, logOverrideAndUpdateInvoice } from "@/components/InvoiceOverrideWarningDialogs";
import { OutreachTimeline } from "@/components/OutreachTimeline";

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding: number | null;
  amount_original: number | null;
  due_date: string;
  issue_date: string;
  status: string;
  notes: string | null;
  debtor_id: string;
  payment_terms: string | null;
  currency: string | null;
  external_invoice_id: string | null;
  external_link: string | null;
  is_archived: boolean | null;
  is_overage: boolean | null;
  last_contact_date: string | null;
  last_contacted_at: string | null;
  next_contact_date: string | null;
  paid_date: string | null;
  payment_date: string | null;
  payment_method: string | null;
  payment_terms_days: number | null;
  product_description: string | null;
  promise_to_pay_amount: number | null;
  promise_to_pay_date: string | null;
  source_system: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  aging_bucket: string | null;
  created_at: string | null;
  updated_at: string | null;
  outreach_paused: boolean | null;
  outreach_paused_at: string | null;
  stripe_invoice_id: string | null;
  stripe_hosted_url: string | null;
  // Integration source tracking
  integration_source: string | null;
  integration_id: string | null;
  integration_url: string | null;
  has_local_overrides: boolean | null;
  override_count: number | null;
  last_synced_at: string | null;
  original_amount: number | null;
  original_due_date: string | null;
  debtors?: { 
    company_name: string; 
    email: string;
    crm_account_id: string | null;
    outreach_paused?: boolean | null;
    account_outreach_enabled?: boolean | null;
  };
}

interface CRMAccount {
  id: string;
  name: string;
  segment: string | null;
  mrr: number | null;
  lifetime_value: number | null;
  customer_since: string | null;
  health_score: string | null;
  status: string | null;
  owner_name: string | null;
}

interface CollectionWorkflow {
  id: string;
  name: string;
  description: string | null;
  aging_bucket: string;
  is_active: boolean;
}

interface OutreachLog {
  id: string;
  channel: string;
  subject: string | null;
  sent_at: string | null;
  status: string;
  message_body: string;
  sent_to: string;
  sent_from: string | null;
  delivery_metadata?: any;
  metadata?: any;
  direction?: string;
  activity_type?: string;
  source: 'outreach_logs' | 'collection_activities';
  invoice_id: string | null;
  created_at: string;
}

interface AIDraft {
  id: string;
  step_number: number;
  channel: string;
  subject: string | null;
  message_body: string;
  status: string;
  recommended_send_date: string | null;
  created_at?: string;
  days_past_due?: number | null;
  agent_persona_id?: string | null;
  ai_agent_personas?: {
    name: string;
    persona_summary: string;
  } | null;
}

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [primaryContactEmail, setPrimaryContactEmail] = useState<string | null>(null);
  const [associatedWorkflow, setAssociatedWorkflow] = useState<CollectionWorkflow | null>(null);
const [workflowStepsCount, setWorkflowStepsCount] = useState<number>(0);
  const [workflowSteps, setWorkflowSteps] = useState<{ id: string; step_order: number; day_offset: number; channel: string; label: string; is_active: boolean }[]>([]);
  const [outreach, setOutreach] = useState<OutreachLog[]>([]);
  const [drafts, setDrafts] = useState<AIDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateTone, setGenerateTone] = useState<"friendly" | "neutral" | "firm">("friendly");
  const [generateStep, setGenerateStep] = useState(1);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<AIDraft | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [crmAccount, setCrmAccount] = useState<CRMAccount | null>(null);
  const [copiedRefId, setCopiedRefId] = useState(false);
  const [previewDraft, setPreviewDraft] = useState<any>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [editInvoiceDialogOpen, setEditInvoiceDialogOpen] = useState(false);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("NET30");
  const [editNotes, setEditNotes] = useState("");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedOutreach, setSelectedOutreach] = useState<OutreachRecord | null>(null);
  const [outreachDetailOpen, setOutreachDetailOpen] = useState(false);
  const [outreachSearch, setOutreachSearch] = useState("");
  const [outreachPage, setOutreachPage] = useState(1);
  const OUTREACH_PAGE_SIZE = 10;
  const [applyPaymentOpen, setApplyPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [applyingPayment, setApplyingPayment] = useState(false);
  
  // Credit/Write-Off state
  const [creditWriteOffOpen, setCreditWriteOffOpen] = useState(false);
  const [creditWriteOffType, setCreditWriteOffType] = useState<'credit' | 'write_off'>('credit');
  const [creditWriteOffAmount, setCreditWriteOffAmount] = useState("");
  const [creditWriteOffReason, setCreditWriteOffReason] = useState("");
  const [creditWriteOffNotes, setCreditWriteOffNotes] = useState("");
  const [applyingCreditWriteOff, setApplyingCreditWriteOff] = useState(false);
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);

  // Override warning hook (for field edits)
  const { checkAndProceed, CSVWarningDialog, IntegrationWarningDialog } = useOverrideWarning({
    integrationSource: invoice?.integration_source,
    integrationUrl: invoice?.integration_url,
    invoiceId: id || "",
  });

  // Status action warning hook (for Apply Payment, Credit, Write Off, Status Changes)
  const { checkStatusActionAndProceed, StatusActionWarningDialog, isIntegratedInvoice } = useStatusActionWarning({
    integrationSource: invoice?.integration_source,
    integrationUrl: invoice?.integration_url || invoice?.stripe_hosted_url,
    invoiceId: id || "",
  });

  // Filtered and paginated outreach
  const filteredOutreach = useMemo(() => {
    if (!outreachSearch.trim()) return outreach;
    const search = outreachSearch.toLowerCase();
    return outreach.filter(log => 
      log.subject?.toLowerCase().includes(search) ||
      log.message_body?.toLowerCase().includes(search) ||
      log.sent_to?.toLowerCase().includes(search)
    );
  }, [outreach, outreachSearch]);

  const paginatedOutreach = useMemo(() => {
    const start = (outreachPage - 1) * OUTREACH_PAGE_SIZE;
    return filteredOutreach.slice(start, start + OUTREACH_PAGE_SIZE);
  }, [filteredOutreach, outreachPage]);

  const totalOutreachPages = Math.ceil(filteredOutreach.length / OUTREACH_PAGE_SIZE);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  // Format currency with exactly 2 decimal places
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '0.00';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getAgingBucket = (daysPastDue: number): string => {
    if (daysPastDue < 0) return 'current';
    if (daysPastDue <= 30) return 'dpd_1_30';
    if (daysPastDue <= 60) return 'dpd_31_60';
    if (daysPastDue <= 90) return 'dpd_61_90';
    if (daysPastDue <= 120) return 'dpd_91_120';
    if (daysPastDue <= 150) return 'dpd_121_150';
    return 'dpd_150_plus';
  };

  const fetchData = async () => {
    try {
      const [invoiceRes, outreachLogsRes, activitiesRes, draftsRes, tasksRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, debtors(company_name, email, crm_account_id, outreach_paused, account_outreach_enabled)")
          .eq("id", id)
          .single(),
        supabase
          .from("outreach_logs")
          .select("*")
          .eq("invoice_id", id)
          .order("sent_at", { ascending: false }),
        supabase
          .from("collection_activities")
          .select("*")
          .eq("invoice_id", id)
          .eq("direction", "outbound")
          .order("sent_at", { ascending: false }),
        supabase
          .from("ai_drafts")
          .select("*, ai_agent_personas(name, persona_summary)")
          .eq("invoice_id", id)
          .neq("status", "discarded")
          .order("step_number", { ascending: true }),
        supabase
          .from("collection_tasks")
          .select("*")
          .eq("invoice_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      setInvoice(invoiceRes.data);

      // Combine outreach logs and collection activities
      const outreachFromLogs: OutreachLog[] = (outreachLogsRes.data || []).map(log => ({
        ...log,
        source: 'outreach_logs' as const,
        sent_to: log.sent_to || '',
        sent_from: log.sent_from || null,
        invoice_id: log.invoice_id || id || null,
        created_at: log.created_at || log.sent_at || new Date().toISOString()
      }));
      
      const outreachFromActivities: OutreachLog[] = (activitiesRes.data || []).map(activity => {
        const metadata = activity.metadata as Record<string, any> | null;
        return {
          id: activity.id,
          channel: activity.channel,
          subject: activity.subject,
          sent_at: activity.sent_at,
          status: 'sent',
          message_body: activity.message_body,
          sent_to: metadata?.recipient || '',
          sent_from: metadata?.sender || null,
          delivery_metadata: metadata,
          direction: activity.direction,
          activity_type: activity.activity_type,
          source: 'collection_activities' as const,
          invoice_id: id || null,
          created_at: activity.created_at || activity.sent_at || new Date().toISOString()
        };
      });
      
      // Combine and deduplicate (prefer collection_activities if both exist)
      const allOutreach = [...outreachFromActivities, ...outreachFromLogs]
        .sort((a, b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime());
      
      setOutreach(allOutreach);
      setDrafts(draftsRes.data || []);
      setTasks((tasksRes.data || []) as CollectionTask[]);

      // Fetch associated workflow based on aging bucket
      if (invoiceRes.data) {
        const today = new Date();
        const due = new Date(invoiceRes.data.due_date);
        const diffTime = today.getTime() - due.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const daysPastDue = diffDays > 0 ? diffDays : 0;
        const agingBucket = getAgingBucket(daysPastDue);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: workflowData } = await supabase
            .from("collection_workflows")
            .select("*")
            .eq("aging_bucket", agingBucket)
            .eq("is_active", true)
            .or(`user_id.eq.${user.id},user_id.is.null`)
            .order("user_id", { ascending: false, nullsFirst: false })
            .limit(1)
            .single();

          if (workflowData) {
            setAssociatedWorkflow(workflowData);

            // Get workflow steps
            const { data: stepsData, count } = await supabase
              .from("collection_workflow_steps")
              .select("id, step_order, day_offset, channel, label, is_active", { count: "exact" })
              .eq("workflow_id", workflowData.id)
              .eq("is_active", true)
              .order("step_order", { ascending: true });

            setWorkflowSteps(stepsData || []);
            setWorkflowStepsCount(count || 0);
          }
        }
      }

      // Fetch CRM account if linked
      if (invoiceRes.data?.debtors?.crm_account_id) {
        const { data: crmData } = await supabase
          .from("crm_accounts")
          .select("*")
          .eq("id", invoiceRes.data.debtors.crm_account_id)
          .single();
        
        if (crmData) {
          setCrmAccount(crmData);
        }
      }

      // Fetch primary contact email from debtor_contacts
      if (invoiceRes.data?.debtor_id) {
        const { data: contactsData } = await supabase
          .from("debtor_contacts")
          .select("email, is_primary, outreach_enabled")
          .eq("debtor_id", invoiceRes.data.debtor_id)
          .eq("outreach_enabled", true)
          .order("is_primary", { ascending: false });

        if (contactsData && contactsData.length > 0) {
          const primary = contactsData.find(c => c.is_primary);
          setPrimaryContactEmail(primary?.email || contactsData[0]?.email || null);
        } else {
          setPrimaryContactEmail(invoiceRes.data.debtors?.email || null);
        }
      }
    } catch (error: any) {
      toast.error("Failed to load invoice details");
      navigate("/invoices");
    } finally {
      setLoading(false);
    }
  };

  const getDaysPastDue = (): number => {
    if (!invoice) return 0;
    const today = new Date();
    const due = new Date(invoice.due_date);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleStatusChange = async (newStatus: "Open" | "Paid" | "Disputed" | "Settled" | "InPaymentPlan" | "Canceled") => {
    if (!invoice) return;

    const performStatusChange = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Log override if integrated invoice
        if (isIntegratedInvoice && user) {
          await logOverrideAndUpdateInvoice(
            supabase,
            invoice.id,
            user.id,
            'status_change',
            invoice.status,
            newStatus,
            invoice.integration_source
          );
        }

        const { error } = await supabase
          .from("invoices")
          .update({ status: newStatus })
          .eq("id", id);

        if (error) throw error;
        
        const successMessage = isIntegratedInvoice
          ? `Status changed to ${newStatus}. This manual override has been logged.`
          : `Invoice marked as ${newStatus}`;
        toast.success(successMessage);
        fetchData();
      } catch (error: any) {
        toast.error(error.message || "Failed to update status");
      }
    };

    // Show warning for integrated invoices
    await checkStatusActionAndProceed(
      `Change Status to ${newStatus}`,
      `This will change the invoice status from "${invoice.status}" to "${newStatus}". This change should typically be made in the source system.`,
      performStatusChange
    );
  };

  const handleDraftAction = async (draftId: string, action: "approved" | "discarded") => {
    try {
      if (action === "discarded") {
        const { error } = await supabase
          .from("ai_drafts")
          .delete()
          .eq("id", draftId);

        if (error) throw error;
        toast.success("Draft deleted");
      } else {
        const { error } = await supabase
          .from("ai_drafts")
          .update({ status: action })
          .eq("id", draftId);

        if (error) throw error;
        toast.success("Draft approved");
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update draft");
    }
  };

  const handleGenerateDraft = async () => {
    setGeneratingDraft(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-outreach-draft", {
        body: {
          invoice_id: id,
          tone: generateTone,
          step_number: generateStep,
        },
      });

      if (error) throw error;
      
      // Close generate dialog and show preview with generated draft
      setGenerateDialogOpen(false);
      
      if (data?.email_draft) {
        setPreviewDraft({
          ...data.email_draft,
          invoice_number: invoice?.invoice_number,
        });
        setPreviewModalOpen(true);
      }
      
      toast.success("AI draft generated! Review and approve to send.");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate draft");
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleApproveAndSend = async (draftId: string) => {
    try {
      // First approve the draft
      const { error: approveError } = await supabase
        .from("ai_drafts")
        .update({ status: "approved" })
        .eq("id", draftId);
      
      if (approveError) throw approveError;

      // Then send it
      setSendingDraft(draftId);
      const { data, error } = await supabase.functions.invoke("send-ai-draft", {
        body: { draft_id: draftId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success("Email sent to " + (primaryContactEmail || invoice?.debtors?.email || "account contact") + "!");
      setPreviewModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingDraft(null);
    }
  };

  const handleEditDraft = (draft: AIDraft) => {
    setEditingDraft(draft);
    setEditSubject(draft.subject || "");
    setEditBody(draft.message_body);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDraft) return;

    try {
      const { error } = await supabase
        .from("ai_drafts")
        .update({
          subject: editSubject,
          message_body: editBody,
        })
        .eq("id", editingDraft.id);

      if (error) throw error;
      toast.success("Draft updated successfully");
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update draft");
    }
  };

  const handleSendDraft = async (draftId: string) => {
    setSendingDraft(draftId);
    try {
      const { data, error } = await supabase.functions.invoke("send-ai-draft", {
        body: { draft_id: draftId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(data?.message || "Draft sent successfully!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to send draft");
    } finally {
      setSendingDraft(null);
    }
  };

  const getAgingBucketLabel = (bucket: string): string => {
    const labels: Record<string, string> = {
      'current': 'Current (Not Due)',
      'dpd_1_30': '1-30 Days Past Due',
      'dpd_31_60': '31-60 Days Past Due',
      'dpd_61_90': '61-90 Days Past Due',
      'dpd_91_120': '91-120 Days Past Due',
      'dpd_121_150': '121-150 Days Past Due',
      'dpd_150_plus': '150+ Days Past Due',
    };
    return labels[bucket] || bucket;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Open: "bg-yellow-100 text-yellow-800",
      Paid: "bg-green-100 text-green-800",
      Disputed: "bg-red-100 text-red-800",
      Settled: "bg-blue-100 text-blue-800",
      InPaymentPlan: "bg-purple-100 text-purple-800",
      Canceled: "bg-gray-100 text-gray-800",
      PartiallyPaid: "bg-amber-100 text-amber-800",
      Credited: "bg-cyan-100 text-cyan-800",
      WrittenOff: "bg-orange-100 text-orange-800",
      Partial: "bg-amber-100 text-amber-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleCopyReferenceId = () => {
    if (invoice?.reference_id) {
      navigator.clipboard.writeText(invoice.reference_id);
      setCopiedRefId(true);
      toast.success("Reference ID copied to clipboard");
      setTimeout(() => setCopiedRefId(false), 2000);
    }
  };

  const handlePersonaCommand = async (command: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("process-persona-command", {
        body: {
          command,
          contextInvoiceId: invoice?.id,
          contextType: "invoice"
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Draft generated by ${data.persona}!`);
      
      // Show preview modal
      setPreviewDraft({
        ...data.draft,
        persona_name: data.persona,
        invoice_number: data.invoiceNumber
      });
      setPreviewModalOpen(true);
      
      // Refresh drafts
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to process command");
    }
  };

  const handleApproveDraft = async (draftId: string) => {
    await handleDraftAction(draftId, "approved");
  };

  const handleEditDraftFromPreview = async (draftId: string, subject: string, body: string) => {
    try {
      const { error } = await supabase
        .from("ai_drafts")
        .update({
          subject,
          message_body: body,
        })
        .eq("id", draftId);

      if (error) throw error;
      toast.success("Draft updated successfully");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update draft");
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    await handleDraftAction(draftId, "discarded");
  };

  const handleEditInvoice = () => {
    if (!invoice) return;
    setEditInvoiceNumber(invoice.invoice_number);
    setEditAmount(invoice.amount.toString());
    setEditIssueDate(invoice.issue_date);
    setEditPaymentTerms(invoice.payment_terms || "NET30");
    setEditNotes(invoice.notes || "");
    setEditInvoiceDialogOpen(true);
  };

  const handleSaveInvoiceEdit = async () => {
    if (!invoice) return;

    // Determine which fields changed for override logging
    const amountChanged = parseFloat(editAmount) !== invoice.amount;
    const dueDateWillChange = editIssueDate !== invoice.issue_date || editPaymentTerms !== invoice.payment_terms;

    const performSave = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Get payment terms days from the selected option
        const paymentTermsOptions = getPaymentTermsOptions();
        const selectedTerms = paymentTermsOptions.find(t => t.value === editPaymentTerms);
        const paymentTermsDays = selectedTerms?.days ?? 30;
        
        // Calculate due date from issue date + payment terms
        const dueDate = calculateDueDate(editIssueDate, paymentTermsDays);

        // Check if this is an integrated invoice that needs override logging
        const isIntegrated = invoice.integration_source && 
          ["stripe", "quickbooks", "xero"].includes(invoice.integration_source);

        if (isIntegrated) {
          // Log overrides for changed fields
          if (amountChanged) {
            await logOverrideAndUpdateInvoice(
              supabase,
              invoice.id,
              user.id,
              "amount",
              invoice.amount.toString(),
              editAmount,
              invoice.integration_source
            );
          }
          if (dueDateWillChange) {
            await logOverrideAndUpdateInvoice(
              supabase,
              invoice.id,
              user.id,
              "due_date",
              invoice.due_date,
              dueDate,
              invoice.integration_source
            );
          }
        }

        const { error } = await supabase
          .from("invoices")
          .update({
            invoice_number: editInvoiceNumber,
            amount: parseFloat(editAmount),
            issue_date: editIssueDate,
            due_date: dueDate,
            payment_terms: editPaymentTerms,
            notes: editNotes,
          })
          .eq("id", invoice.id);

        if (error) throw error;
        
        const successMessage = isIntegrated && (amountChanged || dueDateWillChange)
          ? "Override saved. This will be reset on next sync."
          : "Invoice updated successfully";
        toast.success(successMessage);
        setEditInvoiceDialogOpen(false);
        fetchData();
      } catch (error: any) {
        toast.error(error.message || "Failed to update invoice");
      }
    };

    // Check if we need to show override warning
    if (invoice.integration_source && ["stripe", "quickbooks", "xero"].includes(invoice.integration_source)) {
      if (amountChanged) {
        await checkAndProceed(
          "Invoice Amount",
          `$${formatAmount(invoice.amount)}`,
          `$${formatAmount(parseFloat(editAmount))}`,
          performSave
        );
        return;
      }
      if (dueDateWillChange) {
        const paymentTermsOptions = getPaymentTermsOptions();
        const selectedTerms = paymentTermsOptions.find(t => t.value === editPaymentTerms);
        const paymentTermsDays = selectedTerms?.days ?? 30;
        const newDueDate = calculateDueDate(editIssueDate, paymentTermsDays);
        await checkAndProceed(
          "Due Date",
          invoice.due_date,
          newDueDate,
          performSave
        );
        return;
      }
    } else if (invoice.integration_source === "csv_upload" && (amountChanged || dueDateWillChange)) {
      await checkAndProceed(
        amountChanged ? "Invoice Amount" : "Due Date",
        amountChanged ? `$${formatAmount(invoice.amount)}` : invoice.due_date,
        amountChanged ? `$${formatAmount(parseFloat(editAmount))}` : calculateDueDate(editIssueDate, getPaymentTermsOptions().find(t => t.value === editPaymentTerms)?.days ?? 30),
        performSave
      );
      return;
    }

    // No warning needed, proceed directly
    await performSave();
  };

  const handleApplyPayment = async () => {
    if (!invoice) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const performPayment = async () => {
      setApplyingPayment(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Check if this is an integrated invoice
        const isIntegrated = invoice.integration_source && 
          ["stripe", "quickbooks", "xero"].includes(invoice.integration_source);

        // Create payment record
        const { data: newPayment, error: paymentError } = await supabase
          .from("payments")
          .insert({
            user_id: user.id,
            debtor_id: invoice.debtor_id,
            payment_date: paymentDate,
            amount: amount,
            currency: invoice.currency || "USD",
            reference: paymentReference || null,
            invoice_number_hint: invoice.invoice_number,
            reconciliation_status: "manually_matched",
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Create payment-invoice link
        const { error: linkError } = await supabase
          .from("payment_invoice_links")
          .insert({
            payment_id: newPayment.id,
            invoice_id: invoice.id,
            amount_applied: amount,
            match_confidence: 1.0,
            match_method: "manual",
            status: "confirmed",
          });

        if (linkError) {
          console.error("Payment link error:", linkError);
        }

        // Calculate new outstanding amount
        const currentOutstanding = invoice.amount_outstanding ?? invoice.amount;
        const newOutstanding = Math.max(0, currentOutstanding - amount);
        
        // Determine new invoice status
        let newStatus = invoice.status;
        let newPaymentDate: string | null = null;
        
        if (newOutstanding <= 0) {
          newStatus = "Paid";
          newPaymentDate = paymentDate;
        } else if (invoice.status === "Open") {
          newStatus = "PartiallyPaid";
        }

        // Log override if integrated
        if (isIntegrated) {
          await logOverrideAndUpdateInvoice(
            supabase,
            invoice.id,
            user.id,
            "payment_applied",
            `$${formatAmount(currentOutstanding)} outstanding`,
            `Payment of $${formatAmount(amount)}`,
            invoice.integration_source
          );
        }

        // Update invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            amount_outstanding: newOutstanding,
            status: newStatus as any,
            payment_date: newPaymentDate,
            payment_method: paymentMethod || null,
          })
          .eq("id", invoice.id);

        if (invoiceError) throw invoiceError;

        // Log payment activity to collection_activities for AI context
        await supabase
          .from("collection_activities")
          .insert({
            user_id: user.id,
            debtor_id: invoice.debtor_id,
            invoice_id: invoice.id,
            activity_type: "payment_received",
            channel: "system",
            direction: "inbound",
            subject: `Payment of $${formatAmount(amount)} received`,
            message_body: `Payment received for Invoice #${invoice.invoice_number}. Amount: $${formatAmount(amount)}${paymentMethod ? `. Method: ${paymentMethod}` : ""}${paymentReference ? `. Reference: ${paymentReference}` : ""}. ${newOutstanding <= 0 ? "Invoice fully paid." : `Remaining balance: $${formatAmount(newOutstanding)}`}`,
            metadata: {
              payment_id: newPayment.id,
              payment_amount: amount,
              payment_method: paymentMethod || null,
              payment_reference: paymentReference || null,
              previous_outstanding: currentOutstanding,
              new_outstanding: newOutstanding,
              invoice_status: newStatus,
              payment_date: paymentDate,
            },
            sent_at: new Date().toISOString(),
          });

        // Create transaction record
        await supabase
          .from("invoice_transactions")
          .insert({
            invoice_id: invoice.id,
            user_id: user.id,
            transaction_type: "payment",
            amount: amount,
            balance_after: newOutstanding,
            payment_method: paymentMethod || null,
            reference_number: paymentReference || null,
            transaction_date: paymentDate,
            notes: `Payment applied. ${newOutstanding <= 0 ? 'Invoice fully paid.' : `Remaining: $${formatAmount(newOutstanding)}`}`,
            created_by: user.id,
          });

        const successMessage = isIntegrated
          ? `Override saved. Payment of $${formatAmount(amount)} applied. This will be reset on next sync.`
          : newOutstanding <= 0 
            ? "Payment applied - Invoice marked as Paid" 
            : `Payment of $${formatAmount(amount)} applied - $${formatAmount(newOutstanding)} remaining`;
        
        toast.success(successMessage);
        
        setApplyPaymentOpen(false);
        setPaymentAmount("");
        setPaymentMethod("");
        setPaymentReference("");
        setTransactionRefreshKey(prev => prev + 1);
        fetchData();
      } catch (error: any) {
        toast.error(error.message || "Failed to apply payment");
      } finally {
        setApplyingPayment(false);
      }
    };

    // IMPORTANT: For integrated invoices (Stripe/QuickBooks/Xero), we already showed a mandatory
    // status-action warning before opening this modal. Showing a second nested AlertDialog here
    // can leave the UI stuck on an overlay ("black screen") due to stacked portals.
    // We still keep the CSV soft warning here.
    if (invoice.integration_source === "csv_upload") {
      await checkAndProceed(
        "Apply Payment",
        `Outstanding: $${formatAmount(invoice.amount_outstanding ?? invoice.amount)}`,
        `Payment: $${formatAmount(amount)}`,
        performPayment
      );
    } else {
      await performPayment();
    }
  };

  const handleApplyCreditWriteOff = async () => {
    if (!invoice) return;
    
    const amount = parseFloat(creditWriteOffAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!creditWriteOffReason.trim()) {
      toast.error("Please enter a reason");
      return;
    }

    const performCreditWriteOff = async () => {
      setApplyingCreditWriteOff(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Check if this is an integrated invoice
        const isIntegrated = invoice.integration_source && 
          ["stripe", "quickbooks", "xero"].includes(invoice.integration_source);

        // Calculate new outstanding amount
        const currentOutstanding = invoice.amount_outstanding ?? invoice.amount;
        const newOutstanding = Math.max(0, currentOutstanding - amount);
        
        // Determine new invoice status
        let newStatus = invoice.status;
        if (newOutstanding <= 0) {
          newStatus = creditWriteOffType === 'credit' ? 'Credited' : 'WrittenOff';
        }

        // Log override if integrated
        if (isIntegrated) {
          await logOverrideAndUpdateInvoice(
            supabase,
            invoice.id,
            user.id,
            creditWriteOffType === 'credit' ? 'credit_applied' : 'write_off_applied',
            `$${currentOutstanding.toLocaleString()} outstanding`,
            `${creditWriteOffType === 'credit' ? 'Credit' : 'Write-off'} of $${amount.toLocaleString()}`,
            invoice.integration_source
          );
        }

        // Create transaction record
        const { error: txError } = await supabase
          .from("invoice_transactions")
          .insert({
            invoice_id: invoice.id,
            user_id: user.id,
            transaction_type: creditWriteOffType,
            amount: amount,
            balance_after: newOutstanding,
            reason: creditWriteOffReason,
            notes: creditWriteOffNotes || null,
            transaction_date: new Date().toISOString().split("T")[0],
            created_by: user.id,
          });

        if (txError) throw txError;

        // Update invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            amount_outstanding: newOutstanding,
            status: newStatus as any,
            notes: `${invoice.notes || ''}\n[${new Date().toLocaleDateString()}] ${creditWriteOffType === 'credit' ? 'Credit' : 'Write-off'}: $${amount.toLocaleString()} - ${creditWriteOffReason}${creditWriteOffNotes ? `. ${creditWriteOffNotes}` : ''}`.trim(),
          })
          .eq("id", invoice.id);

        if (invoiceError) throw invoiceError;

        // Log activity
        await supabase
          .from("collection_activities")
          .insert({
            user_id: user.id,
            debtor_id: invoice.debtor_id,
            invoice_id: invoice.id,
            activity_type: creditWriteOffType === 'credit' ? 'credit_applied' : 'write_off_applied',
            channel: "system",
            direction: "inbound",
            subject: `${creditWriteOffType === 'credit' ? 'Credit' : 'Write-off'} of $${amount.toLocaleString()} applied`,
            message_body: `${creditWriteOffType === 'credit' ? 'Credit' : 'Write-off'} applied for Invoice #${invoice.invoice_number}. Amount: $${amount.toLocaleString()}. Reason: ${creditWriteOffReason}${creditWriteOffNotes ? `. Notes: ${creditWriteOffNotes}` : ''}. ${newOutstanding <= 0 ? 'Invoice balance cleared.' : `Remaining balance: $${newOutstanding.toLocaleString()}`}`,
            metadata: {
              transaction_type: creditWriteOffType,
              amount: amount,
              reason: creditWriteOffReason,
              notes: creditWriteOffNotes || null,
              previous_outstanding: currentOutstanding,
              new_outstanding: newOutstanding,
              invoice_status: newStatus,
            },
            sent_at: new Date().toISOString(),
          });

        const successMessage = isIntegrated
          ? `Override saved. ${creditWriteOffType === 'credit' ? 'Credit' : 'Write-off'} applied. This will be reset on next sync.`
          : `${creditWriteOffType === 'credit' ? 'Credit' : 'Write-off'} of $${amount.toLocaleString()} applied${newOutstanding <= 0 ? ' - Invoice balance cleared' : ` - $${newOutstanding.toLocaleString()} remaining`}`;

        toast.success(successMessage);
        
        setCreditWriteOffOpen(false);
        setCreditWriteOffAmount("");
        setCreditWriteOffReason("");
        setCreditWriteOffNotes("");
        setTransactionRefreshKey(prev => prev + 1);
        fetchData();
      } catch (error: any) {
        toast.error(error.message || `Failed to apply ${creditWriteOffType === 'credit' ? 'credit' : 'write-off'}`);
      } finally {
        setApplyingCreditWriteOff(false);
      }
    };

    // See note in handleApplyPayment(): avoid a second nested warning for integrated invoices.
    const actionLabel = creditWriteOffType === 'credit' ? 'Credit' : 'Write-off';
    if (invoice.integration_source === "csv_upload") {
      await checkAndProceed(
        `Apply ${actionLabel}`,
        `Outstanding: $${(invoice.amount_outstanding ?? invoice.amount).toLocaleString()}`,
        `${actionLabel}: $${amount.toLocaleString()}`,
        performCreditWriteOff
      );
    } else {
      await performCreditWriteOff();
    }
  };

  const [generatingPaymentMessage, setGeneratingPaymentMessage] = useState(false);

  const handleSendPaymentAcknowledgment = async () => {
    if (!invoice) return;
    
    setGeneratingPaymentMessage(true);
    try {
      // Get payment history for context
      const { data: paymentActivities } = await supabase
        .from("collection_activities")
        .select("*")
        .eq("invoice_id", invoice.id)
        .eq("activity_type", "payment_received")
        .order("sent_at", { ascending: false })
        .limit(5);

      const paymentContext = paymentActivities?.map(p => {
        const meta = p.metadata as Record<string, any> | null;
        return {
          amount: meta?.payment_amount,
          date: meta?.payment_date,
          method: meta?.payment_method,
          remaining: meta?.new_outstanding,
        };
      }) || [];

      // Use AI to generate contextual payment acknowledgment
      const { data, error } = await supabase.functions.invoke("process-persona-command", {
        body: {
          command: invoice.status === "Paid" || (invoice.amount_outstanding ?? invoice.amount) <= 0
            ? `Generate a warm thank-you email acknowledging full payment received for invoice #${invoice.invoice_number}. The customer has paid the full amount of $${invoice.amount.toLocaleString()}. Express gratitude for their prompt payment and maintaining a good business relationship.`
            : `Generate a professional email acknowledging a partial payment received for invoice #${invoice.invoice_number}. Current outstanding balance is $${(invoice.amount_outstanding ?? invoice.amount).toLocaleString()} out of original $${invoice.amount.toLocaleString()}. Thank them for the payment and gently remind about the remaining balance.`,
          contextInvoiceId: invoice.id, // Pass UUID, not invoice_number
          // IMPORTANT: tag this draft so sending is allowed even if the invoice is Paid
          contextType: "payment_acknowledgment",
          paymentContext: {
            invoiceAmount: invoice.amount,
            outstandingAmount: invoice.amount_outstanding ?? invoice.amount,
            isPaidInFull: invoice.status === "Paid" || (invoice.amount_outstanding ?? invoice.amount) <= 0,
            recentPayments: paymentContext,
            companyName: invoice.debtors?.company_name,
          },
          reasoning: true,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Payment acknowledgment draft generated by ${data.persona}!`);
      
      // Show preview modal
      setPreviewDraft({
        ...data.draft,
        persona_name: data.persona,
        invoice_number: data.invoiceNumber,
        context_type: "payment_acknowledgment",
      });
      setPreviewModalOpen(true);
      
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate payment acknowledgment");
    } finally {
      setGeneratingPaymentMessage(false);
    }
  };

  if (loading || !invoice) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const daysPastDue = getDaysPastDue();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/invoices")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-primary">Invoice #{invoice.invoice_number}</h1>
              {invoice.external_invoice_id && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  SS Invoice #: <span className="font-mono">{invoice.external_invoice_id}</span>
                </p>
              )}
              <p className="text-muted-foreground mt-1">{invoice.debtors?.company_name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-mono text-muted-foreground">{invoice.reference_id}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleCopyReferenceId}
                >
                  {copiedRefId ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Outreach Pause Toggle */}
            <Button 
              variant={invoice.outreach_paused ? "default" : "outline"} 
              onClick={async () => {
                const newPaused = !invoice.outreach_paused;
                const { error } = await supabase
                  .from("invoices")
                  .update({ 
                    outreach_paused: newPaused,
                    outreach_paused_at: newPaused ? new Date().toISOString() : null
                  })
                  .eq("id", id);
                if (error) {
                  toast.error("Failed to update outreach status");
                } else {
                  toast.success(newPaused ? "Outreach paused for this invoice" : "Outreach resumed for this invoice");
                  fetchData();
                }
              }}
              className={invoice.outreach_paused ? "bg-orange-600 hover:bg-orange-700" : ""}
              disabled={invoice.debtors?.outreach_paused === true}
              title={invoice.debtors?.outreach_paused ? "Account-level outreach is paused" : undefined}
            >
              {invoice.outreach_paused ? (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Resume Outreach
                </>
              ) : (
                <>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pause Outreach
                </>
              )}
            </Button>
            <Button onClick={handleEditInvoice}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Invoice
            </Button>
          </div>
        </div>

        {/* Paused Alert Banners */}
        {(invoice.outreach_paused || invoice.debtors?.outreach_paused) && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
            <PauseCircle className="h-5 w-5 text-orange-600 shrink-0" />
            <div>
              <p className="font-medium text-orange-800">Outreach Paused</p>
              <p className="text-sm text-orange-700">
                {invoice.debtors?.outreach_paused 
                  ? "All outreach for this account is paused. Resume at the account level to enable outreach."
                  : "Automated outreach for this invoice is paused. Click \"Resume Outreach\" to restart."}
              </p>
            </div>
          </div>
        )}

        {/* Integration Source Banner */}
        <IntegrationSourceBanner
          integrationSource={invoice.integration_source}
          integrationUrl={invoice.integration_url || invoice.stripe_hosted_url}
          hasLocalOverrides={invoice.has_local_overrides || false}
          overrideCount={invoice.override_count || 0}
          lastSyncedAt={invoice.last_synced_at}
          invoiceId={invoice.id}
          onSync={() => fetchData()}
          onDiscardOverrides={() => fetchData()}
        />

        {/* Main Content Grid - 3 columns on large screens */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Invoice Details & Status */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Show original amount if available and different from current */}
                {invoice.amount_original && invoice.amount_original !== invoice.amount && (
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Original Amount</p>
                    <p className="text-lg font-medium text-muted-foreground line-through">
                      {formatCurrency(invoice.amount_original, invoice.currency || 'USD')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {invoice.amount_original && invoice.amount_original !== invoice.amount ? 'Current Amount' : 'Amount'}
                  </p>
                  <p className="text-xl font-bold">
                    {formatCurrency(invoice.amount, invoice.currency || 'USD')}
                  </p>
                </div>
                {invoice.amount_outstanding !== null && invoice.amount_outstanding !== invoice.amount && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
                    <p className={`text-lg font-semibold ${invoice.amount_outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatCurrency(invoice.amount_outstanding, invoice.currency || 'USD')}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Issue Date</p>
                    <p className="text-sm font-medium">{new Date(invoice.issue_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="text-sm font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Days Past Due</p>
                    <p className={`text-lg font-bold ${
                      daysPastDue === 0 ? "text-green-600" : daysPastDue <= 30 ? "text-yellow-600" : daysPastDue <= 60 ? "text-orange-600" : "text-red-600"
                    }`}>
                      {daysPastDue === 0 ? "Current" : daysPastDue}
                    </p>
                  </div>
                </div>
                {invoice.payment_terms && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Payment Terms</p>
                    <p className="text-sm font-medium">{invoice.payment_terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Status Actions</CardTitle>
                {isIntegratedInvoice && (
                  <CardDescription className="flex items-start gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-amber-800 dark:text-amber-200">
                      This is an integrated invoice. Payments and status changes should be recorded in the source system for accurate sync.
                    </span>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    if (isIntegratedInvoice) {
                      checkStatusActionAndProceed(
                        "Apply Payment",
                        `You are about to manually record a payment of an outstanding amount. This action should typically be done in the source system to ensure accurate sync.`,
                        () => setApplyPaymentOpen(true)
                      );
                    } else {
                      setApplyPaymentOpen(true);
                    }
                  }}
                  disabled={invoice.status === "Paid"}
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                  Apply Payment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    if (isIntegratedInvoice) {
                      checkStatusActionAndProceed(
                        "Apply Credit",
                        `You are about to apply a credit to this invoice. This action should typically be done in the source system to ensure accurate sync.`,
                        () => {
                          setCreditWriteOffType('credit');
                          setCreditWriteOffOpen(true);
                        }
                      );
                    } else {
                      setCreditWriteOffType('credit');
                      setCreditWriteOffOpen(true);
                    }
                  }}
                  disabled={invoice.status === "Paid" || invoice.status === "Credited"}
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  Apply Credit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    if (isIntegratedInvoice) {
                      checkStatusActionAndProceed(
                        "Write Off",
                        `You are about to write off this invoice. This action should typically be done in the source system to ensure accurate sync.`,
                        () => {
                          setCreditWriteOffType('write_off');
                          setCreditWriteOffOpen(true);
                        }
                      );
                    } else {
                      setCreditWriteOffType('write_off');
                      setCreditWriteOffOpen(true);
                    }
                  }}
                  disabled={invoice.status === "Paid" || invoice.status === "WrittenOff"}
                >
                  <FileX className="h-3.5 w-3.5 mr-1.5" />
                  Write Off
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleStatusChange("Disputed")}
                  disabled={invoice.status === "Disputed"}
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Disputed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleStatusChange("Settled")}
                  disabled={invoice.status === "Settled"}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Settled
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start col-span-2"
                  onClick={() => handleStatusChange("Canceled")}
                  disabled={invoice.status === "Canceled"}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Invoice
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Account Info & Payment Info */}
          <div className="space-y-6">
            <Card className="h-auto">
              <CardHeader className="pb-3">
                <CardTitle>Account Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="font-medium">{invoice.debtors?.company_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact Email</p>
                  <p className="text-sm font-medium">{primaryContactEmail || invoice.debtors?.email || "—"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/debtors/${invoice.debtor_id}`)}
                >
                  View Account Details
                </Button>
              </CardContent>
            </Card>

            {/* Payment Information - moved here to fill space */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.paid_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Paid Date</p>
                    <p className="font-medium">{new Date(invoice.paid_date).toLocaleDateString()}</p>
                  </div>
                )}
                {invoice.payment_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Date</p>
                    <p className="font-medium">{new Date(invoice.payment_date).toLocaleDateString()}</p>
                  </div>
                )}
                {invoice.payment_method && (
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{invoice.payment_method}</p>
                  </div>
                )}
                {invoice.promise_to_pay_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Promise to Pay Date</p>
                    <p className="font-medium">{new Date(invoice.promise_to_pay_date).toLocaleDateString()}</p>
                  </div>
                )}
                {invoice.promise_to_pay_amount !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Promise to Pay Amount</p>
                    <p className="font-medium">${invoice.promise_to_pay_amount.toLocaleString()}</p>
                  </div>
                )}
                {!invoice.paid_date && !invoice.payment_date && !invoice.payment_method && 
                 !invoice.promise_to_pay_date && invoice.promise_to_pay_amount === null && (
                  <p className="text-sm text-muted-foreground">No payment information available</p>
                )}
                {(invoice.payment_date || invoice.paid_date || invoice.status === "Paid" || invoice.status === "PartiallyPaid") && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleSendPaymentAcknowledgment}
                      disabled={generatingPaymentMessage}
                    >
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      {generatingPaymentMessage ? "Generating..." : "Send Payment Acknowledgment"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      AI will compose a contextual thank-you message
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Collection Intelligence */}
          <div className="space-y-6">
            <InvoiceWorkflowCard
              daysPastDue={daysPastDue}
              workflow={associatedWorkflow}
              workflowSteps={workflowSteps}
              isActiveInvoice={invoice.status === 'Open' || invoice.status === 'InPaymentPlan'}
              dueDate={invoice.due_date}
              invoiceId={invoice.id}
              accountOutreachEnabled={invoice.debtors?.account_outreach_enabled ?? false}
            />
            
            {/* Outreach Timeline */}
            <OutreachTimeline
              invoiceId={invoice.id}
              invoiceDueDate={invoice.due_date}
              agingBucket={invoice.aging_bucket}
            />
          </div>
        </div>

        {/* Additional Info - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {invoice.external_invoice_id && (
                <div>
                  <p className="text-xs text-muted-foreground">SS Invoice #</p>
                  <p className="font-medium text-sm break-all">{invoice.external_invoice_id}</p>
                </div>
              )}
              {invoice.source_system && (
                <div>
                  <p className="text-xs text-muted-foreground">Source System</p>
                  <p className="font-medium">{invoice.source_system}</p>
                </div>
              )}
              {invoice.external_link && (
                <div>
                  <p className="text-xs text-muted-foreground">External Link</p>
                  <a 
                    href={invoice.external_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    View in {invoice.source_system || 'external system'}
                  </a>
                </div>
              )}
              {invoice.product_description && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Product/Service Description</p>
                  <p className="text-sm">{invoice.product_description}</p>
                </div>
              )}
              {invoice.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{invoice.notes}</p>
                </div>
              )}
              {invoice.created_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-xs">{new Date(invoice.created_at).toLocaleString()}</p>
                </div>
              )}
              {invoice.updated_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-xs">{new Date(invoice.updated_at).toLocaleString()}</p>
                </div>
              )}
              {invoice.is_archived && (
                <div>
                  <Badge variant="secondary">Archived</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History Log */}
        <InvoiceTransactionLog 
          invoiceId={invoice.id} 
          currency={invoice.currency || 'USD'}
          key={transactionRefreshKey}
        />

        <Alert className="border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Messages are sent from your business. Recouply.ai does not act as a collection agency and does not collect on your behalf.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Associated AI Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            {associatedWorkflow ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {(() => {
                      const persona = getPersonaByDaysPastDue(daysPastDue);
                      return persona ? (
                        <PersonaAvatar persona={persona} size="lg" />
                      ) : null;
                    })()}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Workflow Name</p>
                      <p className="font-medium text-lg">{associatedWorkflow.name}</p>
                    </div>
                    {(() => {
                      const persona = getPersonaByDaysPastDue(daysPastDue);
                      return persona ? (
                        <div>
                          <p className="text-sm text-muted-foreground">AI Agent</p>
                          <p className="font-medium">{persona.name}</p>
                          <p className="text-xs text-muted-foreground italic mt-1">"{persona.tone}"</p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                {associatedWorkflow.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{associatedWorkflow.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Aging Bucket</p>
                  <p className="font-medium">{getAgingBucketLabel(associatedWorkflow.aging_bucket)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Steps</p>
                  <p className="font-medium">{workflowStepsCount} steps</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      associatedWorkflow.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {associatedWorkflow.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/settings/ai-workflows")}
                  >
                    View All Workflows
                  </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  No workflow assigned for this aging bucket.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/settings/ai-workflows")}
                >
                  Configure Workflows
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <TasksSummaryCard 
          tasks={tasks} 
          title="Collection Tasks"
        />
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Related Tasks</CardTitle>
              <Button onClick={() => setIsCreateTaskOpen(true)} size="sm">
                Create Invoice Task
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>AI Collection Actions</CardTitle>
                  <CardDescription className="mt-1">
                    Generate and send AI-powered collection messages
                  </CardDescription>
                </div>
              </div>
              <Button 
                onClick={() => setGenerateDialogOpen(true)} 
                disabled={generatingDraft}
                size="sm"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generatingDraft ? "Generating..." : "Generate Draft"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="history" className="text-sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Outreach History ({outreach.length})
                </TabsTrigger>
                <TabsTrigger value="drafts" className="text-sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Pending Drafts ({drafts.filter(d => d.status === 'pending_approval').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4 space-y-3">
                {outreach.length > 0 && (
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search outreach..."
                      value={outreachSearch}
                      onChange={(e) => {
                        setOutreachSearch(e.target.value);
                        setOutreachPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                )}
                
                {filteredOutreach.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {outreachSearch ? "No matching outreach records" : "No outreach history yet"}
                    </p>
                    <p className="text-xs mt-1">
                      {outreachSearch ? "Try a different search term" : "Generate a draft to get started"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedOutreach.map((log) => (
                      <OutreachSummaryRow
                        key={log.id}
                        channel={log.channel}
                        subject={log.subject}
                        status={log.status}
                        sentAt={log.sent_at}
                        createdAt={log.created_at}
                        activityType={log.activity_type}
                        onClick={() => {
                          setSelectedOutreach(log as OutreachRecord);
                          setOutreachDetailOpen(true);
                        }}
                      />
                    ))}

                    {/* Pagination */}
                    {totalOutreachPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOutreachPage(p => Math.max(1, p - 1))}
                          disabled={outreachPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground px-3">
                          {outreachPage} / {totalOutreachPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOutreachPage(p => Math.min(totalOutreachPages, p + 1))}
                          disabled={outreachPage === totalOutreachPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="drafts" className="mt-4">
                {drafts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No drafts yet</p>
                    <p className="text-xs mt-1">Click "Generate Draft" to create one</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drafts.map((draft) => (
                      <div key={draft.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {draft.ai_agent_personas && (
                              <PersonaAvatar persona={draft.ai_agent_personas.name} size="sm" />
                            )}
                            <div>
                              <p className="font-medium text-sm">
                                Step {draft.step_number} • {draft.channel.toUpperCase()}
                              </p>
                              {draft.subject && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {draft.subject}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            draft.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : draft.status === "discarded"
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {draft.status === 'pending_approval' ? 'Pending' : draft.status}
                          </span>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-md mb-3">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {draft.message_body}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {draft.status === "pending_approval" ? (
                            <>
                              <Button 
                                onClick={() => handleSendDraft(draft.id)}
                                disabled={sendingDraft === draft.id}
                                size="sm"
                                className="flex-1"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {sendingDraft === draft.id ? "Sending..." : "Approve & Send"}
                              </Button>
                              <Button variant="outline" onClick={() => handleEditDraft(draft)} size="sm">
                                Edit
                              </Button>
                            </>
                          ) : draft.status === "approved" ? (
                            <Button 
                              onClick={() => handleSendDraft(draft.id)}
                              disabled={sendingDraft === draft.id}
                              size="sm"
                              variant="secondary"
                              className="flex-1"
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              {sendingDraft === draft.id ? "Sending..." : "Resend"}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDraftAction(draft.id, "discarded")}
                            title="Delete draft"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">AI Assistant</p>
              <PersonaCommandInput
                placeholder="Ask Sam, James, Katy, Troy, or Gotti… e.g., 'Send a reminder for this invoice'"
                onSubmit={handlePersonaCommand}
                contextType="invoice"
                contextId={invoice?.id}
                suggestions={[
                  "Send an email for this invoice",
                  "Draft a friendly reminder",
                  "Generate a firm follow-up",
                  `Ask ${getPersonaByDaysPastDue(daysPastDue)?.name || 'the agent'} to send a message`,
                  "Create an urgent follow-up"
                ]}
              />
            </div>
          </CardContent>
        </Card>

        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate AI Collection Draft</DialogTitle>
              <DialogDescription>
                Generate a personalized collection email for this invoice.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Payment Context Summary */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoice Amount:</span>
                    <span className="font-medium">${invoice?.amount?.toLocaleString()} {invoice?.currency || 'USD'}</span>
                  </div>
                  {invoice?.amount_outstanding !== null && invoice?.amount_outstanding !== invoice?.amount && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payments Applied:</span>
                        <span className="font-medium text-green-600">
                          -${((invoice?.amount || 0) - (invoice?.amount_outstanding || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                        <span>Balance Due:</span>
                        <span className="text-destructive">${invoice?.amount_outstanding?.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(invoice?.amount_outstanding === null || invoice?.amount_outstanding === invoice?.amount) && (
                    <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                      <span>Balance Due:</span>
                      <span className="text-destructive">${invoice?.amount?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Send To:</span>
                    <span className="font-medium">{primaryContactEmail || invoice?.debtors?.email || "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Select
                  value={generateTone}
                  onValueChange={(value: "friendly" | "neutral" | "firm") => setGenerateTone(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="firm">Firm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Step Number</Label>
                <Input
                  type="number"
                  min="1"
                  value={generateStep}
                  onChange={(e) => setGenerateStep(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateDraft} disabled={generatingDraft}>
                <Sparkles className="h-4 w-4 mr-2" />
                {generatingDraft ? "Generating..." : "Generate Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Draft</DialogTitle>
              <DialogDescription>
                Modify the subject and message body before sending.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingDraft?.channel === "email" && (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Message Body</Label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Message content"
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DraftPreviewModal
          open={previewModalOpen}
          onOpenChange={setPreviewModalOpen}
          draft={previewDraft}
          onApprove={handleApproveAndSend}
          onEdit={handleEditDraftFromPreview}
          onDiscard={handleDiscardDraft}
        />

        <Dialog open={editInvoiceDialogOpen} onOpenChange={setEditInvoiceDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Invoice</DialogTitle>
              <DialogDescription>Update invoice details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invoice-number">Invoice Number</Label>
                <Input
                  id="invoice-number"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="issue-date">Issue Date</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={editIssueDate}
                  onChange={(e) => setEditIssueDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="payment-terms">Payment Terms</Label>
                <Select value={editPaymentTerms} onValueChange={setEditPaymentTerms}>
                  <SelectTrigger id="payment-terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getPaymentTermsOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this invoice"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditInvoiceDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveInvoiceEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CreateTaskModal
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          debtorId={invoice?.debtor_id || ""}
          invoiceId={invoice?.id}
          level="invoice"
          onTaskCreated={() => fetchData()}
        />

        <OutreachDetailModal
          open={outreachDetailOpen}
          onOpenChange={setOutreachDetailOpen}
          outreach={selectedOutreach}
          showInvoiceLink={false}
        />

        <Dialog open={applyPaymentOpen} onOpenChange={setApplyPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Payment</DialogTitle>
              <DialogDescription>
                Record a payment for Invoice #{invoice?.invoice_number}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice Amount:</span>
                  <span className="font-medium">${invoice?.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Outstanding:</span>
                  <span className="font-medium">
                    ${(invoice?.amount_outstanding ?? invoice?.amount)?.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Payment Amount *</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-date">Payment Date *</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Reference / Check Number</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., Check #1234"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyPaymentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyPayment} disabled={applyingPayment || !paymentAmount}>
                {applyingPayment ? "Applying..." : "Apply Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Credit/Write-Off Dialog */}
        <Dialog open={creditWriteOffOpen} onOpenChange={setCreditWriteOffOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {creditWriteOffType === 'credit' ? 'Apply Credit' : 'Write Off Invoice'}
              </DialogTitle>
              <DialogDescription>
                {creditWriteOffType === 'credit' 
                  ? `Apply a credit to Invoice #${invoice?.invoice_number}` 
                  : `Write off amount for Invoice #${invoice?.invoice_number}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice Amount:</span>
                  <span className="font-medium">${invoice?.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Outstanding:</span>
                  <span className="font-medium">
                    ${(invoice?.amount_outstanding ?? invoice?.amount)?.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="credit-amount">
                  {creditWriteOffType === 'credit' ? 'Credit Amount' : 'Write-Off Amount'} *
                </Label>
                <Input
                  id="credit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(invoice?.amount_outstanding ?? invoice?.amount) || undefined}
                  value={creditWriteOffAmount}
                  onChange={(e) => setCreditWriteOffAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="credit-reason">Reason *</Label>
                <Select value={creditWriteOffReason} onValueChange={setCreditWriteOffReason}>
                  <SelectTrigger id="credit-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditWriteOffType === 'credit' ? (
                      <>
                        <SelectItem value="Pricing adjustment">Pricing Adjustment</SelectItem>
                        <SelectItem value="Service credit">Service Credit</SelectItem>
                        <SelectItem value="Billing error">Billing Error</SelectItem>
                        <SelectItem value="Promotional credit">Promotional Credit</SelectItem>
                        <SelectItem value="Customer goodwill">Customer Goodwill</SelectItem>
                        <SelectItem value="Duplicate charge">Duplicate Charge</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Uncollectible">Uncollectible</SelectItem>
                        <SelectItem value="Customer bankruptcy">Customer Bankruptcy</SelectItem>
                        <SelectItem value="Customer out of business">Customer Out of Business</SelectItem>
                        <SelectItem value="Statute of limitations">Statute of Limitations</SelectItem>
                        <SelectItem value="Cost exceeds recovery">Cost Exceeds Recovery</SelectItem>
                        <SelectItem value="Settlement agreed">Settlement Agreed</SelectItem>
                        <SelectItem value="Disputed - unresolved">Disputed - Unresolved</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="credit-notes">Additional Notes</Label>
                <Textarea
                  id="credit-notes"
                  value={creditWriteOffNotes}
                  onChange={(e) => setCreditWriteOffNotes(e.target.value)}
                  placeholder={`Add any additional notes about this ${creditWriteOffType === 'credit' ? 'credit' : 'write-off'}...`}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreditWriteOffOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleApplyCreditWriteOff} 
                disabled={applyingCreditWriteOff || !creditWriteOffAmount || !creditWriteOffReason}
                variant={creditWriteOffType === 'write_off' ? 'destructive' : 'default'}
              >
                {applyingCreditWriteOff 
                  ? "Applying..." 
                  : creditWriteOffType === 'credit' ? 'Apply Credit' : 'Write Off'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Override Warning Dialogs */}
        <CSVWarningDialog />
        <IntegrationWarningDialog />
        <StatusActionWarningDialog />
      </div>
    </Layout>
  );
};

export default InvoiceDetail;
