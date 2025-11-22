import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, AlertCircle, XCircle, Info, Copy, Check } from "lucide-react";

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: string;
  notes: string | null;
  debtor_id: string;
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

interface AIWorkflow {
  id?: string;
  tone: "friendly" | "neutral" | "firm";
  cadence_days: number[];
  min_settlement_pct: number;
  max_settlement_pct: number;
  is_active: boolean;
}

interface OutreachLog {
  id: string;
  channel: string;
  subject: string | null;
  sent_at: string | null;
  status: string;
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
}

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [workflow, setWorkflow] = useState<AIWorkflow>({
    tone: "friendly",
    cadence_days: [0, 3, 7, 14],
    min_settlement_pct: 50,
    max_settlement_pct: 100,
    is_active: false,
  });
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

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [invoiceRes, workflowRes, outreachRes, draftsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, debtors(name, email, crm_account_id)")
          .eq("id", id)
          .single(),
        supabase.from("ai_workflows").select("*").eq("invoice_id", id).maybeSingle(),
        supabase
          .from("outreach_logs")
          .select("*")
          .eq("invoice_id", id)
          .order("sent_at", { ascending: false }),
        supabase
          .from("ai_drafts")
          .select("*")
          .eq("invoice_id", id)
          .neq("status", "discarded")
          .order("step_number", { ascending: true }),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      setInvoice(invoiceRes.data);

      if (workflowRes.data) {
        const cadenceDays = Array.isArray(workflowRes.data.cadence_days) 
          ? workflowRes.data.cadence_days as number[]
          : [0, 3, 7, 14];
        
        setWorkflow({
          id: workflowRes.data.id,
          tone: (workflowRes.data.tone as "friendly" | "neutral" | "firm") || "friendly",
          cadence_days: cadenceDays,
          min_settlement_pct: workflowRes.data.min_settlement_pct || 50,
          max_settlement_pct: workflowRes.data.max_settlement_pct || 100,
          is_active: workflowRes.data.is_active || false,
        });
      }

      setOutreach(outreachRes.data || []);
      setDrafts(draftsRes.data || []);

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

  const handleWorkflowSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const workflowData = {
        user_id: user.id,
        invoice_id: id!,
        tone: workflow.tone,
        cadence_days: workflow.cadence_days as any,
        min_settlement_pct: workflow.min_settlement_pct,
        max_settlement_pct: workflow.max_settlement_pct,
        is_active: workflow.is_active,
      };

      if (workflow.id) {
        const { error } = await supabase
          .from("ai_workflows")
          .update(workflowData)
          .eq("id", workflow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_workflows").insert(workflowData);
        if (error) throw error;
      }

      toast.success("Workflow settings saved");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to save workflow");
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
      toast.success("AI drafts generated successfully!");
      setGenerateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate draft");
    } finally {
      setGeneratingDraft(false);
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
    if (invoice?.reference_id) {
      navigator.clipboard.writeText(invoice.reference_id);
      setCopiedRefId(true);
      toast.success("Reference ID copied to clipboard");
      setTimeout(() => setCopiedRefId(false), 2000);
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
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">${invoice.amount.toLocaleString()}</p>
              </div>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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

        <Alert className="border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Messages are sent from your business. Recouply.ai does not act as a collection agency and does not collect on your behalf.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>AI Workflow Settings</CardTitle>
              <Button onClick={() => setGenerateDialogOpen(true)} disabled={generatingDraft}>
                {generatingDraft ? "Generating..." : "Generate AI Draft"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select
                  value={workflow.tone}
                  onValueChange={(value: "friendly" | "neutral" | "firm") => 
                    setWorkflow({ ...workflow, tone: value })
                  }
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
                <Label>Cadence Days (comma-separated)</Label>
                <Input
                  value={workflow.cadence_days.join(", ")}
                  onChange={(e) =>
                    setWorkflow({
                      ...workflow,
                      cadence_days: e.target.value.split(",").map((n) => parseInt(n.trim())),
                    })
                  }
                  placeholder="0, 3, 7, 14"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Settlement %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={workflow.min_settlement_pct}
                  onChange={(e) =>
                    setWorkflow({ ...workflow, min_settlement_pct: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Settlement %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={workflow.max_settlement_pct}
                  onChange={(e) =>
                    setWorkflow({ ...workflow, max_settlement_pct: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={workflow.is_active}
                onChange={(e) => setWorkflow({ ...workflow, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_active">Workflow Active</Label>
            </div>
            <Button onClick={handleWorkflowSave}>Save Workflow Settings</Button>
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
                        <TableRow key={log.id}>
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
                          <CardTitle>Step {draft.step_number} - {draft.channel.toUpperCase()}</CardTitle>
                          {draft.subject && <p className="text-sm text-muted-foreground">{draft.subject}</p>}
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(draft.created_at || "").toLocaleString()}
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
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => handleSendDraft(draft.id)}
                            disabled={sendingDraft === draft.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {sendingDraft === draft.id ? "Sending..." : "Approve & Send"}
                          </Button>
                          <Button variant="outline" onClick={() => handleEditDraft(draft)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDraftAction(draft.id, "discarded")}
                          >
                            Discard
                          </Button>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate AI Draft</DialogTitle>
              <DialogDescription>
                Choose the tone and step number for the outreach draft.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                {generatingDraft ? "Generating..." : "Generate"}
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
      </div>
    </Layout>
  );
};

export default InvoiceDetail;
