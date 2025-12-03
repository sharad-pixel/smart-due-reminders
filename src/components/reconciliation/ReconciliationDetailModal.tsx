import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, Search } from "lucide-react";

interface Payment {
  id: string;
  debtor_id: string;
  payment_date: string;
  amount: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  invoice_number_hint: string | null;
  reconciliation_status: string;
  debtors?: {
    company_name: string;
    name: string;
  };
}

interface ReconciliationDetailModalProps {
  open: boolean;
  onClose: () => void;
  payment: Payment;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding: number;
  due_date: string;
  status: string;
}

export const ReconciliationDetailModal = ({
  open,
  onClose,
  payment,
}: ReconciliationDetailModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch open invoices for this customer
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["customer-invoices", payment.debtor_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, amount_outstanding, due_date, status")
        .eq("debtor_id", payment.debtor_id)
        .in("status", ["Open", "InPaymentPlan"])
        .gt("amount_outstanding", 0)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
  });

  const createManualMatchMutation = useMutation({
    mutationFn: async () => {
      const links = Array.from(selectedInvoices.entries()).map(([invoiceId, amount]) => ({
        payment_id: payment.id,
        invoice_id: invoiceId,
        amount_applied: amount,
        match_confidence: 1.0,
        match_method: "manual",
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      }));

      // Insert payment links
      const { error: linkError } = await supabase
        .from("payment_invoice_links")
        .insert(links);
      if (linkError) throw linkError;

      // Update payment status
      const { error: paymentError } = await supabase
        .from("payments")
        .update({ reconciliation_status: "manually_matched" })
        .eq("id", payment.id);
      if (paymentError) throw paymentError;

      // Update invoices
      for (const [invoiceId, amountApplied] of selectedInvoices.entries()) {
        const invoice = invoices?.find(i => i.id === invoiceId);
        if (invoice) {
          const newOutstanding = Math.max(0, invoice.amount_outstanding - amountApplied);
          await supabase
            .from("invoices")
            .update({
              amount_outstanding: newOutstanding,
              status: newOutstanding === 0 ? "Paid" : "Open",
            })
            .eq("id", invoiceId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Payment matched successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to match payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const totalAllocated = Array.from(selectedInvoices.values()).reduce((sum, v) => sum + v, 0);
  const remaining = payment.amount - totalAllocated;

  const handleToggleInvoice = (invoice: Invoice, checked: boolean) => {
    const newSelected = new Map(selectedInvoices);
    if (checked) {
      // Default to the lesser of remaining payment or invoice outstanding
      const amount = Math.min(remaining, invoice.amount_outstanding);
      newSelected.set(invoice.id, amount);
    } else {
      newSelected.delete(invoice.id);
    }
    setSelectedInvoices(newSelected);
  };

  const handleAmountChange = (invoiceId: string, amount: number) => {
    const newSelected = new Map(selectedInvoices);
    newSelected.set(invoiceId, amount);
    setSelectedInvoices(newSelected);
  };

  const filteredInvoices = invoices?.filter((inv) => {
    if (!searchQuery) return true;
    return inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Payment Matching</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment details */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">
                  {payment.debtors?.company_name || payment.debtors?.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Amount</p>
                <p className="font-medium">
                  {payment.currency} {payment.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Date</p>
                <p className="font-medium">
                  {format(new Date(payment.payment_date), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reference</p>
                <p className="font-medium">{payment.reference || "-"}</p>
              </div>
            </div>
          </div>

          {/* Allocation summary */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Allocated</p>
              <p className="text-lg font-bold">
                {payment.currency} {totalAllocated.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-lg font-bold ${remaining < 0 ? "text-red-600" : ""}`}>
                {payment.currency} {remaining.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Invoice search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Invoice list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredInvoices?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No open invoices found for this customer
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Apply Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices?.map((invoice) => {
                    const isSelected = selectedInvoices.has(invoice.id);
                    const allocatedAmount = selectedInvoices.get(invoice.id) || 0;

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleToggleInvoice(invoice, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{format(new Date(invoice.due_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {payment.currency} {invoice.amount_outstanding.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {isSelected ? (
                            <Input
                              type="number"
                              value={allocatedAmount}
                              onChange={(e) =>
                                handleAmountChange(invoice.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-32"
                              max={invoice.amount_outstanding}
                              min={0}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => createManualMatchMutation.mutate()}
              disabled={
                selectedInvoices.size === 0 ||
                remaining < 0 ||
                createManualMatchMutation.isPending
              }
            >
              {createManualMatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Apply Match
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
