import { useState, useEffect } from "react";
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
import { ArrowLeft, Edit, Archive, Mail, Phone as PhoneIcon, Building, MapPin, Copy, Check, MessageSquare, Clock, ExternalLink, FileText, FileSpreadsheet, Plus, UserPlus, User, Trash2, PauseCircle, PlayCircle } from "lucide-react";
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
import { AccountIntelligenceCard } from "@/components/AccountIntelligenceCard";
import { AccountOutreachSettings } from "@/components/AccountOutreachSettings";

interface Debtor {
  id: string;
  reference_id: string;
  name: string;
  company_name: string;
  contact_name: string;
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
  status: string;
  due_date: string;
  issue_date: string;
  tasks_count?: number;
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
  invoice_id: string;
  delivery_metadata: any;
  created_at: string;
  invoices: {
    invoice_number: string;
    amount: number;
    due_date: string;
  };
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
  const [contacts, setContacts] = useState<DebtorContact[]>([]);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", phone: "", outreach_enabled: true });
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    type: "B2C" as "B2B" | "B2C",
    address: "",
    notes: "",
  });

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
    }
  }, [id]);

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
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || "",
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
        .select("*")
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
      const { data, error } = await supabase
        .from("outreach_logs")
        .select(`
          *,
          invoices!inner(
            invoice_number,
            amount,
            due_date
          )
        `)
        .eq("debtor_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOutreach(data || []);
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
              <h1 className="text-4xl font-bold text-primary">{debtor.company_name}</h1>
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
                    onToggleOutreach={handleToggleOutreach}
                    onDelete={handleDeleteContact}
                    onUpdate={fetchContacts}
                  />
                ))
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{debtor.contact_name || "Primary Contact"}</span>
                        <Badge variant="secondary" className="text-xs">Primary (Legacy)</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{debtor.email}</span>
                      </div>
                      {debtor.phone && (
                        <div className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                          <span>{debtor.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-2">Add additional contacts for this account</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsAddContactOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add Contact
                    </Button>
                  </div>
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
                <p className="text-2xl font-bold">
                  ${(debtor.current_balance || 0).toLocaleString()}
                </p>
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

        {/* Collection Intelligence Report */}
        <AccountIntelligenceCard debtorId={debtor.id} />

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
            account_outreach_persona: debtor.account_outreach_persona || "sam",
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
          <TabsList>
            <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="responses">
              Responses ({activities.filter(a => a.direction === 'inbound').length})
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
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>${invoice.amount.toLocaleString()}</TableCell>
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

          <TabsContent value="responses">
            <Card>
              <CardHeader>
                <CardTitle>Customer Responses</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Inbound replies from customer, automatically summarized and linked to outreach
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                {activities.filter(a => a.direction === 'inbound').length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No customer responses yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Responses to outreach efforts will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities
                      .filter(a => a.direction === 'inbound')
                      .map((activity) => (
                        <ResponseActivityCard key={activity.id} activity={activity} />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outreach">
            <Card>
              <CardHeader>
                <CardTitle>Communication Audit Trail</CardTitle>
                <p className="text-sm text-muted-foreground">Complete history of all communications with this account</p>
              </CardHeader>
              <CardContent className="pt-6">
                {outreach.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No outreach history for this account yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">Communications will appear here once sent.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outreach.map((log) => (
                      <Card key={log.id} className="border-l-4 border-l-primary/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                log.channel === 'email' 
                                  ? 'bg-blue-100 text-blue-600' 
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                {log.channel === 'email' ? (
                                  <Mail className="h-4 w-4" />
                                ) : (
                                  <MessageSquare className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold capitalize">{log.channel}</span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      log.status === "sent"
                                        ? "bg-green-100 text-green-800"
                                        : log.status === "failed"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}
                                  >
                                    {log.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3" />
                                  {log.sent_at
                                    ? new Date(log.sent_at).toLocaleString()
                                    : new Date(log.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                <span className="font-mono">{log.invoices.invoice_number}</span>
                              </div>
                              <div className="font-medium">${log.invoices.amount.toLocaleString()}</div>
                            </div>
                          </div>

                          {log.subject && (
                            <div className="mb-2">
                              <span className="text-sm font-medium text-muted-foreground">Subject: </span>
                              <span className="text-sm">{log.subject}</span>
                            </div>
                          )}

                          <div className="mb-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <span className="font-medium">To:</span>
                              <span>{log.sent_to}</span>
                              {log.sent_from && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span className="font-medium">From:</span>
                                  <span>{log.sent_from}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="bg-muted/30 p-3 rounded-lg">
                            <p className="text-sm whitespace-pre-wrap">{log.message_body}</p>
                          </div>

                          {log.delivery_metadata && Object.keys(log.delivery_metadata).length > 0 && (
                            <details className="mt-3">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Delivery Details
                              </summary>
                              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                                {JSON.stringify(log.delivery_metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                  <Label htmlFor="edit-contact_name">Contact Name *</Label>
                  <Input
                    id="edit-contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
      </div>
    </Layout>
  );
};

export default DebtorDetail;
