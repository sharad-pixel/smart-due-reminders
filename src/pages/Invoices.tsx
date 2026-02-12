import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Eye, AlertCircle, X, ListChecks } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { calculateDueDateFromTerms } from "@/lib/paymentTerms";
import { SortableTableHead, useSorting } from "@/components/ui/sortable-table-head";
import { AIInsightsCard } from "@/components/AIInsightsCard";
import { IntegrationSourceBadge } from "@/components/IntegrationSourceBanner";

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  issue_date: string;
  due_date: string;
  payment_terms: string | null;
  status: string;
  last_contact_date: string | null;
  debtor_id: string;
  integration_source: string | null;
  has_local_overrides: boolean | null;
  debtors?: { company_name: string };
  ai_workflows?: Array<{
    id: string;
    is_active: boolean;
  }>;
}

interface Debtor {
  id: string;
  company_name: string;
}

const Invoices = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const debtorIdFromUrl = searchParams.get('debtor');
  const agingFromUrl = searchParams.get('aging');
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const saved = localStorage.getItem("invoiceStatusFilter");
    return saved || "all";
  });
  const [ageBucketFilter, setAgeBucketFilter] = useState<string>(agingFromUrl === '60plus' ? '60plus' : 'all');
  const [debtorFilter, setDebtorFilter] = useState<string>(debtorIdFromUrl || "all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [hideInactive, setHideInactive] = useState<boolean>(() => {
    const saved = localStorage.getItem("hideInactiveInvoices");
    return saved === "true";
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string>("");
  const [selectedBulkStatus, setSelectedBulkStatus] = useState<"Open" | "Paid" | "Disputed" | "Settled" | "InPaymentPlan" | "Canceled" | "FinalInternalCollections" | "">("");
  const [formData, setFormData] = useState({
    debtor_id: "",
    invoice_number: "",
    amount: "",
    currency: "USD",
    issue_date: new Date().toISOString().split("T")[0],
    status: "Open",
    payment_terms: "Net 30",
    external_link: "",
    notes: "",
    product_description: "",
    external_invoice_id: "",
    po_number: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem("hideInactiveInvoices", hideInactive.toString());
  }, [hideInactive]);

  useEffect(() => {
    localStorage.setItem("invoiceStatusFilter", statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    filterInvoices();
    setCurrentPage(1); // Reset to first page when filters change
  }, [invoices, searchTerm, statusFilter, ageBucketFilter, debtorFilter, sourceFilter, hideInactive]);

  const fetchAllInvoicesPaginated = async () => {
    const allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, debtors(company_name), ai_workflows(id, is_active), integration_source, has_local_overrides")
        .eq("is_archived", false)
        .order("due_date", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allData;
  };

  const fetchData = async () => {
    try {
      const [allInvoices, debtorsRes, agentPersonasRes] = await Promise.all([
        fetchAllInvoicesPaginated(),
        supabase.from("debtors").select("id, company_name").order("company_name"),
        supabase.from("ai_agent_personas").select("name, bucket_min, bucket_max").order("bucket_min"),
      ]);

      if (debtorsRes.error) throw debtorsRes.error;
      if (agentPersonasRes.error) throw agentPersonasRes.error;

      setInvoices(allInvoices);
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

  const handleBulkStatusChange = async () => {
    if (!selectedBulkStatus) {
      toast.error("Please select a status");
      return;
    }

    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: selectedBulkStatus })
        .in("id", selectedInvoices);

      if (error) throw error;

      toast.success(`Status updated to ${selectedBulkStatus} for ${selectedInvoices.length} invoice(s)`);
      setSelectedInvoices([]);
      setShowBulkStatusDialog(false);
      setSelectedBulkStatus("");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to update invoice statuses");
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
          inv.debtors?.company_name.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    if (ageBucketFilter !== "all") {
      filtered = filtered.filter((inv) => {
        const daysPastDue = getDaysPastDue(inv.due_date);
        const bucket = getAgeBucket(daysPastDue);
        if (ageBucketFilter === '60plus') {
          return ['61-90', '91-120', '121+'].includes(bucket);
        }
        return bucket === ageBucketFilter;
      });
    }

    if (debtorFilter !== "all") {
      filtered = filtered.filter((inv) => inv.debtor_id === debtorFilter);
    }

    if (sourceFilter !== "all") {
      filtered = filtered.filter((inv) => {
        const source = inv.integration_source || "recouply_manual";
        return source === sourceFilter;
      });
    }

    if (hideInactive) {
      const inactiveStatuses = ["Paid", "Settled", "Canceled", "Voided"];
      filtered = filtered.filter((inv) => !inactiveStatuses.includes(inv.status));
    }

    setFilteredInvoices(filtered);
  };

  // Add computed fields for sorting
  const invoicesWithComputedFields = useMemo(() => {
    return filteredInvoices.map(inv => ({
      ...inv,
      days_past_due: getDaysPastDue(inv.due_date),
      debtor_name: inv.debtors?.company_name || '',
    }));
  }, [filteredInvoices]);

  const { sortedData: sortedInvoices, sortKey, sortDirection, handleSort } = useSorting(invoicesWithComputedFields);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Calculate due date from payment terms
      const dueDate = calculateDueDateFromTerms(formData.issue_date, formData.payment_terms);

      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        debtor_id: formData.debtor_id,
        invoice_number: formData.invoice_number,
        amount: parseFloat(formData.amount),
        currency: formData.currency || "USD",
        issue_date: formData.issue_date,
        due_date: dueDate,
        status: formData.status || "Open",
        payment_terms: formData.payment_terms,
        external_link: formData.external_link || null,
        notes: formData.notes || null,
        product_description: formData.product_description || null,
        external_invoice_id: formData.external_invoice_id || null,
        po_number: formData.po_number || null,
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
        status: "Open",
        payment_terms: "Net 30",
        external_link: "",
        notes: "",
        product_description: "",
        external_invoice_id: "",
        po_number: "",
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
      Voided: "bg-slate-100 text-slate-600",
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
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">Invoices</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Track and manage outstanding invoices</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-initial" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Every invoice must be linked to an account. If the account doesn't exist yet, create it first in the <a href="/debtors" className="text-primary hover:underline font-medium">Accounts page</a>.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="debtor_id">Account * <span className="text-xs text-muted-foreground">(Required - invoices cannot exist without an account)</span></Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.debtor_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, debtor_id: value })
                          }
                          required
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {debtors.map((debtor) => (
                              <SelectItem key={debtor.id} value={debtor.id}>
                                {debtor.company_name}
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
                          New Account
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
                      <Label htmlFor="payment_terms">Payment Terms * <span className="text-xs text-muted-foreground">(Due date calculated automatically)</span></Label>
                      <Select
                        value={formData.payment_terms}
                        onValueChange={(value) =>
                          setFormData({ ...formData, payment_terms: value })
                        }
                        required
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
                  
                  {/* Recommended Fields */}
                  <div className="space-y-4 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground">Recommended Fields</p>
                    <div className="space-y-2">
                      <Label htmlFor="product_description">Product/Service Description</Label>
                      <Textarea
                        id="product_description"
                        value={formData.product_description}
                        onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                        placeholder="Describe the products or services for this invoice..."
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="external_invoice_id">External Invoice ID</Label>
                        <Input
                          id="external_invoice_id"
                          value={formData.external_invoice_id}
                          onChange={(e) => setFormData({ ...formData, external_invoice_id: e.target.value })}
                          placeholder="e.g., QB-12345"
                        />
                        <p className="text-xs text-muted-foreground">ID from your billing system</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="po_number">PO Number</Label>
                        <Input
                          id="po_number"
                          value={formData.po_number}
                          onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                          placeholder="e.g., PO-2024-001"
                        />
                        <p className="text-xs text-muted-foreground">Customer's purchase order number</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes..."
                      />
                    </div>
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

        {/* AI Insights Card - On Top */}
        <AIInsightsCard scope="invoices" compact className="mb-4" />

        {/* Main Invoices Table */}
        <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                {/* Search and Filters Row */}
                <div className="flex flex-col xl:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by reference ID, invoice #, or account..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]">
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
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Age" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Ages</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="0-30">0-30 Days</SelectItem>
                        <SelectItem value="31-60">31-60 Days</SelectItem>
                        <SelectItem value="60plus">60+ Days</SelectItem>
                        <SelectItem value="61-90">61-90 Days</SelectItem>
                        <SelectItem value="91-120">91-120 Days</SelectItem>
                        <SelectItem value="121+">121+ Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={debtorFilter} onValueChange={setDebtorFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {debtors.map((debtor) => (
                          <SelectItem key={debtor.id} value={debtor.id}>
                            {debtor.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="recouply_manual">📝 Recouply</SelectItem>
                        <SelectItem value="csv_upload">📊 CSV Import</SelectItem>
                        <SelectItem value="stripe">🔗 Stripe</SelectItem>
                        <SelectItem value="quickbooks">🔗 QuickBooks</SelectItem>
                        <SelectItem value="xero">🔗 Xero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Hide inactive toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    id="hide-inactive"
                    checked={hideInactive}
                    onCheckedChange={setHideInactive}
                  />
                  <Label htmlFor="hide-inactive" className="text-sm font-normal cursor-pointer">
                    Hide inactive (Paid, Settled, Canceled)
                  </Label>
                </div>
              </div>
              
              {/* Bulk Actions */}
              {selectedInvoices.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground py-2">
                    {selectedInvoices.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkStatusDialog(true)}
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    Change Status
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkAssignDialog(true)}
                  >
                    Assign to Workflow
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkUnassign}
                  >
                    Remove from Workflow
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
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
                        checked={sortedInvoices.length > 0 && selectedInvoices.length === sortedInvoices.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedInvoices(sortedInvoices.map(inv => inv.id));
                          } else {
                            setSelectedInvoices([]);
                          }
                        }}
                      />
                    </TableHead>
                    <SortableTableHead
                      sortKey="reference_id"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-32 font-semibold"
                    >
                      Recouply ID
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="invoice_number"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-32 font-semibold"
                    >
                      Invoice #
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="debtor_name"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="min-w-[150px] font-semibold"
                    >
                      Account
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="amount"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-28 text-right font-semibold"
                    >
                      Amount
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="issue_date"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-28 font-semibold"
                    >
                      Invoice Date
                    </SortableTableHead>
                    <TableHead className="w-28 font-semibold">Payment Terms</TableHead>
                    <SortableTableHead
                      sortKey="days_past_due"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-32 font-semibold"
                    >
                      Days Past Due
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="status"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-28 font-semibold"
                    >
                      Status
                    </SortableTableHead>
                    <TableHead className="w-32 font-semibold">AI Workflow</TableHead>
                    <TableHead className="w-24 font-semibold">Source</TableHead>
                    <SortableTableHead
                      sortKey="last_contact_date"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      className="w-28 font-semibold"
                    >
                      Last Contact
                    </SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((invoice) => {
                    const daysPastDue = invoice.days_past_due;
                    const ageBucket = getAgeBucket(daysPastDue);
                    const activeWorkflow = invoice.ai_workflows?.find(w => w.is_active);
                    
                    return (
                      <TableRow 
                        key={invoice.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                        <TableCell className="font-mono text-xs text-muted-foreground">{invoice.reference_id}</TableCell>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{invoice.debtors?.company_name}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">${invoice.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-sm tabular-nums">{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className="text-sm px-2 py-1 bg-muted/50 rounded">
                            {invoice.payment_terms || "—"}
                          </span>
                        </TableCell>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                          <IntegrationSourceBadge 
                            source={invoice.integration_source} 
                            hasOverrides={invoice.has_local_overrides || false}
                            size="xs"
                          />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {invoice.last_contact_date
                            ? new Date(invoice.last_contact_date).toLocaleDateString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            
            {/* Pagination */}
            {sortedInvoices.length > itemsPerPage && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedInvoices.length)} of {sortedInvoices.length} invoices
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {Math.ceil(sortedInvoices.length / itemsPerPage)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedInvoices.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(sortedInvoices.length / itemsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          </Card>

        {/* Bulk Status Change Dialog */}
        <Dialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Invoice Status</DialogTitle>
              <DialogDescription>
                Update the status for {selectedInvoices.length} selected invoice(s).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select
                  value={selectedBulkStatus}
                  onValueChange={(value: typeof selectedBulkStatus) => setSelectedBulkStatus(value)}
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
                    <SelectItem value="FinalInternalCollections">Final - Internal Collections</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkStatusDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusChange} disabled={!selectedBulkStatus}>
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Assign Workflow Dialog */}
        <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign to Workflow</DialogTitle>
              <DialogDescription>
                Assign {selectedInvoices.length} selected invoice(s) to an AI workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Aging Bucket</Label>
                <Select
                  value={selectedAgingBucket}
                  onValueChange={setSelectedAgingBucket}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select aging bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-30">0-30 Days</SelectItem>
                    <SelectItem value="31-60">31-60 Days</SelectItem>
                    <SelectItem value="61-90">61-90 Days</SelectItem>
                    <SelectItem value="91-120">91-120 Days</SelectItem>
                    <SelectItem value="121+">121+ Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkAssign} disabled={!selectedAgingBucket}>
                Assign to Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Invoices;
