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
  proposed_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  invoice_ids: string[];
  public_token: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

  return {
    paymentPlans,
    isLoading,
    refetch,
    fetchInstallments,
    createPaymentPlan,
    updatePlanStatus,
    markInstallmentPaid,
  };
}

// Generate AR dashboard URL for payment plan
export function getPaymentPlanARUrl(publicToken: string): string {
  return `${window.location.origin}/payment-plan/${publicToken}`;
}
