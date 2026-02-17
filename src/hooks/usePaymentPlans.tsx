import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, addMonths, format } from "date-fns";

export interface PaymentPlan {
  id: string;
  user_id: string;
  organization_id: string | null;
  debtor_id: string;
  plan_name: string | null;
  total_amount: number;
  number_of_installments: number;
  installment_amount: number;
  frequency: string;
  start_date: string;
  status: string;
  currency: string;
  proposed_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  invoice_ids: string[];
  public_token: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Dual approval fields
  debtor_approved_at: string | null;
  debtor_approved_by_email: string | null;
  admin_approved_at: string | null;
  admin_approved_by: string | null;
  requires_dual_approval: boolean;
}

export interface PaymentPlanInstallment {
  id: string;
  payment_plan_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
  payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentPlanData {
  debtorId: string;
  totalAmount: number;
  numberOfInstallments: number;
  frequency: "weekly" | "bi-weekly" | "monthly";
  startDate: Date;
  planName?: string;
  invoiceIds?: string[];
  notes?: string;
  currency?: string;
}

// Calculate installment due dates based on frequency
function calculateInstallmentDates(
  startDate: Date,
  count: number,
  frequency: string
): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    let dueDate: Date;
    switch (frequency) {
      case "weekly":
        dueDate = addWeeks(startDate, i);
        break;
      case "bi-weekly":
        dueDate = addWeeks(startDate, i * 2);
        break;
      case "monthly":
      default:
        dueDate = addMonths(startDate, i);
        break;
    }
    dates.push(dueDate);
  }
  return dates;
}

export function usePaymentPlans(debtorId?: string) {
  const queryClient = useQueryClient();

  // Fetch payment plans for a debtor
  const {
    data: paymentPlans,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["payment-plans", debtorId],
    enabled: !!debtorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plans")
        .select("*")
        .eq("debtor_id", debtorId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PaymentPlan[];
    },
  });

  // Fetch installments for a payment plan
  const fetchInstallments = async (planId: string): Promise<PaymentPlanInstallment[]> => {
    const { data, error } = await supabase
      .from("payment_plan_installments")
      .select("*")
      .eq("payment_plan_id", planId)
      .order("installment_number");

    if (error) throw error;
    return data as PaymentPlanInstallment[];
  };

  // Create a new payment plan with installments
  const createPaymentPlan = useMutation({
    mutationFn: async (planData: CreatePaymentPlanData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase.rpc("get_effective_account_id", {
        p_user_id: user.id,
      });

      // Get organization ID
      const { data: orgId } = await supabase.rpc("get_user_organization_id", {
        p_user_id: effectiveAccountId || user.id,
      });

      // Check for existing active payment plan (enforced at DB level but good to check here too)
      const { data: existingPlan } = await supabase
        .from("payment_plans")
        .select("id, status")
        .eq("debtor_id", planData.debtorId)
        .not("status", "in", "(cancelled,completed,defaulted)")
        .maybeSingle();

      if (existingPlan) {
        throw new Error("This account already has an active payment plan. Please complete or cancel the existing plan first.");
      }

      const installmentAmount = Number((planData.totalAmount / planData.numberOfInstallments).toFixed(2));
      
      // Handle rounding - last installment gets remainder
      const regularInstallmentTotal = installmentAmount * (planData.numberOfInstallments - 1);
      const lastInstallmentAmount = Number((planData.totalAmount - regularInstallmentTotal).toFixed(2));

      // Create the payment plan
      const { data: plan, error: planError } = await supabase
        .from("payment_plans")
        .insert({
          user_id: effectiveAccountId || user.id,
          organization_id: orgId || null,
          debtor_id: planData.debtorId,
          plan_name: planData.planName || `Payment Plan - ${format(planData.startDate, "MMM d, yyyy")}`,
          total_amount: planData.totalAmount,
          number_of_installments: planData.numberOfInstallments,
          installment_amount: installmentAmount,
          frequency: planData.frequency,
          start_date: format(planData.startDate, "yyyy-MM-dd"),
          invoice_ids: planData.invoiceIds || [],
          notes: planData.notes || null,
          status: "draft",
          requires_dual_approval: true,
          currency: planData.currency || 'USD',
        })
        .select()
        .single();

      if (planError) throw planError;

      // Calculate installment dates and create installments
      const dueDates = calculateInstallmentDates(
        planData.startDate,
        planData.numberOfInstallments,
        planData.frequency
      );

      const installments = dueDates.map((dueDate, index) => ({
        payment_plan_id: plan.id,
        installment_number: index + 1,
        due_date: format(dueDate, "yyyy-MM-dd"),
        amount: index === planData.numberOfInstallments - 1 ? lastInstallmentAmount : installmentAmount,
        status: "pending",
      }));

      const { error: installmentsError } = await supabase
        .from("payment_plan_installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      return plan as PaymentPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
      toast.success("Payment plan created successfully");
    },
    onError: (error: any) => {
      console.error("Error creating payment plan:", error);
      toast.error(error.message || "Failed to create payment plan");
    },
  });

  // Update payment plan details
  const updatePaymentPlan = useMutation({
    mutationFn: async ({
      planId,
      planName,
      frequency,
      startDate,
      numberOfInstallments,
      notes,
    }: {
      planId: string;
      planName?: string;
      frequency?: string;
      startDate?: Date;
      numberOfInstallments?: number;
      notes?: string;
    }) => {
      const { data: existingPlan, error: fetchError } = await supabase
        .from("payment_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: Record<string, any> = {};
      if (planName !== undefined) updateData.plan_name = planName;
      if (frequency !== undefined) updateData.frequency = frequency;
      if (notes !== undefined) updateData.notes = notes;

      // If installments or start date changes, recalculate installments
      const needsInstallmentRecalc = 
        (numberOfInstallments !== undefined && numberOfInstallments !== existingPlan.number_of_installments) ||
        (startDate !== undefined);

      if (startDate !== undefined) updateData.start_date = format(startDate, "yyyy-MM-dd");
      if (numberOfInstallments !== undefined) {
        updateData.number_of_installments = numberOfInstallments;
        updateData.installment_amount = Number((existingPlan.total_amount / numberOfInstallments).toFixed(2));
      }

      const { error: updateError } = await supabase
        .from("payment_plans")
        .update(updateData)
        .eq("id", planId);

      if (updateError) throw updateError;

      // Recalculate installments if needed
      if (needsInstallmentRecalc) {
        const newNumInstallments = numberOfInstallments || existingPlan.number_of_installments;
        const newStartDate = startDate || new Date(existingPlan.start_date);
        const newFrequency = frequency || existingPlan.frequency;

        // Delete existing installments
        await supabase
          .from("payment_plan_installments")
          .delete()
          .eq("payment_plan_id", planId);

        // Create new installments
        const installmentAmount = Number((existingPlan.total_amount / newNumInstallments).toFixed(2));
        const regularTotal = installmentAmount * (newNumInstallments - 1);
        const lastInstallmentAmount = Number((existingPlan.total_amount - regularTotal).toFixed(2));

        const dueDates = calculateInstallmentDates(newStartDate, newNumInstallments, newFrequency);
        const installments = dueDates.map((dueDate, index) => ({
          payment_plan_id: planId,
          installment_number: index + 1,
          due_date: format(dueDate, "yyyy-MM-dd"),
          amount: index === newNumInstallments - 1 ? lastInstallmentAmount : installmentAmount,
          status: "pending",
        }));

        const { error: installmentsError } = await supabase
          .from("payment_plan_installments")
          .insert(installments);

        if (installmentsError) throw installmentsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
      toast.success("Payment plan updated");
    },
    onError: (error: any) => {
      console.error("Error updating payment plan:", error);
      toast.error(error.message || "Failed to update payment plan");
    },
  });

  // Update payment plan status
  const updatePlanStatus = useMutation({
    mutationFn: async ({ planId, status }: { planId: string; status: string }) => {
      const updateData: Record<string, any> = { status };
      
      if (status === "proposed") updateData.proposed_at = new Date().toISOString();
      if (status === "accepted") updateData.accepted_at = new Date().toISOString();
      if (status === "completed") updateData.completed_at = new Date().toISOString();
      if (status === "cancelled") updateData.cancelled_at = new Date().toISOString();

      const { error } = await supabase
        .from("payment_plans")
        .update(updateData)
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update payment plan");
    },
  });

  // Mark installment as paid
  const markInstallmentPaid = useMutation({
    mutationFn: async ({ installmentId, paymentId }: { installmentId: string; paymentId?: string }) => {
      const { error } = await supabase
        .from("payment_plan_installments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_id: paymentId || null,
        })
        .eq("id", installmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
      toast.success("Installment marked as paid");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update installment");
    },
  });

  // Resend payment plan link to debtor contacts
  const resendPlanLink = useMutation({
    mutationFn: async ({ planId, emails }: { planId: string; emails: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the plan details
      const { data: plan, error: planError } = await supabase
        .from("payment_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError) throw planError;

      // Get debtor details
      const { data: debtor } = await supabase
        .from("debtors")
        .select("company_name, name")
        .eq("id", plan.debtor_id)
        .single();

      // Get branding
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("business_name, from_name, from_email, primary_color")
        .eq("user_id", user.id)
        .single();

      const businessName = branding?.business_name || "Recouply";
      const debtorName = debtor?.company_name || debtor?.name || "Customer";
      const arUrl = getPaymentPlanARUrl(plan.public_token);

      const emailBody = `
Dear ${debtorName},

This is a reminder about your payment plan with ${businessName}.

**Payment Plan Details:**
- Total Amount: $${plan.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
- Number of Installments: ${plan.number_of_installments}
- Payment Frequency: ${plan.frequency.replace("-", " ")}
- First Payment Due: ${format(new Date(plan.start_date), "MMMM d, yyyy")}

To review your payment schedule and make payments, please visit your AR Dashboard:
${arUrl}

If you have any questions, please reply to this email.

Best regards,
${businessName}
      `.trim();

      const htmlBody = emailBody
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");

      // Send email
      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: {
          to: emails,
          from: `${businessName} <notifications@send.inbound.services.recouply.ai>`,
          subject: `Payment Plan Reminder - ${businessName}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">${htmlBody}</div>`,
          text: emailBody,
        },
      });

      if (sendError) throw sendError;

      // Log the activity
      await supabase.from("collection_activities").insert({
        user_id: user.id,
        debtor_id: plan.debtor_id,
        activity_type: "payment_plan_reminder",
        channel: "email",
        direction: "outbound",
        subject: `Payment Plan Reminder - ${businessName}`,
        message_body: emailBody,
        sent_at: new Date().toISOString(),
        metadata: {
          payment_plan_id: planId,
          sent_to: emails,
        },
      });

      return { sentTo: emails.length };
    },
    onSuccess: (data) => {
      toast.success(`Payment plan link sent to ${data.sentTo} contact(s)`);
    },
    onError: (error: any) => {
      console.error("Error resending payment plan link:", error);
      toast.error(error.message || "Failed to send payment plan link");
    },
  });

  // Delete a payment plan and its installments
  const deletePaymentPlan = useMutation({
    mutationFn: async (planId: string) => {
      // Delete installments first (due to FK constraint)
      await supabase
        .from("payment_plan_installments")
        .delete()
        .eq("payment_plan_id", planId);

      // Delete the plan
      const { error } = await supabase
        .from("payment_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
      toast.success("Payment plan deleted");
    },
    onError: (error: any) => {
      console.error("Error deleting payment plan:", error);
      toast.error(error.message || "Failed to delete payment plan");
    },
  });

  // Regenerate installments for a payment plan
  const regenerateInstallments = useMutation({
    mutationFn: async (planId: string) => {
      // Get the plan details
      const { data: plan, error: fetchError } = await supabase
        .from("payment_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (fetchError) throw fetchError;

      // Delete existing installments
      await supabase
        .from("payment_plan_installments")
        .delete()
        .eq("payment_plan_id", planId);

      // Recalculate and create new installments
      const installmentAmount = Number((plan.total_amount / plan.number_of_installments).toFixed(2));
      const regularTotal = installmentAmount * (plan.number_of_installments - 1);
      const lastInstallmentAmount = Number((plan.total_amount - regularTotal).toFixed(2));

      const dueDates = calculateInstallmentDates(
        new Date(plan.start_date),
        plan.number_of_installments,
        plan.frequency
      );

      const installments = dueDates.map((dueDate, index) => ({
        payment_plan_id: planId,
        installment_number: index + 1,
        due_date: format(dueDate, "yyyy-MM-dd"),
        amount: index === plan.number_of_installments - 1 ? lastInstallmentAmount : installmentAmount,
        status: "pending",
      }));

      const { error: installmentsError } = await supabase
        .from("payment_plan_installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
      toast.success("Installments regenerated");
    },
    onError: (error: any) => {
      console.error("Error regenerating installments:", error);
      toast.error(error.message || "Failed to regenerate installments");
    },
  });

  // Admin approves the payment plan
  const adminApprovePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("payment_plans")
        .update({
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: user.id,
        })
        .eq("id", planId);

      if (error) throw error;

      // Check if both approvals are in and auto-activate
      const { data: plan } = await supabase
        .from("payment_plans")
        .select("debtor_approved_at, admin_approved_at")
        .eq("id", planId)
        .single();

      if (plan?.debtor_approved_at && plan?.admin_approved_at) {
        await supabase
          .from("payment_plans")
          .update({ status: "active", accepted_at: new Date().toISOString() })
          .eq("id", planId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans", debtorId] });
      toast.success("Payment plan approved by admin");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve payment plan");
    },
  });

  return {
    paymentPlans,
    isLoading,
    refetch,
    fetchInstallments,
    createPaymentPlan,
    updatePaymentPlan,
    updatePlanStatus,
    markInstallmentPaid,
    resendPlanLink,
    deletePaymentPlan,
    regenerateInstallments,
    adminApprovePlan,
  };
}

// Generate AR dashboard URL for payment plan
export function getPaymentPlanARUrl(publicToken: string): string {
  return `${window.location.origin}/payment-plan/${publicToken}`;
}
