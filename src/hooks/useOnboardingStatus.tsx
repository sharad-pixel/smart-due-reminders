import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingStatus {
  hasAccounts: boolean;
  hasInvoices: boolean;
  stripeConnected: boolean;
  quickbooksConnected: boolean;
  workflowsConfigured: boolean;
  brandingConfigured: boolean;
  isLoading: boolean;
}

export const useOnboardingStatus = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check accounts count
      const { count: accountsCount } = await supabase
        .from("debtors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Check invoices count
      const { count: invoicesCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Check Stripe integration
      const { data: stripeIntegration } = await supabase
        .from("stripe_integrations")
        .select("stripe_secret_key_encrypted")
        .eq("user_id", user.id)
        .maybeSingle();

      // Check QuickBooks integration
      const { data: profile } = await supabase
        .from("profiles")
        .select("quickbooks_realm_id")
        .eq("id", user.id)
        .single();

      // Check workflows configured
      const { count: workflowsCount } = await supabase
        .from("collection_workflows")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      // Check branding configured
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("logo_url, business_name")
        .eq("user_id", user.id)
        .maybeSingle();

      return {
        hasAccounts: (accountsCount || 0) > 0,
        hasInvoices: (invoicesCount || 0) > 0,
        stripeConnected: !!stripeIntegration?.stripe_secret_key_encrypted,
        quickbooksConnected: !!profile?.quickbooks_realm_id,
        workflowsConfigured: (workflowsCount || 0) > 0,
        brandingConfigured: !!branding?.logo_url || !!branding?.business_name,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    hasAccounts: data?.hasAccounts ?? false,
    hasInvoices: data?.hasInvoices ?? false,
    stripeConnected: data?.stripeConnected ?? false,
    quickbooksConnected: data?.quickbooksConnected ?? false,
    workflowsConfigured: data?.workflowsConfigured ?? false,
    brandingConfigured: data?.brandingConfigured ?? false,
    isLoading,
  };
};
