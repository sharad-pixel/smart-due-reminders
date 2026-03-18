import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, addWeeks, addMonths } from "date-fns";
import { Edit2, Calendar, DollarSign } from "lucide-react";
import { PaymentPlan, usePaymentPlans } from "@/hooks/usePaymentPlans";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PaymentPlanEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PaymentPlan;
}

export function PaymentPlanEditModal({ open, onOpenChange, plan }: PaymentPlanEditModalProps) {
  const { updatePaymentPlan } = usePaymentPlans(plan.debtor_id);
  
  const [planName, setPlanName] = useState(plan.plan_name || "");
  const [frequency, setFrequency] = useState<"weekly" | "bi-weekly" | "monthly">(plan.frequency as any);
  const [startDate, setStartDate] = useState(format(new Date(plan.start_date), "yyyy-MM-dd"));
  const [numberOfInstallments, setNumberOfInstallments] = useState(plan.number_of_installments);
  const [notes, setNotes] = useState(plan.notes || "");

  // Reset form when plan changes
  useEffect(() => {
    setPlanName(plan.plan_name || "");
    setFrequency(plan.frequency as any);
    setStartDate(format(new Date(plan.start_date), "yyyy-MM-dd"));
    setNumberOfInstallments(plan.number_of_installments);
    setNotes(plan.notes || "");
  }, [plan]);

  const installmentAmount = plan.total_amount / numberOfInstallments;

  // Calculate preview installments
  const previewInstallments = Array.from({ length: numberOfInstallments }, (_, i) => {
    const baseDate = new Date(startDate);
    let dueDate: Date;
    switch (frequency) {
      case "weekly":
        dueDate = addWeeks(baseDate, i);
        break;
      case "bi-weekly":
        dueDate = addWeeks(baseDate, i * 2);
        break;
      case "monthly":
      default:
        dueDate = addMonths(baseDate, i);
        break;
    }
    const regularAmount = Number((plan.total_amount / numberOfInstallments).toFixed(2));
    const regularTotal = regularAmount * (numberOfInstallments - 1);
    const lastAmount = Number((plan.total_amount - regularTotal).toFixed(2));
    
    return {
      number: i + 1,
      dueDate,
      amount: i === numberOfInstallments - 1 ? lastAmount : regularAmount,
    };
  });

  const handleSave = async () => {
    await updatePaymentPlan.mutateAsync({
      planId: plan.id,
      planName: planName || undefined,
      frequency,
      startDate: new Date(startDate),
      numberOfInstallments,
      notes: notes || undefined,
    });
    onOpenChange(false);
  };

  const isEditable = plan.status === "draft" || plan.status === "proposed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Edit Payment Plan
          </DialogTitle>
          <DialogDescription>
            {isEditable 
              ? "Modify the payment plan details. Changes will update the installment schedule."
              : "This plan is already in progress and some fields cannot be modified."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plan Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-plan-name">Plan Name</Label>
            <Input
              id="edit-plan-name"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Payment Plan"
            />
          </div>

          {/* Total Amount (read-only) */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Amount
              </span>
              <span className="text-lg font-bold">
                ${plan.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total amount cannot be changed. Create a new plan if needed.
            </p>
          </div>

          {/* Payment Terms */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-installments">Number of Installments</Label>
              <Select
                value={numberOfInstallments.toString()}
                onValueChange={(value) => setNumberOfInstallments(parseInt(value))}
                disabled={!isEditable}
              >
                <SelectTrigger id="edit-installments">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 9, 12].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} payments
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-frequency">Payment Frequency</Label>
              <Select 
                value={frequency} 
                onValueChange={(v) => setFrequency(v as any)}
                disabled={!isEditable}
              >
                <SelectTrigger id="edit-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-start-date">First Payment Date</Label>
              <Input
                id="edit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!isEditable}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment per Installment</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center">
                <span className="font-semibold">
                  ~${installmentAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Preview Schedule */}
          {isEditable && (
            <div className="space-y-2">
              <Label>Updated Schedule Preview</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewInstallments.map((inst) => (
                      <TableRow key={inst.number}>
                        <TableCell className="font-medium">{inst.number}</TableCell>
                        <TableCell>{format(inst.dueDate, "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${inst.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updatePaymentPlan.isPending}
          >
            {updatePaymentPlan.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
