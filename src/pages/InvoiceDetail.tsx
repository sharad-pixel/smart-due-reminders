import { useState, useEffect } from "react";
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
import { ArrowLeft, CheckCircle, AlertCircle, XCircle, Info, Copy, Check, Sparkles, Edit, Plus, DollarSign } from "lucide-react";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { PersonaCommandInput } from "@/components/PersonaCommandInput";
import { DraftPreviewModal } from "@/components/DraftPreviewModal";
import { TasksSummaryCard } from "@/components/TasksSummaryCard";
import type { CollectionTask } from "@/hooks/useCollectionTasks";
import { getPaymentTermsOptions, calculateDueDate } from "@/lib/paymentTerms";
import CreateTaskModal from "@/components/CreateTaskModal";
import { InvoiceContextPreview } from "@/components/InvoiceContextPreview";

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding: number | null;
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
  debtors?: { 
    name: string; 
    email: string;
    crm_account_id: string | null;
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
  delivery_metadata: any;
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
  const [associatedWorkflow, setAssociatedWorkflow] = useState<CollectionWorkflow | null>(null);
  const [workflowStepsCount, setWorkflowStepsCount] = useState<number>(0);
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
  const [selectedOutreach, setSelectedOutreach] = useState<OutreachLog | null>(null);
  const [outreachDetailOpen, setOutreachDetailOpen] = useState(false);
  const [applyPaymentOpen, setApplyPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [applyingPayment, setApplyingPayment] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

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
      const [invoiceRes, outreachRes, draftsRes, tasksRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, debtors(name, email, crm_account_id)")
          .eq("id", id)
          .single(),
        supabase
          .from("outreach_logs")
          .select("*")
          .eq("invoice_id", id)
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

      setOutreach(outreachRes.data || []);
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

            // Get workflow steps count
            const { count } = await supabase
              .from("collection_workflow_steps")
              .select("*", { count: "exact", head: true })
              .eq("workflow_id", workflowData.id)
              .eq("is_active", true);

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
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Invoice marked as ${newStatus}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
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
      
      toast.success("Email sent to " + (invoice?.debtors?.email || "account contact") + "!");
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
          contextInvoiceId: invoice?.invoice_number,
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

    try {
      // Get payment terms days from the selected option
      const paymentTermsOptions = getPaymentTermsOptions();
      const selectedTerms = paymentTermsOptions.find(t => t.value === editPaymentTerms);
      const paymentTermsDays = selectedTerms?.days ?? 30;
      
      // Calculate due date from issue date + payment terms
      const dueDate = calculateDueDate(editIssueDate, paymentTermsDays);

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
      toast.success("Invoice updated successfully");
      setEditInvoiceDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update invoice");
    }
  };

  const handleApplyPayment = async () => {
    if (!invoice) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    setApplyingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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

      toast.success(
        newOutstanding <= 0 
          ? "Payment applied - Invoice marked as Paid" 
          : `Payment of $${amount.toLocaleString()} applied - $${newOutstanding.toLocaleString()} remaining`
      );
      
      setApplyPaymentOpen(false);
      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentReference("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to apply payment");
    } finally {
      setApplyingPayment(false);
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
              <p className="text-muted-foreground mt-1">{invoice.debtors?.name}</p>
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
          <Button onClick={handleEditInvoice}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Invoice
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">
                  {invoice.currency || 'USD'} ${invoice.amount.toLocaleString()}
                </p>
              </div>
              {invoice.amount_outstanding !== null && invoice.amount_outstanding !== invoice.amount && (
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className={`text-lg font-semibold ${invoice.amount_outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    ${invoice.amount_outstanding.toLocaleString()}
                  </p>
                </div>
              )}
              {invoice.subtotal !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="font-medium">${invoice.subtotal.toLocaleString()}</p>
                </div>
              )}
              {invoice.tax_amount !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Tax</p>
                  <p className="font-medium">${invoice.tax_amount.toLocaleString()}</p>
                </div>
              )}
              {invoice.total_amount !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium">${invoice.total_amount.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    invoice.status
                  )}`}
                >
                  {invoice.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
              </div>
              {invoice.payment_terms && (
                <div>
                  <p className="text-sm text-muted-foreground">Payment Terms</p>
                  <p className="font-medium">{invoice.payment_terms}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Days Past Due</p>
                <p
                  className={`font-bold text-lg ${
                    daysPastDue === 0
                      ? "text-green-600"
                      : daysPastDue <= 30
                      ? "text-yellow-600"
                      : daysPastDue <= 60
                      ? "text-orange-600"
                      : "text-red-600"
                  }`}
                >
                  {daysPastDue === 0 ? "Current" : `${daysPastDue} days`}
                </p>
              </div>
              {invoice.aging_bucket && (
                <div>
                  <p className="text-sm text-muted-foreground">Aging Bucket</p>
                  <p className="font-medium">{getAgingBucketLabel(invoice.aging_bucket)}</p>
                </div>
              )}
              {invoice.product_description && (
                <div>
                  <p className="text-sm text-muted-foreground">Product Description</p>
                  <p className="text-sm">{invoice.product_description}</p>
                </div>
              )}
              {invoice.is_overage && (
                <div>
                  <Badge variant="destructive">Overage Invoice</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="default"
                className="w-full justify-start"
                onClick={() => setApplyPaymentOpen(true)}
                disabled={invoice.status === "Paid"}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Apply Payment
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleStatusChange("Paid")}
                disabled={invoice.status === "Paid"}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleStatusChange("Disputed")}
                disabled={invoice.status === "Disputed"}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Mark as Disputed
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleStatusChange("Settled")}
                disabled={invoice.status === "Settled"}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Settled
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleStatusChange("InPaymentPlan")}
                disabled={invoice.status === "InPaymentPlan"}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                In Payment Plan
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleStatusChange("Canceled")}
                disabled={invoice.status === "Canceled"}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Invoice
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debtor Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{invoice.debtors?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{invoice.debtors?.email}</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/debtors/${invoice.debtor_id}`)}
              >
                View Debtor Details
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {crmAccount ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Account Name</p>
                    <p className="font-medium">{crmAccount.name}</p>
                  </div>
                  {crmAccount.segment && (
                    <div>
                      <p className="text-sm text-muted-foreground">Segment</p>
                      <p className="font-medium">{crmAccount.segment}</p>
                    </div>
                  )}
                  {crmAccount.mrr !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">MRR</p>
                      <p className="font-medium">${crmAccount.mrr.toLocaleString()}</p>
                    </div>
                  )}
                  {crmAccount.lifetime_value !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Lifetime Value</p>
                      <p className="font-medium">${crmAccount.lifetime_value.toLocaleString()}</p>
                    </div>
                  )}
                  {crmAccount.customer_since && (
                    <div>
                      <p className="text-sm text-muted-foreground">Customer Since</p>
                      <p className="font-medium">{new Date(crmAccount.customer_since).toLocaleDateString()}</p>
                    </div>
                  )}
                  {crmAccount.health_score && (
                    <div>
                      <p className="text-sm text-muted-foreground">Health Score</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          crmAccount.health_score.toLowerCase() === "healthy" || crmAccount.health_score.toLowerCase() === "green"
                            ? "bg-green-100 text-green-800"
                            : crmAccount.health_score.toLowerCase() === "at risk" || crmAccount.health_score.toLowerCase() === "yellow"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {crmAccount.health_score}
                      </span>
                    </div>
                  )}
                  {crmAccount.status && (
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          crmAccount.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : crmAccount.status === "ChurnRisk"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {crmAccount.status}
                      </span>
                    </div>
                  )}
                  {crmAccount.owner_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Owner</p>
                      <p className="font-medium">{crmAccount.owner_name}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No CRM account linked. Link this debtor to a CRM account in their profile.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Context Preview - RCA + CS Cases */}
        <InvoiceContextPreview debtorId={invoice.debtor_id} invoiceId={invoice.id} />

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.paid_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Paid Date</p>
                  <p className="font-medium">{new Date(invoice.paid_date).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.payment_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Payment Date</p>
                  <p className="font-medium">{new Date(invoice.payment_date).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.payment_method && (
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{invoice.payment_method}</p>
                </div>
              )}
              {invoice.promise_to_pay_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Promise to Pay Date</p>
                  <p className="font-medium">{new Date(invoice.promise_to_pay_date).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.promise_to_pay_amount !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Promise to Pay Amount</p>
                  <p className="font-medium">${invoice.promise_to_pay_amount.toLocaleString()}</p>
                </div>
              )}
              {!invoice.paid_date && !invoice.payment_date && !invoice.payment_method && 
               !invoice.promise_to_pay_date && invoice.promise_to_pay_amount === null && (
                <p className="text-sm text-muted-foreground">No payment information available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collection Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.last_contacted_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Contacted</p>
                  <p className="font-medium">{new Date(invoice.last_contacted_at).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.last_contact_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Contact Date</p>
                  <p className="font-medium">{new Date(invoice.last_contact_date).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.next_contact_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Next Contact Date</p>
                  <p className="font-medium">{new Date(invoice.next_contact_date).toLocaleDateString()}</p>
                </div>
              )}
              {!invoice.last_contacted_at && !invoice.last_contact_date && !invoice.next_contact_date && (
                <p className="text-sm text-muted-foreground">No collection dates set</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.external_invoice_id && (
                <div>
                  <p className="text-sm text-muted-foreground">External Invoice ID</p>
                  <p className="font-medium text-sm break-all">{invoice.external_invoice_id}</p>
                </div>
              )}
              {invoice.source_system && (
                <div>
                  <p className="text-sm text-muted-foreground">Source System</p>
                  <p className="font-medium">{invoice.source_system}</p>
                </div>
              )}
              {invoice.external_link && (
                <div>
                  <p className="text-sm text-muted-foreground">External Link</p>
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
              {invoice.created_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-xs">{new Date(invoice.created_at).toLocaleString()}</p>
                </div>
              )}
              {invoice.updated_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-xs">{new Date(invoice.updated_at).toLocaleString()}</p>
                </div>
              )}
              {invoice.is_archived && (
                <div>
                  <Badge variant="secondary">Archived</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                    onClick={() => navigate("/ai-workflows")}
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
                  onClick={() => navigate("/ai-workflows")}
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

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Collection Actions
            </CardTitle>
            <CardDescription>
              Generate and send AI-powered collection messages for this invoice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Generate</CardTitle>
                  <CardDescription className="text-xs">
                    Generate a draft based on workflow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setGenerateDialogOpen(true)} 
                    disabled={generatingDraft}
                    className="w-full"
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generatingDraft ? "Generating..." : "Generate Draft"}
                  </Button>
                </CardContent>
              </Card>

            </div>

            <div className="pt-2 border-t">
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
                  "Create an SMS reminder"
                ]}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="outreach" className="space-y-4">
          <TabsList>
            <TabsTrigger value="outreach">Outreach History ({outreach.length})</TabsTrigger>
            <TabsTrigger value="drafts">AI Drafts ({drafts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="outreach">
            <Card>
              <CardContent className="pt-6">
                {outreach.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No outreach history yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Sent Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outreach.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedOutreach(log);
                            setOutreachDetailOpen(true);
                          }}
                        >
                          <TableCell className="capitalize">{log.channel}</TableCell>
                          <TableCell>{log.subject || "N/A"}</TableCell>
                          <TableCell>
                            {log.sent_at ? new Date(log.sent_at).toLocaleString() : "Not sent"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                log.status === "sent"
                                  ? "bg-green-100 text-green-800"
                                  : log.status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {log.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drafts">
            <div className="space-y-4">
              {drafts.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <p className="text-muted-foreground">
                        No AI drafts yet. Configure the workflow settings above to generate drafts.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                drafts.map((draft) => (
                  <Card key={draft.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle>Step {draft.step_number} - {draft.channel.toUpperCase()}</CardTitle>
                            {draft.ai_agent_personas && (
                              <PersonaAvatar persona={draft.ai_agent_personas.name} size="sm" showName />
                            )}
                          </div>
                          {draft.subject && <p className="text-sm text-muted-foreground">{draft.subject}</p>}
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(draft.created_at || "").toLocaleString()}
                            {draft.days_past_due !== null && draft.days_past_due !== undefined && ` • ${draft.days_past_due} days past due`}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            draft.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : draft.status === "discarded"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {draft.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted rounded-md">
                        <p className="whitespace-pre-wrap text-sm">
                          {draft.message_body.length > 200
                            ? `${draft.message_body.substring(0, 200)}...`
                            : draft.message_body}
                        </p>
                      </div>
                      {draft.recommended_send_date && (
                        <p className="text-sm text-muted-foreground">
                          Recommended send: {new Date(draft.recommended_send_date).toLocaleDateString()}
                        </p>
                      )}
                      {draft.status === "pending_approval" && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button 
                            onClick={() => handleSendDraft(draft.id)}
                            disabled={sendingDraft === draft.id}
                            size="lg"
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {sendingDraft === draft.id ? "Sending..." : "Approve & Send Now"}
                          </Button>
                          <Button variant="outline" onClick={() => handleEditDraft(draft)} size="lg">
                            Edit Draft
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDraftAction(draft.id, "discarded")}
                            size="lg"
                          >
                            Discard
                          </Button>
                        </div>
                      )}
                      {draft.status === "approved" && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Approved - Ready to send from Quick Actions above</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

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
                    <span className="font-medium">{invoice?.debtors?.email}</span>
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

        <Dialog open={outreachDetailOpen} onOpenChange={setOutreachDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Outreach Details</DialogTitle>
              <DialogDescription>
                View the full message and delivery information
              </DialogDescription>
            </DialogHeader>
            {selectedOutreach && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Channel</Label>
                    <p className="font-medium capitalize">{selectedOutreach.channel}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedOutreach.status === "sent"
                            ? "bg-green-100 text-green-800"
                            : selectedOutreach.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {selectedOutreach.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Sent To</Label>
                    <p className="font-medium">{selectedOutreach.sent_to}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Sent At</Label>
                    <p className="font-medium">
                      {selectedOutreach.sent_at ? new Date(selectedOutreach.sent_at).toLocaleString() : "Not sent"}
                    </p>
                  </div>
                  {selectedOutreach.sent_from && (
                    <div className="col-span-2">
                      <Label className="text-sm text-muted-foreground">Sent From</Label>
                      <p className="font-medium">{selectedOutreach.sent_from}</p>
                    </div>
                  )}
                </div>

                {selectedOutreach.subject && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Subject</Label>
                    <p className="font-medium mt-1">{selectedOutreach.subject}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm text-muted-foreground">Message</Label>
                  <div className="mt-2 p-4 bg-muted rounded-md">
                    <p className="whitespace-pre-wrap text-sm">{selectedOutreach.message_body}</p>
                  </div>
                </div>

                {selectedOutreach.delivery_metadata && Object.keys(selectedOutreach.delivery_metadata).length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Delivery Information</Label>
                    <div className="mt-2 p-4 bg-muted rounded-md">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(selectedOutreach.delivery_metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOutreachDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </div>
    </Layout>
  );
};

export default InvoiceDetail;
