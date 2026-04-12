import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingStatus {
  hasAccounts: boolean;
  hasInvoices: boolean;
  hasPaymentInstructions: boolean;
  hasLogo: boolean;
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

      // Check branding configured — includes logo, payment link, and payment methods
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("logo_url, business_name, stripe_payment_link, supported_payment_methods")
        .eq("user_id", user.id)
        .maybeSingle();

      const hasLogo = !!branding?.logo_url;

      // Payment is considered configured if there's a stripe payment link OR supported payment methods with at least one entry
      const hasPaymentLink = !!branding?.stripe_payment_link;
      const paymentMethods = branding?.supported_payment_methods;
      const hasPaymentMethods = Array.isArray(paymentMethods)
        ? paymentMethods.length > 0
        : !!paymentMethods && typeof paymentMethods === "object" && Object.keys(paymentMethods).length > 0;

      return {
        hasAccounts: (accountsCount || 0) > 0,
        hasInvoices: (invoicesCount || 0) > 0,
        hasPaymentInstructions: hasPaymentLink || hasPaymentMethods,
        hasLogo,
        quickbooksConnected: !!profile?.quickbooks_realm_id,
        workflowsConfigured: (workflowsCount || 0) > 0,
        brandingConfigured: !!branding?.business_name,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    hasAccounts: data?.hasAccounts ?? false,
    hasInvoices: data?.hasInvoices ?? false,
    hasPaymentInstructions: data?.hasPaymentInstructions ?? false,
    hasLogo: data?.hasLogo ?? false,
    quickbooksConnected: data?.quickbooksConnected ?? false,
    workflowsConfigured: data?.workflowsConfigured ?? false,
    brandingConfigured: data?.brandingConfigured ?? false,
    isLoading,
  };
};
