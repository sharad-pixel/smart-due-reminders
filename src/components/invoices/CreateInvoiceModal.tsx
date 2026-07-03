import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { extractDaysFromPaymentTerms, calculateDueDate } from "@/lib/paymentTerms";
import { LineItemsTable, LineItem } from "./LineItemsTable";
import { useStripeConnected } from "@/hooks/useStripeConnected";

const generateInvoiceNumber = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${ymd}-${rand}`;
};

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId?: string;
  debtorName?: string;
  availableDebtors?: Array<{ id: string; company_name: string }>;
  onInvoiceCreated?: () => void;
}

export const CreateInvoiceModal = ({
  open,
  onOpenChange,
  debtorId,
  debtorName,
  availableDebtors,
  onInvoiceCreated,
}: CreateInvoiceModalProps) => {
  const [loading, setLoading] = useState(false);
  const [acknowledgeOutreach, setAcknowledgeOutreach] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState(debtorId || "");
  const { connected: stripeConnected } = useStripeConnected();
  const [pushToStripe, setPushToStripe] = useState(true);
  const [finalizeInStripe, setFinalizeInStripe] = useState(false);

  const [accountSearchOpen, setAccountSearchOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedDebtorId(debtorId || "");
      setFormData((prev) => ({
        ...prev,
        invoice_number: prev.invoice_number || generateInvoiceNumber(),
      }));
    }
  }, [open, debtorId]);

  const selectedDebtorName =
    debtorName ||
    availableDebtors?.find((d) => d.id === selectedDebtorId)?.company_name ||
    "";
  const [formData, setFormData] = useState({
    invoice_number: generateInvoiceNumber(),
    amount: "",
    issue_date: new Date().toISOString().split('T')[0],
    due_date: "",
    payment_terms: "Net 30",
    status: "Open",
    notes: "",
    currency: "USD",
    product_description: "",
    external_invoice_id: "",
    po_number: "",
    billing_period_start: "",
    billing_period_end: "",
    billing_frequency: "one_time",
    next_billing_date: "",
  });

  // Auto-calculate due date when issue_date or payment_terms changes
  useEffect(() => {
    if (formData.issue_date && formData.payment_terms) {
      const days = extractDaysFromPaymentTerms(formData.payment_terms);
      const newDueDate = calculateDueDate(formData.issue_date, days);
      setFormData(prev => ({ ...prev, due_date: newDueDate }));
    }
  }, [formData.issue_date, formData.payment_terms]);

  // Auto-calculate amount from line items
  useEffect(() => {
    if (lineItems.length > 0) {
      const total = lineItems.reduce((sum, item) => sum + item.line_total, 0);
      setFormData(prev => ({ ...prev, amount: total.toFixed(2) }));
    }
  }, [lineItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate required fields
      if (!formData.invoice_number || !formData.amount || !formData.due_date) {
        toast.error("Please fill in all required fields");
        setLoading(false);
        return;
      }

      if (!selectedDebtorId) {
        toast.error("Please select an account");
        setLoading(false);
        return;
      }

      const parsedAmount = parseFloat(formData.amount);
      const hasLineItems = lineItems.length > 0;
      const subtotal = hasLineItems ? lineItems.reduce((sum, item) => sum + item.line_total, 0) : null;

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          debtor_id: selectedDebtorId,
          invoice_number: formData.invoice_number,
          amount: parsedAmount,
          total_amount: parsedAmount,
          subtotal: subtotal,
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          payment_terms: formData.payment_terms,
          status: formData.status as any,
          notes: formData.notes,
          currency: formData.currency,
          product_description: formData.product_description || null,
          external_invoice_id: formData.external_invoice_id || null,
          po_number: formData.po_number || null,
          billing_period_start: formData.billing_period_start || null,
          billing_period_end: formData.billing_period_end || null,
          billing_frequency: formData.billing_frequency || null,
          next_billing_date:
            formData.billing_frequency && formData.billing_frequency !== "one_time"
              ? formData.next_billing_date || null
              : null,
          reference_id: "" // Will be auto-generated by trigger
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Save line items if any
      if (hasLineItems && invoice) {
        const lineItemsToInsert = lineItems.map((item, index) => ({
          invoice_id: invoice.id,
          user_id: user.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          line_type: item.line_type || "item",
          unit_type: item.unit_type || null,
          sort_order: index,
          product_id: item.product_id ?? null,
          product_description: item.product_description ?? null,
          pricing_model: item.pricing_model ?? null,
          billing_period: item.billing_period ?? null,
          tax_behavior: item.tax_behavior ?? null,
          tax_category: item.tax_category ?? null,
          lookup_key: item.lookup_key ?? null,
          stripe_price_id: item.stripe_price_id ?? null,
        }));

        const { error: lineItemsError } = await supabase
          .from("invoice_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          console.error("Line items save error:", lineItemsError);
          toast.warning("Invoice created but line items failed to save");
        }
      }

      // Bidirectional Stripe: push newly created invoice to Stripe if connected
      if (stripeConnected && pushToStripe && invoice) {
        try {
          const { error: pushErr } = await supabase.functions.invoke("push-invoice-to-stripe", {
            body: { invoice_id: invoice.id, finalize: finalizeInStripe },
          });
          if (pushErr) throw pushErr;
          toast.success("Invoice created and pushed to Stripe");
        } catch (pushEx: any) {
          console.error("Stripe push failed", pushEx);
          toast.warning(`Invoice saved. Stripe push failed: ${pushEx.message || "unknown error"}`);
        }
      } else {
        toast.success("Invoice created successfully");
      }

      
      // Reset form
      setFormData({
        invoice_number: generateInvoiceNumber(),
        amount: "",
        issue_date: new Date().toISOString().split('T')[0],
        due_date: "",
        payment_terms: "Net 30",
        status: "Open",
        notes: "",
        currency: "USD",
        product_description: "",
        external_invoice_id: "",
        po_number: "",
        billing_period_start: "",
        billing_period_end: "",
        billing_frequency: "one_time",
        next_billing_date: "",
      });
      setLineItems([]);
      setSelectedDebtorId(debtorId || "");
      
      onOpenChange(false);
      onInvoiceCreated?.();
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast.error(error.message || "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentTermsChange = (value: string) => {
    setFormData({ ...formData, payment_terms: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedDebtorName ? `Create Invoice for ${selectedDebtorName}` : "Create New Invoice"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            New invoices count toward your monthly allotment. Only Open and InPaymentPlan invoices are tracked for collection activities.
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {availableDebtors && availableDebtors.length > 0 && !debtorId && (
            <div className="space-y-2">
              <Label htmlFor="debtor_select">
                Account <span className="text-destructive">*</span>
              </Label>
              <Popover open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="debtor_select"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountSearchOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !selectedDebtorId && "text-muted-foreground"
                    )}
                  >
                    {selectedDebtorId
                      ? availableDebtors.find((d) => d.id === selectedDebtorId)?.company_name
                      : "Select an account"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search accounts..." />
                    <CommandList>
                      <CommandEmpty>No account found.</CommandEmpty>
                      <CommandGroup>
                        {availableDebtors.map((d) => (
                          <CommandItem
                            key={d.id}
                            value={d.company_name}
                            onSelect={() => {
                              setSelectedDebtorId(d.id);
                              setAccountSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDebtorId === d.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {d.company_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">
                Invoice Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="INV-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
                disabled={lineItems.length > 0}
              />
              {lineItems.length > 0 && (
                <p className="text-xs text-muted-foreground">Auto-calculated from line items</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
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
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="PartiallyPaid">Partially Paid</SelectItem>
                  <SelectItem value="InPaymentPlan">In Payment Plan</SelectItem>
                  <SelectItem value="Disputed">Disputed</SelectItem>
                  <SelectItem value="Settled">Settled</SelectItem>
                  <SelectItem value="Canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue_date">
                Issue Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Select value={formData.payment_terms} onValueChange={handlePaymentTermsChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 45">Net 45</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                  <SelectItem value="Net 90">Net 90</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="due_date">
                Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Auto-calculated based on payment terms. You can manually adjust.
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t pt-4">
            <LineItemsTable
              items={lineItems}
              onChange={setLineItems}
              disabled={loading}
            />
          </div>

          {/* Recommended Fields */}
          <div className="space-y-4 pt-2 border-t">
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
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes about this invoice..."
              rows={2}
            />
          </div>

          {/* Outreach Acknowledgment */}
          {(formData.status === "Open" || formData.status === "InPaymentPlan") && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Automated Collection Outreach</span>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                This invoice will be enrolled in automated AI collection workflows. Our AI agents will begin sending 
                collection emails based on your configured workflows and the invoice's aging bucket.
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="acknowledge-outreach"
                  checked={acknowledgeOutreach}
                  onCheckedChange={(checked) => setAcknowledgeOutreach(checked === true)}
                />
                <Label htmlFor="acknowledge-outreach" className="text-sm cursor-pointer leading-relaxed">
                  I understand that collection outreach will begin automatically for this invoice
                </Label>
              </div>
            </div>
          )}

          {stripeConnected && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="text-sm font-medium">Stripe Sync</div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="push-stripe"
                  checked={pushToStripe}
                  onCheckedChange={(c) => setPushToStripe(c === true)}
                />
                <Label htmlFor="push-stripe" className="text-sm cursor-pointer leading-relaxed">
                  Also create this invoice in Stripe
                </Label>
              </div>
              {pushToStripe && (
                <div className="flex items-start gap-2 pl-6">
                  <Checkbox
                    id="finalize-stripe"
                    checked={finalizeInStripe}
                    onCheckedChange={(c) => setFinalizeInStripe(c === true)}
                  />
                  <Label htmlFor="finalize-stripe" className="text-xs text-muted-foreground cursor-pointer">
                    Finalize immediately (otherwise created as draft)
                  </Label>
                </div>
              )}
            </div>
          )}


          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || ((formData.status === "Open" || formData.status === "InPaymentPlan") && !acknowledgeOutreach)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Invoice"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};