import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { TasksSummaryCard } from "@/components/TasksSummaryCard";
import { useCollectionTasks, CollectionTask } from "@/hooks/useCollectionTasks";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Edit, Archive, Mail, Phone as PhoneIcon, Building, MapPin, Copy, Check, MessageSquare, Clock, ExternalLink, FileText, FileSpreadsheet, Plus, UserPlus, User, Trash2, PauseCircle, PlayCircle, Search, DollarSign } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ContactCard } from "@/components/ContactCard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RiskEngineCard } from "@/components/RiskEngineCard";
import { AgingBucketBreakdown } from "@/components/AgingBucketBreakdown";
import AccountSummaryModal from "@/components/AccountSummaryModal";
import CreateTaskModal from "@/components/CreateTaskModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { ResponseActivityCard } from "@/components/ResponseActivityCard";
import { useCollectionActivities } from "@/hooks/useCollectionActivities";
import { CreateInvoiceModal } from "@/components/CreateInvoiceModal";
import { CustomerCaseFeed } from "@/components/CustomerCaseFeed";
import { AccountIntelligencePanel } from "@/components/AccountIntelligencePanel";
import { AccountOutreachSettings } from "@/components/AccountOutreachSettings";
import { OutreachDetailModal, OutreachRecord } from "@/components/OutreachDetailModal";
import { OutreachSummaryRow } from "@/components/OutreachSummaryRow";
import { EmailDeliveryWarning } from "@/components/alerts/EmailDeliveryWarning";
import { EmailStatusBadge } from "@/components/alerts/EmailStatusBadge";
import { AccountScheduledOutreachPanel } from "@/components/AccountScheduledOutreachPanel";
import { AccountDraftsHistory } from "@/components/AccountDraftsHistory";
import { PaymentPlanModal } from "@/components/PaymentPlanModal";
import { PaymentPlansList } from "@/components/PaymentPlansList";
import { usePaymentPlans } from "@/hooks/usePaymentPlans";

interface Debtor {
  id: string;
  reference_id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  type: "B2B" | "B2C" | null;
  address: string | null;
  notes: string | null;
  current_balance: number | null;
  crm_account_id: string | null;
  payment_score: number | null;
  payment_risk_tier: string | null;
  avg_days_to_pay: number | null;
  max_days_past_due: number | null;
  aging_mix_current_pct: number | null;
  aging_mix_1_30_pct: number | null;
  aging_mix_31_60_pct: number | null;
  aging_mix_61_90_pct: number | null;
  aging_mix_91_120_pct: number | null;
  aging_mix_121_plus_pct: number | null;
  disputed_invoices_count: number | null;
  in_payment_plan_invoices_count: number | null;
  written_off_invoices_count: number | null;
  open_invoices_count: number | null;
  payment_score_last_calculated: string | null;
  risk_status_note: string | null;
  risk_last_calculated_at: string | null;
  outreach_paused: boolean | null;
  outreach_paused_at: string | null;
  // Account-level outreach settings
  account_outreach_enabled: boolean | null;
  outreach_frequency: string | null;
  outreach_frequency_days: number | null;
  next_outreach_date: string | null;
  last_outreach_date: string | null;
  account_outreach_persona: string | null;
  account_outreach_tone: number | null;
  auto_send_outreach: boolean | null;
  // Email status fields
  email_status: string | null;
  email_status_updated_at: string | null;
  email_bounce_count: number | null;
  last_bounce_reason: string | null;
}

interface DebtorContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  outreach_enabled: boolean;
}

interface CRMAccount {
  id: string;
  name: string;
  account_number: string | null;
  segment: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding?: number | null;
  currency?: string | null;
  status: string;
  due_date: string;
  issue_date: string;
  tasks_count?: number;
  is_on_payment_plan?: boolean;
  payment_plan_id?: string | null;
}

interface OutreachLog {
  id: string;
  channel: string;
  subject: string | null;
  message_body: string;
  sent_at: string | null;
  sent_to: string;
  sent_from: string | null;
  status: string;
  invoice_id: string | null;
  delivery_metadata: any;
  created_at: string;
  activity_type?: string;
  invoices: {
    invoice_number: string;
    amount: number;
    due_date: string;
  } | null;
}

const DebtorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchTasks: fetchTasksFromHook } = useCollectionTasks();
  const { fetchActivities } = useCollectionActivities();
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outreach, setOutreach] = useState<OutreachLog[]>([]);
  const [crmAccounts, setCrmAccounts] = useState<CRMAccount[]>([]);
  const [debtorTasks, setDebtorTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [linkingCrm, setLinkingCrm] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState(false);
  const [isAccountSummaryOpen, setIsAccountSummaryOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [inboundReplies, setInboundReplies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<DebtorContact[]>([]);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", phone: "", outreach_enabled: true });
  const [outreachSearch, setOutreachSearch] = useState("");
  const [outreachPage, setOutreachPage] = useState(1);
  const OUTREACH_PAGE_SIZE = 10;
  const [selectedOutreach, setSelectedOutreach] = useState<OutreachRecord | null>(null);
  const [outreachDetailOpen, setOutreachDetailOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isResumingOutreach, setIsResumingOutreach] = useState(false);
  const [isPaymentPlanOpen, setIsPaymentPlanOpen] = useState(false);
  const { paymentPlans, refetch: refetchPaymentPlans } = usePaymentPlans(id);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    type: "B2C" as "B2B" | "B2C",
    address: "",
    notes: "",
  });

  // Filter and paginate outreach
  const filteredOutreach = useMemo(() => {
    if (!outreachSearch.trim()) return outreach;
    const query = outreachSearch.toLowerCase();
    return outreach.filter(log => 
      log.subject?.toLowerCase().includes(query) ||
      log.message_body?.toLowerCase().includes(query) ||
      log.sent_to?.toLowerCase().includes(query) ||
      log.invoices?.invoice_number?.toLowerCase().includes(query)
    );
  }, [outreach, outreachSearch]);

  const paginatedOutreach = useMemo(() => {
    const start = (outreachPage - 1) * OUTREACH_PAGE_SIZE;
    return filteredOutreach.slice(start, start + OUTREACH_PAGE_SIZE);
  }, [filteredOutreach, outreachPage]);

  const totalOutreachPages = Math.ceil(filteredOutreach.length / OUTREACH_PAGE_SIZE);

  useEffect(() => {
    if (id) {
      fetchDebtor();
      fetchInvoices();
      fetchOutreach();
      fetchCrmAccounts();
      fetchDebtorTasks();
      fetchAllTasks();
      fetchDebtorActivities();
      fetchContacts();
      fetchInboundReplies();
    }
  }, [id]);

  // Fetch inbound replies from inbound_emails table (aligns with scorecard)
  const fetchInboundReplies = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select(`
          id,
          created_at,
          from_email,
          subject,
          text_body,
          ai_summary,
          ai_sentiment,
          ai_category,
          invoice_id,
          invoices(invoice_number)
        `)
        .eq("debtor_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInboundReplies(data || []);
    } catch (error) {
      console.error("Error fetching inbound replies:", error);
    }
  };

  const fetchContacts = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("debtor_contacts")
        .select("*")
        .eq("debtor_id", id)
        .order("is_primary", { ascending: false });
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.email) {
      toast.error("Name and email are required");
      return;
    }
    if (contacts.length >= 3) {
      toast.error("Maximum 3 contacts allowed per account");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', {
        p_user_id: user.id
      });

      const { error } = await supabase.from("debtor_contacts").insert({
        debtor_id: id,
        user_id: effectiveAccountId || user.id,
        name: newContact.name,
        title: newContact.title || null,
        email: newContact.email,
        phone: newContact.phone || null,
        outreach_enabled: newContact.outreach_enabled,
        is_primary: false,
      });

      if (error) throw error;
      toast.success("Contact added successfully");
      setIsAddContactOpen(false);
      setNewContact({ name: "", title: "", email: "", phone: "", outreach_enabled: true });
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to add contact");
    }
  };

  const handleDeleteContact = async (contactId: string, isPrimary: boolean) => {
    if (isPrimary) {
      toast.error("Cannot delete primary contact");
      return;
    }
    try {
      const { error } = await supabase
        .from("debtor_contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;
      toast.success("Contact deleted");
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete contact");
    }
  };

  const handleToggleOutreach = async (contactId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("debtor_contacts")
        .update({ outreach_enabled: enabled })
        .eq("id", contactId);

      if (error) throw error;
      fetchContacts();
    } catch (error: any) {
      toast.error("Failed to update outreach setting");
    }
  };

  // Resume outreach after email update - resets email_status and resumes paused invoice outreach
  const handleResumeOutreach = async () => {
    if (!id) return;
    setIsResumingOutreach(true);
    try {
      // 1. Reset debtor email_status to 'unknown' and clear bounce data
      const { error: debtorError } = await supabase
        .from("debtors")
        .update({ 
          email_status: 'unknown',
          email_bounce_count: 0,
          last_bounce_reason: null,
          outreach_paused: false,
          outreach_paused_at: null
        })
        .eq("id", id);

      if (debtorError) throw debtorError;

      // 2. Resume all paused invoice_outreach records for this debtor's invoices
      const { data: invoiceIds } = await supabase
        .from("invoices")
        .select("id")
        .eq("debtor_id", id);

      if (invoiceIds && invoiceIds.length > 0) {
        const { error: outreachError } = await supabase
          .from("invoice_outreach")
          .update({ 
            is_active: true,
            paused_at: null
          })
          .in("invoice_id", invoiceIds.map(inv => inv.id));

        if (outreachError) throw outreachError;
      }

      // 3. Create a success alert
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_alerts").insert([{
          user_id: user.id,
          alert_type: 'outreach_resumed',
          severity: 'success',
          title: 'Outreach Resumed',
          message: `✅ Outreach Resumed for ${debtor?.company_name || debtor?.name || 'account'}`,
          action_url: `/debtors/${id}`,
          is_read: false,
          is_dismissed: false
        }]);
      }

      toast.success("Outreach resumed! Collection emails will resume on the next scheduled date.");
      fetchDebtor();
    } catch (error: any) {
      console.error("Error resuming outreach:", error);
      toast.error(error.message || "Failed to resume outreach");
    } finally {
      setIsResumingOutreach(false);
    }
  };

  // Open primary contact's edit modal
  const handleOpenPrimaryContactEdit = () => {
    const primaryContact = contacts.find(c => c.is_primary);
    if (primaryContact) {
      setEditingContactId(primaryContact.id);
    } else if (contacts.length > 0) {
      // If no primary, open first contact
      setEditingContactId(contacts[0].id);
    } else {
      // No contacts - open add contact modal
      setIsAddContactOpen(true);
    }
  };

  const fetchDebtorActivities = async () => {
    if (!id) return;
    const data = await fetchActivities({ debtor_id: id });
    setActivities(data || []);
  };

  const fetchDebtorTasks = async () => {
    const tasks = await fetchTasksFromHook({ debtor_id: id });
    setDebtorTasks(tasks.filter(t => t.status !== 'done'));
  };

  const fetchAllTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select(`
          *,
          invoices(invoice_number)
        `)
        .eq("debtor_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchDebtor = async () => {
    try {
      const { data, error } = await supabase
        .from("debtors")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setDebtor(data);
      setFormData({
        name: data.name,
        company_name: data.company_name,
        type: data.type || "B2C",
        address: data.address || "",
        notes: data.notes || "",
      });
    } catch (error: any) {
      toast.error("Failed to load account details");
      navigate("/debtors");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, is_on_payment_plan, payment_plan_id, currency, amount_outstanding")
        .eq("debtor_id", id)
        .eq("is_archived", false)
        .order("due_date", { ascending: false });

      if (error) throw error;
      
      // Fetch task counts for each invoice
      if (data) {
        const invoicesWithTasks = await Promise.all(
          data.map(async (invoice) => {
            const { count } = await supabase
              .from("collection_tasks")
              .select("*", { count: "exact", head: true })
              .eq("invoice_id", invoice.id)
              .neq("status", "done");
            
            return { ...invoice, tasks_count: count || 0 };
          })
        );
        setInvoices(invoicesWithTasks);
      } else {
        setInvoices([]);
      }
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
    }
  };

  const fetchOutreach = async () => {
    try {
      // Fetch from outreach_logs (invoice-level outreach)
      const { data: logsData, error: logsError } = await supabase
        .from("outreach_logs")
        .select(`
          *,
          invoices(
            invoice_number,
            amount,
            due_date
          )
        `)
        .eq("debtor_id", id)
        .order("created_at", { ascending: false });

      if (logsError) throw logsError;

      // Fetch from collection_activities (account-level and all outbound activities)
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("collection_activities")
        .select(`
          id,
          channel,
          subject,
          message_body,
          sent_at,
          created_at,
          activity_type,
          direction,
          metadata,
          invoice_id,
          invoices(
            invoice_number,
            amount,
            due_date
          )
        `)
        .eq("debtor_id", id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false });

      if (activitiesError) throw activitiesError;

      // Transform outreach_logs to common format
      const logsFormatted: OutreachLog[] = (logsData || []).map((log: any) => ({
        id: log.id,
        channel: log.channel,
        subject: log.subject,
        message_body: log.message_body,
        sent_at: log.sent_at,
        sent_to: log.sent_to,
        sent_from: log.sent_from,
        status: log.status,
        invoice_id: log.invoice_id,
        delivery_metadata: log.delivery_metadata,
        created_at: log.created_at,
        activity_type: "invoice_outreach",
        invoices: log.invoices,
      }));

      // Transform collection_activities to common format
      const activitiesFormatted: OutreachLog[] = (activitiesData || []).map((activity: any) => ({
        id: activity.id,
        channel: activity.channel,
        subject: activity.subject,
        message_body: activity.message_body,
        sent_at: activity.sent_at,
        sent_to: activity.metadata?.sent_to?.[0] || activity.metadata?.sent_to || "Unknown",
        sent_from: activity.metadata?.from_email || activity.metadata?.from_name || null,
        status: activity.sent_at ? "sent" : "pending",
        invoice_id: activity.invoice_id,
        delivery_metadata: activity.metadata,
        created_at: activity.created_at,
        activity_type: activity.activity_type,
        invoices: activity.invoices,
      }));

      // Combine and deduplicate by id, then sort by date
      const combinedMap = new Map<string, OutreachLog>();
      
      // Add activities first (they may be more comprehensive)
      activitiesFormatted.forEach(a => combinedMap.set(a.id, a));
      
      // Add logs - but check if this is a duplicate (linked via activity)
      logsFormatted.forEach(log => {
        // Check if already in combined from activities
        if (!combinedMap.has(log.id)) {
          combinedMap.set(log.id, log);
        }
      });

      // Sort combined by date (most recent first)
      const combined = Array.from(combinedMap.values())
        .sort((a, b) => {
          const dateA = new Date(a.sent_at || a.created_at).getTime();
          const dateB = new Date(b.sent_at || b.created_at).getTime();
          return dateB - dateA;
        });

      setOutreach(combined);
    } catch (error: any) {
      console.error("Error fetching outreach:", error);
    }
  };

  const fetchCrmAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("crm_accounts")
        .select("id, name, account_number, segment")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setCrmAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching CRM accounts:", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from("debtors")
        .update(formData)
        .eq("id", id);

      if (error) throw error;
      toast.success("Account updated successfully");
      setIsEditOpen(false);
      fetchDebtor();
    } catch (error: any) {
      toast.error(error.message || "Failed to update account");
    }
  };

  const handleArchive = async () => {
    try {
      const { error } = await supabase
        .from("debtors")
        .update({ is_archived: true })
        .eq("id", id);

      if (error) throw error;
      toast.success("Account archived successfully");
      navigate("/debtors");
    } catch (error: any) {
      toast.error(error.message || "Failed to archive account");
    }
  };

  const handleLinkCrmAccount = async (crmAccountId: string | null) => {
    setLinkingCrm(true);
    try {
      const { error } = await supabase
        .from("debtors")
        .update({ crm_account_id: crmAccountId === "none" ? null : crmAccountId })
        .eq("id", id);

      if (error) throw error;
      toast.success(crmAccountId === "none" ? "CRM account unlinked" : "CRM account linked successfully");
      fetchDebtor();
    } catch (error: any) {
      toast.error(error.message || "Failed to link CRM account");
    } finally {
      setLinkingCrm(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Open: "bg-yellow-100 text-yellow-800",
      Paid: "bg-green-100 text-green-800",
      Disputed: "bg-red-100 text-red-800",
      Settled: "bg-blue-100 text-blue-800",
      InPaymentPlan: "bg-purple-100 text-purple-800",
      Canceled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleCopyReferenceId = () => {
    if (debtor?.reference_id) {
      navigator.clipboard.writeText(debtor.reference_id);
      setCopiedRefId(true);
      toast.success("Reference ID copied to clipboard");
      setTimeout(() => setCopiedRefId(false), 2000);
    }
  };

  if (loading || !debtor) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/debtors")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold text-primary">{debtor.company_name}</h1>
                {/* Payment Plan Badge - show if any active payment plans exist */}
                {(paymentPlans && paymentPlans.some(p => ["proposed", "accepted", "active"].includes(p.status))) && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Payment Plan Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-mono text-muted-foreground">{debtor.reference_id}</span>
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
          <div className="flex items-center space-x-2">
            {/* Outreach Pause Toggle */}
            <Button 
              variant={debtor.outreach_paused ? "default" : "outline"} 
              onClick={async () => {
                const newPaused = !debtor.outreach_paused;
                const { error } = await supabase
                  .from("debtors")
                  .update({ 
                    outreach_paused: newPaused,
                    outreach_paused_at: newPaused ? new Date().toISOString() : null
                  })
                  .eq("id", id);
                if (error) {
                  toast.error("Failed to update outreach status");
                } else {
                  toast.success(newPaused ? "All outreach paused for this account" : "Outreach resumed for this account");
                  fetchDebtor();
                }
              }}
              className={debtor.outreach_paused ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              {debtor.outreach_paused ? (
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
            <Button onClick={() => setIsCreateInvoiceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
            {/* Only show Payment Plan button if no active plan exists */}
            {(!paymentPlans || !paymentPlans.some(p => ["proposed", "accepted", "active", "draft"].includes(p.status))) && (
              <Button onClick={() => setIsPaymentPlanOpen(true)} variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Payment Plan
              </Button>
            )}
            <Button onClick={() => setIsAccountSummaryOpen(true)} variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              AI Outreach
            </Button>
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setIsArchiveOpen(true)}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </div>
        </div>

        {/* Email Delivery Warning Banner */}
        <EmailDeliveryWarning
          status={debtor.email_status}
          bounceReason={debtor.last_bounce_reason}
          bounceCount={debtor.email_bounce_count || undefined}
          onUpdateEmail={handleOpenPrimaryContactEdit}
          onResumeOutreach={handleResumeOutreach}
          isResuming={isResumingOutreach}
        />

        {/* Paused Alert Banner */}
        {debtor.outreach_paused && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
            <PauseCircle className="h-5 w-5 text-orange-600 shrink-0" />
            <div>
              <p className="font-medium text-orange-800">Outreach Paused</p>
              <p className="text-sm text-orange-700">
                All automated outreach for this account is paused. Click "Resume Outreach" to restart collection communications.
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contacts</CardTitle>
                {contacts.length < 3 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsAddContactOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add Contact
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.length > 0 ? (
                contacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    debtorId={id!}
                    onToggleOutreach={handleToggleOutreach}
                    onDelete={handleDeleteContact}
                    onUpdate={fetchContacts}
                    autoOpenEdit={editingContactId === contact.id}
                    onEditClose={() => setEditingContactId(null)}
                  />
                ))
              ) : debtor.email ? (
                // Fallback: Show generated primary contact preview when debtor has email
                <div className="space-y-3">
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {debtor.company_name || debtor.name || 'Primary Contact'}
                        </span>
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground">Auto-generated</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{debtor.email}</span>
                      </div>
                      {debtor.phone && (
                        <div className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3" />
                          <span>{debtor.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error("Not authenticated");
                        
                        const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', {
                          p_user_id: user.id
                        });

                        const { error } = await supabase.from("debtor_contacts").insert({
                          debtor_id: id,
                          user_id: effectiveAccountId || user.id,
                          name: debtor.company_name || debtor.name || 'Primary Contact',
                          email: debtor.email,
                          phone: debtor.phone || null,
                          is_primary: true,
                          outreach_enabled: true,
                        });

                        if (error) throw error;
                        toast.success("Primary contact created successfully");
                        fetchContacts();
                      } catch (error: any) {
                        toast.error(error.message || "Failed to create contact");
                      }
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Create Primary Contact
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">No contacts found. Add your first contact for this account.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsAddContactOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add Contact
                  </Button>
                </div>
              )}
              {debtor.address && (
                <div className="flex items-center space-x-3 pt-2 border-t">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{debtor.address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    debtor.type === "B2B"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {debtor.type}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                {(() => {
                  // Group active invoices by currency
                  const activeInvoices = invoices.filter(inv => 
                    ["Open", "Overdue", "InPaymentPlan", "PartiallyPaid"].includes(inv.status)
                  );
                  const byCurrency: Record<string, number> = {};
                  activeInvoices.forEach(inv => {
                    const curr = inv.currency || "USD";
                    const balance = inv.amount_outstanding ?? inv.amount;
                    byCurrency[curr] = (byCurrency[curr] || 0) + balance;
                  });
                  const currencies = Object.keys(byCurrency);
                  if (currencies.length <= 1) {
                    const curr = currencies[0] || "USD";
                    const symbol = curr === "USD" ? "$" : curr === "EUR" ? "€" : curr === "GBP" ? "£" : `${curr} `;
                    return (
                      <p className="text-2xl font-bold">
                        {symbol}{(byCurrency[curr] || debtor.current_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      {currencies.sort().map(curr => {
                        const symbol = curr === "USD" ? "$" : curr === "EUR" ? "€" : curr === "GBP" ? "£" : `${curr} `;
                        return (
                          <p key={curr} className="text-xl font-bold flex items-center gap-2">
                            {symbol}{byCurrency[curr].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <Badge variant="outline" className="text-xs font-normal">{curr}</Badge>
                          </p>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-account">Linked CRM Account</Label>
                <Select
                  value={debtor.crm_account_id || "none"}
                  onValueChange={handleLinkCrmAccount}
                  disabled={linkingCrm}
                >
                  <SelectTrigger id="crm-account">
                    <SelectValue placeholder="Select CRM account" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">No CRM account linked</SelectItem>
                    {crmAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.account_number ? `(${account.account_number})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {crmAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No CRM accounts available. Sync your CRM data in Settings.
                  </p>
                )}
              </div>
              {debtor.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{debtor.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Collection Intelligence Panel (Consolidated Scorecard + Report) */}
        <AccountIntelligencePanel 
          debtorId={debtor.id} 
          debtorName={debtor.company_name || debtor.name}
          onIntelligenceCalculated={() => {
            fetchDebtor();
          }}
        />

        {/* Account Outreach Settings */}
        <AccountOutreachSettings
          debtorId={debtor.id}
          debtorName={debtor.company_name || debtor.name}
          initialSettings={{
            account_outreach_enabled: debtor.account_outreach_enabled || false,
            outreach_frequency: debtor.outreach_frequency || "weekly",
            outreach_frequency_days: debtor.outreach_frequency_days || 7,
            next_outreach_date: debtor.next_outreach_date,
            last_outreach_date: debtor.last_outreach_date,
            auto_send_outreach: debtor.auto_send_outreach || false,
            account_outreach_persona: debtor.account_outreach_persona,
            account_outreach_tone: debtor.account_outreach_tone,
          }}
          onSettingsChange={fetchDebtor}
        />

        {/* Risk Assessment Card */}
        <RiskEngineCard
          debtorId={debtor.id}
          paymentScore={debtor.payment_score}
          riskTier={debtor.payment_risk_tier}
          riskStatusNote={debtor.risk_status_note}
          riskLastCalculatedAt={debtor.risk_last_calculated_at || debtor.payment_score_last_calculated}
          avgDaysToPay={debtor.avg_days_to_pay}
          maxDaysPastDue={debtor.max_days_past_due}
          openInvoicesCount={debtor.open_invoices_count}
          disputedInvoicesCount={debtor.disputed_invoices_count}
        />

        {/* Aging Bucket Breakdown */}
        <AgingBucketBreakdown debtorId={id} />

        {/* Customer Case Feed */}
        <CustomerCaseFeed debtorId={id} />

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="payment-plans">
              Payment Plans ({paymentPlans?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Outreach</TabsTrigger>
            <TabsTrigger value="drafts">AI Drafts</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="replies">
              Replies ({inboundReplies.length})
            </TabsTrigger>
            <TabsTrigger value="outreach">Outreach History ({outreach.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardContent className="pt-6">
                {invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No invoices for this account yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tasks</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow 
                          key={invoice.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {invoice.invoice_number}
                              {invoice.is_on_payment_plan && (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] px-1.5 py-0">
                                  <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                                  Payment Plan
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                invoice.status
                              )}`}
                            >
                              {invoice.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {invoice.tasks_count && invoice.tasks_count > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <FileText className="h-3 w-3" />
                                {invoice.tasks_count}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-plans">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payment Plans</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create structured payment arrangements with AR dashboard links
                    </p>
                  </div>
                  <Button onClick={() => setIsPaymentPlanOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <PaymentPlansList debtorId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <AccountScheduledOutreachPanel debtorId={id} />
          </TabsContent>

          <TabsContent value="drafts">
            <AccountDraftsHistory debtorId={id} />
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Tasks for this Account</CardTitle>
                  <Button onClick={() => setIsCreateTaskOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Both account-level and invoice-level tasks
                </p>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No tasks for this account yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow 
                          key={task.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedTask(task as CollectionTask);
                            setIsTaskDetailOpen(true);
                          }}
                        >
                          <TableCell className="text-sm">
                            {new Date(task.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={task.level === "invoice" ? "default" : "secondary"}>
                              {task.level || "account"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.task_type.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="max-w-md line-clamp-2">
                            {task.summary}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {task.invoices?.invoice_number || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={task.status === "done" ? "outline" : "default"}>
                              {task.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="replies">
            <Card>
              <CardHeader>
                <CardTitle>Inbound Replies</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Customer replies received via email, automatically summarized with AI
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                {inboundReplies.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No inbound replies yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Customer replies to your outreach will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inboundReplies.map((reply) => (
                      <Card key={reply.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{reply.from_email}</span>
                              {reply.ai_sentiment && (
                                <Badge variant={
                                  reply.ai_sentiment.toLowerCase() === 'positive' ? 'default' :
                                  reply.ai_sentiment.toLowerCase() === 'negative' ? 'destructive' : 'secondary'
                                } className="text-xs">
                                  {reply.ai_sentiment}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(reply.created_at).toLocaleDateString()} at {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          {reply.subject && (
                            <p className="text-sm font-medium">{reply.subject}</p>
                          )}
                          
                          {reply.ai_summary && (
                            <div className="p-3 bg-muted/50 rounded-md">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">AI Summary</p>
                              <p className="text-sm">{reply.ai_summary}</p>
                            </div>
                          )}

                          {reply.ai_category && (
                            <Badge variant="outline" className="text-xs">
                              Category: {reply.ai_category.replace(/_/g, ' ')}
                            </Badge>
                          )}

                          {reply.invoices && (
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                Related to Invoice: {reply.invoices.invoice_number}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outreach">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Communication Audit Trail</CardTitle>
                    <p className="text-sm text-muted-foreground">Complete history of all communications with this account</p>
                  </div>
                  <div className="relative w-full sm:w-64">
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
                </div>
                {filteredOutreach.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing {paginatedOutreach.length} of {filteredOutreach.length} record{filteredOutreach.length !== 1 ? 's' : ''}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                {filteredOutreach.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {outreachSearch ? "No matching outreach records" : "No outreach history for this account yet."}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {outreachSearch ? "Try a different search term." : "Communications will appear here once sent."}
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
                        invoiceNumber={log.invoices?.invoice_number}
                        invoiceAmount={log.invoices?.amount}
                        onClick={() => {
                          setSelectedOutreach(log as OutreachRecord);
                          setOutreachDetailOpen(true);
                        }}
                      />
                    ))}

                    {/* Pagination */}
                    {totalOutreachPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOutreachPage(p => Math.max(1, p - 1))}
                          disabled={outreachPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground px-4">
                          Page {outreachPage} of {totalOutreachPages}
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <OutreachDetailModal
          open={outreachDetailOpen}
          onOpenChange={setOutreachDetailOpen}
          outreach={selectedOutreach}
          showInvoiceLink={true}
        />

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-company_name">Company Name *</Label>
                  <Input
                    id="edit-company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "B2B" | "B2C") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2B">B2B</SelectItem>
                      <SelectItem value="B2C">B2C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Debtor</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Debtor?</AlertDialogTitle>
              <AlertDialogDescription>
                This will archive this debtor and hide them from the main list. You can restore them later if needed. This will not delete any data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchive} className="bg-orange-600 text-white hover:bg-orange-700">
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AccountSummaryModal
          open={isAccountSummaryOpen}
          onOpenChange={setIsAccountSummaryOpen}
          debtor={debtor}
        />

        <CreateTaskModal
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          debtorId={debtor.id}
          level="debtor"
          onTaskCreated={fetchAllTasks}
        />

        <CreateInvoiceModal
          open={isCreateInvoiceOpen}
          onOpenChange={setIsCreateInvoiceOpen}
          debtorId={debtor.id}
          debtorName={debtor.company_name}
          onInvoiceCreated={fetchInvoices}
        />

        <TaskDetailModal
          task={selectedTask}
          open={isTaskDetailOpen}
          onOpenChange={setIsTaskDetailOpen}
          onStatusChange={async (taskId, status) => {
            await supabase
              .from("collection_tasks")
              .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
              .eq("id", taskId);
            fetchAllTasks();
            toast.success("Task updated");
          }}
          onArchive={async (taskId) => {
            await supabase
              .from("collection_tasks")
              .update({ is_archived: true, archived_at: new Date().toISOString() })
              .eq("id", taskId);
            fetchAllTasks();
            toast.success("Task archived");
          }}
          onAssign={async (taskId, assignedTo, assignedPersona) => {
            await supabase
              .from("collection_tasks")
              .update({ assigned_to: assignedTo, assigned_persona: assignedPersona })
              .eq("id", taskId);
            fetchAllTasks();
          }}
          onNoteAdded={fetchAllTasks}
        />

        {/* Add Contact Dialog */}
        <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-contact-name">Name *</Label>
                  <Input
                    id="new-contact-name"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-contact-title">Title</Label>
                  <Input
                    id="new-contact-title"
                    value={newContact.title}
                    onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                    placeholder="e.g., CFO, AP Manager"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-contact-email">Email *</Label>
                  <Input
                    id="new-contact-email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="email@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-contact-phone">Phone</Label>
                  <Input
                    id="new-contact-phone"
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-contact-outreach"
                  checked={newContact.outreach_enabled}
                  onCheckedChange={(checked) => setNewContact({ ...newContact, outreach_enabled: checked })}
                />
                <Label htmlFor="new-contact-outreach">Enable outreach for this contact</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddContactOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddContact}>
                  Add Contact
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Plan Modal */}
        <PaymentPlanModal
          open={isPaymentPlanOpen}
          onOpenChange={setIsPaymentPlanOpen}
          debtorId={id!}
          debtorName={debtor.company_name || debtor.name}
          invoices={invoices.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            amount: inv.amount,
            status: inv.status,
            due_date: inv.due_date,
          }))}
          contacts={contacts}
          onPlanCreated={() => {
            refetchPaymentPlans();
            fetchInvoices();
          }}
        />
      </div>
    </Layout>
  );
};

export default DebtorDetail;
