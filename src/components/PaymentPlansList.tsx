import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink, Calendar, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";
import { usePaymentPlans, PaymentPlan, PaymentPlanInstallment, getPaymentPlanARUrl } from "@/hooks/usePaymentPlans";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PaymentPlansListProps {
  debtorId: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  proposed: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
  defaulted: "bg-red-200 text-red-900",
};

const installmentStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function PaymentPlanCard({ plan }: { plan: PaymentPlan }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { markInstallmentPaid, updatePlanStatus } = usePaymentPlans(plan.debtor_id);

  // Fetch installments when expanded
  const { data: installments, isLoading: loadingInstallments } = useQuery({
    queryKey: ["payment-plan-installments", plan.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plan_installments")
        .select("*")
        .eq("payment_plan_id", plan.id)
        .order("installment_number");
      if (error) throw error;
      return data as PaymentPlanInstallment[];
    },
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getPaymentPlanARUrl(plan.public_token));
    setCopiedLink(true);
    toast.success("Payment plan link copied");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const paidCount = installments?.filter((i) => i.status === "paid").length || 0;
  const totalCount = installments?.length || plan.number_of_installments;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {plan.plan_name || `Payment Plan`}
                    </span>
                    <Badge className={statusColors[plan.status] || statusColors.draft}>
                      {plan.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${plan.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {plan.number_of_installments} {plan.frequency} payments
                    </span>
                    <span>
                      Started: {format(new Date(plan.start_date), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Progress indicator */}
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{paidCount}/{totalCount} paid</span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}>
                  {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 py-4 space-y-4">
            {/* AR Link */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">AR Dashboard Link</p>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                  {getPaymentPlanARUrl(plan.public_token)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copiedLink ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(getPaymentPlanARUrl(plan.public_token), "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </div>

            {/* Installments Table */}
            {loadingInstallments ? (
              <div className="text-center py-4 text-muted-foreground">Loading installments...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid On</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments?.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.installment_number}</TableCell>
                      <TableCell>{format(new Date(inst.due_date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-mono">
                        ${inst.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={installmentStatusColors[inst.status] || installmentStatusColors.pending}>
                          {inst.status === "paid" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {inst.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {inst.status === "overdue" && <XCircle className="h-3 w-3 mr-1" />}
                          {inst.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inst.paid_at ? format(new Date(inst.paid_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        {inst.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markInstallmentPaid.mutate({ installmentId: inst.id })}
                            disabled={markInstallmentPaid.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              {plan.status === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updatePlanStatus.mutate({ planId: plan.id, status: "cancelled" })}
                >
                  Cancel Plan
                </Button>
              )}
              {plan.status === "proposed" && (
                <Button
                  size="sm"
                  onClick={() => updatePlanStatus.mutate({ planId: plan.id, status: "accepted" })}
                >
                  Mark as Accepted
                </Button>
              )}
              {(plan.status === "accepted" || plan.status === "active") && paidCount === totalCount && totalCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => updatePlanStatus.mutate({ planId: plan.id, status: "completed" })}
                >
                  Mark as Completed
                </Button>
              )}
            </div>

            {plan.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  <strong>Notes:</strong> {plan.notes}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function PaymentPlansList({ debtorId }: PaymentPlansListProps) {
  const { paymentPlans, isLoading } = usePaymentPlans(debtorId);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading payment plans...
      </div>
    );
  }

  if (!paymentPlans || paymentPlans.length === 0) {
    return (
      <div className="text-center py-8">
        <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No payment plans created yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create a payment plan to help this account manage their outstanding balance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paymentPlans.map((plan) => (
        <PaymentPlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
