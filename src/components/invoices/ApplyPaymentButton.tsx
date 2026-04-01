import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, ChevronDown, DollarSign, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ApplyPaymentButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  debtorId: string;
  amount: number;
  amountOutstanding?: number | null;
  currency?: string;
  status: string;
  integrationSource?: string | null;
  onSuccess?: () => void;
  /** Compact mode for table rows */
  compact?: boolean;
}

const ELIGIBLE_SOURCES = [null, "recouply_manual", "csv_upload", "ai_ingestion", "manual"];
const PAYABLE_STATUSES = ["Open", "PartiallyPaid", "InPaymentPlan"];

export function ApplyPaymentButton({
  invoiceId,
  invoiceNumber,
  debtorId,
  amount,
  amountOutstanding,
  currency = "USD",
  status,
  integrationSource,
  onSuccess,
  compact = false,
}: ApplyPaymentButtonProps) {
  const [applying, setApplying] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialMethod, setPartialMethod] = useState("");
  const [partialReference, setPartialReference] = useState("");

  const outstanding = amountOutstanding ?? amount;
  const isEligible =
    PAYABLE_STATUSES.includes(status) &&
    ELIGIBLE_SOURCES.includes(integrationSource ?? null) &&
    outstanding > 0;

  if (!isEligible) return null;

  const applyPayment = async (payAmount: number, method?: string, reference?: string) => {
    setApplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = new Date().toISOString().split("T")[0];

      // Create payment record
      const { data: newPayment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          debtor_id: debtorId,
          payment_date: today,
          amount: payAmount,
          currency,
          reference: reference || null,
          invoice_number_hint: invoiceNumber,
          reconciliation_status: "manually_matched",
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Create payment-invoice link
      await supabase.from("payment_invoice_links").insert({
        payment_id: newPayment.id,
        invoice_id: invoiceId,
        amount_applied: payAmount,
        match_confidence: 1.0,
        match_method: "manual",
        status: "confirmed",
      });

      // Calculate new outstanding
      const newOutstanding = Math.max(0, outstanding - payAmount);
      const newStatus = newOutstanding <= 0.01 ? "Paid" : "PartiallyPaid";
      const newPaymentDate = newOutstanding <= 0.01 ? today : null;

      // Update invoice
      await supabase
        .from("invoices")
        .update({
          amount_outstanding: newOutstanding,
          status: newStatus as any,
          payment_date: newPaymentDate,
          payment_method: method || null,
        })
        .eq("id", invoiceId);

      // Log activity
      await supabase.from("collection_activities").insert({
        user_id: user.id,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        activity_type: "payment_received",
        channel: "system",
        direction: "inbound",
        subject: `Payment of ${formatCurrency(payAmount, currency)} received`,
        message_body: `Payment received for Invoice #${invoiceNumber}. Amount: ${formatCurrency(payAmount, currency)}. ${newOutstanding <= 0.01 ? "Invoice fully paid." : `Remaining: ${formatCurrency(newOutstanding, currency)}`}`,
        metadata: {
          payment_id: newPayment.id,
          payment_amount: payAmount,
          payment_method: method || null,
          payment_reference: reference || null,
          previous_outstanding: outstanding,
          new_outstanding: newOutstanding,
          invoice_status: newStatus,
        },
        sent_at: new Date().toISOString(),
      });

      // Create transaction record
      await supabase.from("invoice_transactions").insert({
        invoice_id: invoiceId,
        user_id: user.id,
        transaction_type: "payment",
        amount: payAmount,
        balance_after: newOutstanding,
        payment_method: method || null,
        reference_number: reference || null,
        transaction_date: today,
        notes: `Quick payment applied. ${newOutstanding <= 0.01 ? "Invoice fully paid." : `Remaining: ${formatCurrency(newOutstanding, currency)}`}`,
        created_by: user.id,
      });

      toast.success(
        newOutstanding <= 0.01
          ? `Invoice #${invoiceNumber} marked as Paid`
          : `${formatCurrency(payAmount, currency)} applied — ${formatCurrency(newOutstanding, currency)} remaining`
      );

      setPartialOpen(false);
      setPartialAmount("");
      setPartialMethod("");
      setPartialReference("");
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to apply payment");
    } finally {
      setApplying(false);
    }
  };

  const handlePayInFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyPayment(outstanding);
  };

  const handlePartialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(partialAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > outstanding) {
      toast.error("Amount exceeds outstanding balance");
      return;
    }
    applyPayment(amt, partialMethod || undefined, partialReference || undefined);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
          onClick={handlePayInFull}
          disabled={applying}
          title={`Pay in full: ${formatCurrency(outstanding, currency)}`}
        >
          {applying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Pay
            </>
          )}
        </Button>
        <Popover open={partialOpen} onOpenChange={setPartialOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-6 px-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handlePartialSubmit} className="space-y-3">
              <div className="text-sm font-medium">Partial Payment</div>
              <div className="text-xs text-muted-foreground">
                Outstanding: {formatCurrency(outstanding, currency)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`partial-amt-${invoiceId}`} className="text-xs">Amount *</Label>
                <Input
                  id={`partial-amt-${invoiceId}`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={outstanding}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Method</Label>
                <Select value={partialMethod} onValueChange={setPartialMethod}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference</Label>
                <Input
                  value={partialReference}
                  onChange={(e) => setPartialReference(e.target.value)}
                  placeholder="e.g., Check #1234"
                  className="h-8 text-sm"
                />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={applying}>
                {applying ? "Applying..." : "Apply Partial Payment"}
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Full-size version for detail page
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="default"
        size="sm"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={handlePayInFull}
        disabled={applying}
      >
        {applying ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
        )}
        Pay in Full ({formatCurrency(outstanding, currency)})
      </Button>
      <Popover open={partialOpen} onOpenChange={setPartialOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            Partial
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <form onSubmit={handlePartialSubmit} className="space-y-3">
            <div className="font-medium text-sm">Apply Partial Payment</div>
            <div className="p-2 bg-muted rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice:</span>
                <span>#{invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding:</span>
                <span className="font-medium">{formatCurrency(outstanding, currency)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={outstanding}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={partialMethod} onValueChange={setPartialMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="wire">Wire Transfer</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference / Check Number</Label>
              <Input
                value={partialReference}
                onChange={(e) => setPartialReference(e.target.value)}
                placeholder="e.g., Check #1234"
              />
            </div>
            <Button type="submit" className="w-full" disabled={applying}>
              {applying ? "Applying..." : "Apply Payment"}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
