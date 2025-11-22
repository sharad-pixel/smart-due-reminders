import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: string;
  is_overage?: boolean;
  debtors: {
    company_name: string;
  };
}

interface Debtor {
  id: string;
  company_name: string;
}

interface InvoicesListProps {
  onUpdate: () => void;
}

const InvoicesList = ({ onUpdate }: InvoicesListProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    debtor_id: "",
    invoice_number: "",
    amount: "",
    issue_date: "",
    due_date: "",
    status: "Open" as "Open" | "Paid" | "Disputed" | "Settled" | "InPaymentPlan" | "Canceled",
  });

  useEffect(() => {
    fetchInvoices();
    fetchDebtors();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, debtors(company_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtors = async () => {
    try {
      const { data, error } = await supabase
        .from("debtors")
        .select("id, company_name")
        .order("company_name");

      if (error) throw error;
      setDebtors(data || []);
    } catch (error: any) {
      console.error("Failed to load debtors");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: invoice, error } = await supabase.from("invoices").insert([{
        ...formData,
        amount: parseFloat(formData.amount),
        user_id: user.id,
      } as any]).select().single();
      
      if (error) throw error;

      // Track invoice usage
      try {
        await supabase.functions.invoke('track-invoice-usage', {
          body: { invoice_id: invoice.id }
        });
      } catch (usageError) {
        console.error('Failed to track usage:', usageError);
        // Non-blocking - invoice was created successfully
      }
      
      toast.success("Invoice added successfully");
      setOpen(false);
      setFormData({
        debtor_id: "",
        invoice_number: "",
        amount: "",
        issue_date: "",
        due_date: "",
        status: "Open",
      });
      fetchInvoices();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to add invoice");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      
      if (error) throw error;
      
      toast.success("Invoice deleted");
      fetchInvoices();
      onUpdate();
    } catch (error: any) {
      toast.error("Failed to delete invoice");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
      case "Settled":
        return "bg-success text-white";
      case "Disputed":
      case "Canceled":
        return "bg-destructive text-white";
      case "Open":
        return "bg-info text-white";
      case "InPaymentPlan":
        return "bg-warning text-white";
      default:
        return "bg-muted";
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Track and manage outstanding invoices</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Invoice</DialogTitle>
                <DialogDescription>
                  Create an invoice for collection tracking
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="debtor_id">Customer *</Label>
                  <Select
                    value={formData.debtor_id}
                    onValueChange={(value) => setFormData({ ...formData, debtor_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {debtors.map((debtor) => (
                        <SelectItem key={debtor.id} value={debtor.id}>
                          {debtor.company_name}
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
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue_date">Issue Date *</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as "Open" | "Paid" | "Disputed" | "Settled" | "InPaymentPlan" | "Canceled" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                <Button type="submit" className="w-full">Add Invoice</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No invoices yet. Add your first invoice to start tracking collections.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {invoice.invoice_number}
                      {invoice.is_overage && (
                        <Badge variant="outline" className="text-xs">
                          Overage
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{invoice.debtors.company_name}</TableCell>
                  <TableCell>${invoice.amount.toLocaleString()}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(invoice.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoicesList;
