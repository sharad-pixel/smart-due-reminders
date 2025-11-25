import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Eye, AlertCircle, Sparkles, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AIPromptCreationModal } from "@/components/AIPromptCreationModal";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue } from "@/lib/personaConfig";

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  last_contact_date: string | null;
  debtor_id: string;
  debtors?: { name: string };
  ai_workflows?: Array<{
    id: string;
    is_active: boolean;
  }>;
}

interface Debtor {
  id: string;
  name: string;
}

const Invoices = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const debtorIdFromUrl = searchParams.get('debtor');
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ageBucketFilter, setAgeBucketFilter] = useState<string>("all");
  const [debtorFilter, setDebtorFilter] = useState<string>(debtorIdFromUrl || "all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string>("");
  const [formData, setFormData] = useState({
    debtor_id: "",
    invoice_number: "",
    amount: "",
    currency: "USD",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: "",
    status: "Open",
    payment_terms: "",
    external_link: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter, ageBucketFilter, debtorFilter]);

  const fetchData = async () => {
    try {
      const [invoicesRes, debtorsRes, agentPersonasRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, debtors(name), ai_workflows(id, is_active)")
          .order("due_date", { ascending: false }),
        supabase.from("debtors").select("id, name").order("name"),
        supabase.from("ai_agent_personas").select("name, bucket_min, bucket_max").order("bucket_min"),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (debtorsRes.error) throw debtorsRes.error;
      if (agentPersonasRes.error) throw agentPersonasRes.error;

      setInvoices(invoicesRes.data || []);
      setDebtors(debtorsRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getDaysPastDue = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getAgeBucket = (daysPastDue: number): string => {
    if (daysPastDue === 0) return "current";
    if (daysPastDue <= 30) return "0-30";
    if (daysPastDue <= 60) return "31-60";
    if (daysPastDue <= 90) return "61-90";
    if (daysPastDue <= 120) return "91-120";
    return "121+";
  };

  const handleRemoveFromWorkflow = async (invoiceId: string, workflowId: string) => {
    try {
      const { error } = await supabase
        .from("ai_workflows")
        .update({ is_active: false })
        .eq("id", workflowId);

      if (error) throw error;

      toast.success("Invoice removed from workflow");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to remove from workflow");
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedAgingBucket) {
      toast.error("Please select an aging bucket");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('bulk-assign-workflows', {
        body: {
          invoice_ids: selectedInvoices,
          action: 'assign',
          aging_bucket: selectedAgingBucket,
        },
      });

      if (error) throw error;

      // Check if it's a user-friendly error from the edge function
      if (data?.error && data?.user_friendly) {
        toast.error(data.error, {
          duration: 6000,
          action: {
            label: "Set up workflows",
            onClick: () => navigate("/settings/ai-workflows"),
          },
        });
        return;
      }

      if (data?.error) throw new Error(data.error);

      toast.success(data.message || "Invoices assigned to workflow");
      setSelectedInvoices([]);
      setShowBulkAssignDialog(false);
      setSelectedAgingBucket("");
      fetchData();
    } catch (error: any) {
      console.error('Bulk assign error:', error);
      toast.error(error.message || "Failed to assign invoices to workflow");
    }
  };

  const handleBulkUnassign = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-assign-workflows', {
        body: {
          invoice_ids: selectedInvoices,
          action: 'unassign',
        },
      });

      if (error) throw error;

      toast.success(data.message || "Invoices removed from workflows");
      setSelectedInvoices([]);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to remove invoices from workflows");
      console.error(error);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.reference_id.toLowerCase().includes(term) ||
          inv.invoice_number.toLowerCase().includes(term) ||
          inv.debtors?.name.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    if (ageBucketFilter !== "all") {
      filtered = filtered.filter((inv) => {
        const daysPastDue = getDaysPastDue(inv.due_date);
        return getAgeBucket(daysPastDue) === ageBucketFilter;
      });
    }

    if (debtorFilter !== "all") {
      filtered = filtered.filter((inv) => inv.debtor_id === debtorFilter);
    }

    setFilteredInvoices(filtered);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        debtor_id: formData.debtor_id,
        invoice_number: formData.invoice_number,
        amount: parseFloat(formData.amount),
        currency: formData.currency || "USD",
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        status: formData.status || "Open",
        payment_terms: formData.payment_terms || null,
        external_link: formData.external_link || null,
        notes: formData.notes || null,
      } as any);

      if (error) throw error;
      toast.success("Invoice created successfully");
      setIsCreateOpen(false);
      setFormData({
        debtor_id: "",
        invoice_number: "",
        amount: "",
        currency: "USD",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: "",
        status: "Open",
        payment_terms: "",
        external_link: "",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to create invoice");
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

  if (loading) {
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-primary">Invoices</h1>
            <p className="text-muted-foreground mt-2">Track and manage outstanding invoices</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAIPromptOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Create with AI
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Every invoice must be linked to a debtor. If the debtor doesn't exist yet, create them first in the <a href="/debtors" className="text-primary hover:underline font-medium">Debtors page</a>.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="debtor_id">Debtor * <span className="text-xs text-muted-foreground">(Required - invoices cannot exist without a debtor)</span></Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.debtor_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, debtor_id: value })
                          }
                          required
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select debtor" />
                          </SelectTrigger>
                          <SelectContent>
                            {debtors.map((debtor) => (
                              <SelectItem key={debtor.id} value={debtor.id}>
                                {debtor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => window.open('/debtors', '_blank')}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New Debtor
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice_number">Invoice Number *</Label>
                      <Input
                        id="invoice_number"
                        value={formData.invoice_number}
                        onChange={(e) =>
                          setFormData({ ...formData, invoice_number: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) =>
                          setFormData({ ...formData, currency: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="AUD">AUD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) =>
                          setFormData({ ...formData, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Disputed">Disputed</SelectItem>
                          <SelectItem value="Settled">Settled</SelectItem>
                          <SelectItem value="InPaymentPlan">In Payment Plan</SelectItem>
                          <SelectItem value="Canceled">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="issue_date">Issue Date *</Label>
                      <Input
                        id="issue_date"
                        type="date"
                        value={formData.issue_date}
                        onChange={(e) =>
                          setFormData({ ...formData, issue_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Due Date *</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_terms">Payment Terms</Label>
                      <Select
                        value={formData.payment_terms}
                        onValueChange={(value) =>
                          setFormData({ ...formData, payment_terms: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 45">Net 45</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                          <SelectItem value="Net 90">Net 90</SelectItem>
                          <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="external_link">External Link</Label>
                      <Input
                        id="external_link"
                        type="url"
                        placeholder="https://example.com/invoice.pdf"
                        value={formData.external_link}
                        onChange={(e) =>
                          setFormData({ ...formData, external_link: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Invoice</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference ID, invoice #, or debtor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Disputed">Disputed</SelectItem>
                  <SelectItem value="Settled">Settled</SelectItem>
                  <SelectItem value="InPaymentPlan">In Payment Plan</SelectItem>
                  <SelectItem value="Canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageBucketFilter} onValueChange={setAgeBucketFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="0-30">0-30 Days</SelectItem>
                  <SelectItem value="31-60">31-60 Days</SelectItem>
                  <SelectItem value="61-90">61-90 Days</SelectItem>
                  <SelectItem value="91-120">91-120 Days</SelectItem>
                  <SelectItem value="121+">121+ Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={debtorFilter} onValueChange={setDebtorFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Debtor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Debtors</SelectItem>
                  {debtors.map((debtor) => (
                    <SelectItem key={debtor.id} value={debtor.id}>
                      {debtor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedInvoices.length > 0 && (
              <div className="flex gap-2 mt-4">
                <span className="text-sm text-muted-foreground py-2">
                  {selectedInvoices.length} selected
                </span>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkAssignDialog(true)}
                >
                  Assign to Workflow
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkUnassign}
                >
                  Remove from Workflow
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedInvoices([])}
                >
                  Clear
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {invoices.length === 0
                    ? "No invoices yet. Create your first invoice to get started."
                    : "No invoices match your filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedInvoices(filteredInvoices.map(inv => inv.id));
                          } else {
                            setSelectedInvoices([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Reference ID</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Past Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Workflow</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const daysPastDue = getDaysPastDue(invoice.due_date);
                    const ageBucket = getAgeBucket(daysPastDue);
                    const activeWorkflow = invoice.ai_workflows?.find(w => w.is_active);
                    
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedInvoices.includes(invoice.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedInvoices([...selectedInvoices, invoice.id]);
                              } else {
                                setSelectedInvoices(selectedInvoices.filter(id => id !== invoice.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{invoice.reference_id}</TableCell>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.debtors?.name}</TableCell>
                        <TableCell className="text-right">${invoice.amount.toLocaleString()}</TableCell>
                        <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              daysPastDue === 0
                                ? "bg-green-100 text-green-800"
                                : daysPastDue <= 30
                                ? "bg-yellow-100 text-yellow-800"
                                : daysPastDue <= 60
                                ? "bg-orange-100 text-orange-800"
                                : daysPastDue <= 90
                                ? "bg-red-100 text-red-800"
                                : daysPastDue <= 120
                                ? "bg-purple-100 text-purple-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {daysPastDue === 0 ? "Current" : `${daysPastDue} days`}
                          </span>
                        </TableCell>
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
                          {activeWorkflow ? (
                            <div className="flex items-center gap-2">
                              {(() => {
                                const persona = getPersonaByDaysPastDue(daysPastDue);
                                return persona ? (
                                  <PersonaAvatar persona={persona} size="sm" showName />
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                    {ageBucket}
                                  </span>
                                );
                              })()}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFromWorkflow(invoice.id, activeWorkflow.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.last_contact_date
                            ? new Date(invoice.last_contact_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AIPromptCreationModal
          open={isAIPromptOpen}
          onOpenChange={setIsAIPromptOpen}
          onSuccess={fetchData}
        />

        <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign to Workflow</DialogTitle>
              <DialogDescription>
                Select which aging bucket workflow to assign the {selectedInvoices.length} selected invoice(s) to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="aging-bucket">Aging Bucket</Label>
              <Select value={selectedAgingBucket} onValueChange={setSelectedAgingBucket}>
                <SelectTrigger id="aging-bucket">
                  <SelectValue placeholder="Select aging bucket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current (Not Past Due)</SelectItem>
                  <SelectItem value="dpd_1_30">1-30 Days Past Due</SelectItem>
                  <SelectItem value="dpd_31_60">31-60 Days Past Due</SelectItem>
                  <SelectItem value="dpd_61_90">61-90 Days Past Due</SelectItem>
                  <SelectItem value="dpd_91_120">91-120 Days Past Due</SelectItem>
                  <SelectItem value="dpd_120_plus">121+ Days Past Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkAssign}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Invoices;
