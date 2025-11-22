import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Eye, Upload, FileSpreadsheet, FileText, HelpCircle, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  last_contact_date: string | null;
  debtor_id: string;
  debtors?: { name: string };
}

interface Debtor {
  id: string;
  name: string;
}

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ageBucketFilter, setAgeBucketFilter] = useState<string>("all");
  const [debtorFilter, setDebtorFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    debtor_id: "",
    invoice_number: "",
    amount: "",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: "",
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
      const [invoicesRes, debtorsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, debtors(name)")
          .order("due_date", { ascending: false }),
        supabase.from("debtors").select("id, name").order("name"),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (debtorsRes.error) throw debtorsRes.error;

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
    return "90+";
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
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

  const downloadInvoicesTemplate = (format: 'csv' | 'excel') => {
    const headers = [
      'invoice_number',
      'debtor_email',
      'debtor_company_name',
      'amount',
      'currency',
      'issue_date',
      'due_date',
      'status',
      'external_link',
      'notes',
      'crm_account_external_id'
    ];
    
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);
    
    const exampleRows = [
      [
        'INV-2025-001',
        'john.smith@acmecorp.com',
        'Acme Corporation',
        '15000.00',
        'USD',
        today.toISOString().split('T')[0],
        dueDate.toISOString().split('T')[0],
        'Open',
        'https://example.com/invoices/INV-2025-001.pdf',
        'Q1 2025 services',
        'SF_ACC_001234'
      ]
    ];
    
    if (format === 'csv') {
      let csvContent = headers.join(',') + '\n';
      exampleRows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV template downloaded');
    } else {
      // Generate Excel file
      const wsData = [headers, ...exampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices Template');
      XLSX.writeFile(wb, 'invoices_template.xlsx');
      toast.success('Excel template downloaded');
    }
  };

  const showGoogleSheetsInstructions = () => {
    toast.info('Google Sheets instructions: Copy the CSV template structure to a new Google Sheet');
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
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        notes: formData.notes || null,
        status: "Open",
      });

      if (error) throw error;
      toast.success("Invoice created successfully");
      setIsCreateOpen(false);
      setFormData({
        debtor_id: "",
        invoice_number: "",
        amount: "",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: "",
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Invoices
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadInvoicesTemplate('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download Invoices Template (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadInvoicesTemplate('excel')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Invoices Template (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={showGoogleSheetsInstructions}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  View Google Sheets Template Instructions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="debtor_id">Debtor *</Label>
                      <Select
                        value={formData.debtor_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, debtor_id: value })
                        }
                        required
                      >
                        <SelectTrigger>
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
                  placeholder="Search by invoice # or debtor..."
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
                  <SelectItem value="90+">90+ Days</SelectItem>
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
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Past Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const daysPastDue = getDaysPastDue(invoice.due_date);
                    return (
                      <TableRow key={invoice.id}>
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
                                : "bg-red-100 text-red-800"
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
      </div>
    </Layout>
  );
};

export default Invoices;
