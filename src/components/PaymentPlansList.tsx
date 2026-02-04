import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink, Calendar, DollarSign, CheckCircle, Clock, XCircle, Link2, Send, Edit2, Trash2, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { usePaymentPlans, PaymentPlan, PaymentPlanInstallment, getPaymentPlanARUrl } from "@/hooks/usePaymentPlans";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaymentPlanEditModal } from "./PaymentPlanEditModal";
import { PaymentPlanResendModal } from "./PaymentPlanResendModal";

// Get the debtor portal URL
const getDebtorPortalUrl = () => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/debtor-portal`;
};

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { markInstallmentPaid, updatePlanStatus, deletePaymentPlan, regenerateInstallments, adminApprovePlan } = usePaymentPlans(plan.debtor_id);

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

  const canResend = plan.status !== "cancelled" && plan.status !== "completed" && plan.status !== "defaulted";
  const canEdit = plan.status === "draft" || plan.status === "proposed";
  const canDelete = plan.status === "draft" || plan.status === "proposed" || plan.status === "cancelled";
  const canRegenerate = plan.status === "draft" || plan.status === "proposed";
  const needsAdminApproval = plan.requires_dual_approval && !plan.admin_approved_at;
  const hasDebtorApproval = !!plan.debtor_approved_at;

  return (
    <Card className="overflow-hidden">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Header row: trigger (left) + always-visible actions (right) */}
        <div className="p-4 hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-label={expanded ? "Collapse payment plan" : "Expand payment plan"}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{plan.plan_name || `Payment Plan`}</span>
                    <Badge className={statusColors[plan.status] || statusColors.draft}>{plan.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${plan.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {plan.number_of_installments} {plan.frequency} payments
                    </span>
                    <span>Started: {format(new Date(plan.start_date), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </button>
            </CollapsibleTrigger>

            <div className="flex items-center gap-2 shrink-0">
              {/* Progress indicator */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{paidCount}/{totalCount} paid</span>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Creditor/admin approve should be discoverable even when collapsed */}
              {needsAdminApproval && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => adminApprovePlan.mutate(plan.id)}
                  disabled={adminApprovePlan.isPending}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  {adminApprovePlan.isPending ? "Approving..." : "Admin Approve"}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => canEdit && setEditModalOpen(true)}
                disabled={!canEdit}
                title={!canEdit ? "Edit is available for Draft/Proposed plans" : undefined}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => canDelete && setDeleteConfirmOpen(true)}
                disabled={!canDelete}
                title={!canDelete ? "Delete is available for Draft/Proposed/Cancelled plans" : undefined}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

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

            {/* Resend, Edit, Regenerate & Delete Actions */}
            <div className="flex gap-2 flex-wrap">
              {canResend && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setResendModalOpen(true)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Resend Link
                </Button>
              )}
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit Plan
                </Button>
              )}
              {canRegenerate && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => regenerateInstallments.mutate(plan.id)}
                  disabled={regenerateInstallments.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${regenerateInstallments.isPending ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              )}
              {canDelete && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
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

            {/* Dual Approval Status */}
            {plan.requires_dual_approval && (
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserCheck className={`h-4 w-4 ${hasDebtorApproval ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm">
                    Debtor: {hasDebtorApproval ? (
                      <span className="text-green-600 font-medium">Approved</span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${plan.admin_approved_at ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <span className="text-sm">
                    Admin: {plan.admin_approved_at ? (
                      <span className="text-green-600 font-medium">Approved</span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Status Actions */}
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
              {needsAdminApproval && (
                <Button
                  size="sm"
                  variant="default"
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => adminApprovePlan.mutate(plan.id)}
                  disabled={adminApprovePlan.isPending}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  {adminApprovePlan.isPending ? "Approving..." : "Admin Approve"}
                </Button>
              )}
              {plan.status === "proposed" && !plan.requires_dual_approval && (
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

      {/* Edit Modal */}
      <PaymentPlanEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        plan={plan}
      />

      {/* Resend Modal */}
      <PaymentPlanResendModal
        open={resendModalOpen}
        onOpenChange={setResendModalOpen}
        plan={plan}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment plan? This will remove the plan and all its installments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePaymentPlan.mutate(plan.id)}
            >
              {deletePaymentPlan.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      {/* Debtor Portal Link Info */}
      <DebtorPortalLink />
      
      {paymentPlans.map((plan) => (
        <PaymentPlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function DebtorPortalLink() {
  const [copied, setCopied] = useState(false);
  const portalUrl = getDebtorPortalUrl();

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success("Debtor portal link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Debtor Portal</p>
              <p className="text-xs text-muted-foreground">
                Customers can access their payment plans via email verification
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Copy Link
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(portalUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open Portal
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
