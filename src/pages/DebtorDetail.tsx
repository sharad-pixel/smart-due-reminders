import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { TasksSummaryCard } from "@/components/TasksSummaryCard";
import { useCollectionTasks } from "@/hooks/useCollectionTasks";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Edit, Trash2, Mail, Phone as PhoneIcon, Building, MapPin, Copy, Check, MessageSquare, Clock, ExternalLink, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const { fetchTasks } = useCollectionTasks();
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outreach, setOutreach] = useState<OutreachLog[]>([]);
  const [crmAccounts, setCrmAccounts] = useState<CRMAccount[]>([]);
  const [debtorTasks, setDebtorTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [linkingCrm, setLinkingCrm] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState(false);
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
    }
  }, [id]);

  const fetchDebtorTasks = async () => {
    const tasks = await fetchTasks({ debtor_id: id });
    setDebtorTasks(tasks.filter(t => t.status !== 'done'));
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
      toast.error("Failed to load debtor details");
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
        .order("due_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
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
      toast.success("Debtor updated successfully");
      setIsEditOpen(false);
      fetchDebtor();
    } catch (error: any) {
      toast.error(error.message || "Failed to update debtor");
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("debtors")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Debtor deleted successfully");
      navigate("/debtors");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete debtor");
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
              <h1 className="text-4xl font-bold text-primary">{debtor.name}</h1>
              <p className="text-muted-foreground mt-1">{debtor.company_name}</p>
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
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{debtor.email}</p>
                </div>
              </div>
              {debtor.phone && (
                <div className="flex items-center space-x-3">
                  <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{debtor.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Name</p>
                  <p className="font-medium">{debtor.contact_name}</p>
                </div>
              </div>
              {debtor.address && (
                <div className="flex items-center space-x-3">
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

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="outreach">Outreach History ({outreach.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardContent className="pt-6">
                {invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No invoices for this debtor yet.</p>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outreach">
            <Card>
              <CardHeader>
                <CardTitle>Communication Audit Trail</CardTitle>
                <p className="text-sm text-muted-foreground">Complete history of all communications with this debtor</p>
              </CardHeader>
              <CardContent className="pt-6">
                {outreach.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No outreach history for this debtor yet.</p>
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
              <DialogTitle>Edit Debtor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
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

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this debtor and all related data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default DebtorDetail;
