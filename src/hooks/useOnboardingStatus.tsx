import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";

export interface OnboardingStatus {
  hasAccounts: boolean;
  hasInvoices: boolean;
  hasPaymentInstructions: boolean;
  hasLogo: boolean;
  quickbooksConnected: boolean;
  workflowsConfigured: boolean;
  brandingConfigured: boolean;
  businessProfileConfigured: boolean;
  senderIdentityConfigured: boolean;
  brandingMissingFields: string[];
  businessProfileMissingFields: string[];
  senderIdentityMissingFields: string[];
  paymentMissingFields: string[];
  isLoading: boolean;
}

export const useOnboardingStatus = () => {
  const { accountId, isLoading: accountIdLoading } = useAccountId();

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-status", accountId],
    enabled: !!accountId && !accountIdLoading,
    queryFn: async () => {
      if (!accountId) throw new Error("No effective account available");

      const [
        { count: accountsCount },
        { count: invoicesCount },
        { count: workflowsCount },
        { data: profile },
        { data: branding },
      ] = await Promise.all([
        supabase
          .from("debtors")
          .select("id", { count: "exact", head: true })
          .eq("user_id", accountId),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("user_id", accountId),
        supabase
          .from("collection_workflows")
          .select("id", { count: "exact", head: true })
          .or(`user_id.eq.${accountId},user_id.is.null`),
        supabase
          .from("profiles_admin_safe")
          .select("quickbooks_realm_id")
          .eq("id", accountId)
          .maybeSingle(),
        supabase
          .from("branding_settings")
          .select("logo_url, business_name, industry, business_description, from_email, from_name, sending_mode, stripe_payment_link, supported_payment_methods")
          .eq("user_id", accountId)
          .maybeSingle(),
      ]);

      const hasLogo = !!branding?.logo_url;
      const hasPaymentLink = !!branding?.stripe_payment_link;
      const paymentMethods = branding?.supported_payment_methods;
      const hasPaymentMethods = Array.isArray(paymentMethods)
        ? paymentMethods.length > 0
        : !!paymentMethods && typeof paymentMethods === "object" && Object.keys(paymentMethods).length > 0;

      // Business Profile fields (Business Profile card on /branding)
      const businessProfileMissingFields: string[] = [];
      if (!branding?.business_name?.trim()) businessProfileMissingFields.push("Business Name");
      if (!branding?.industry?.trim()) businessProfileMissingFields.push("Industry");
      if (!branding?.business_description?.trim()) businessProfileMissingFields.push("Business Description");

      // Sender Identity fields (Sender Identity card on /branding)
      const senderIdentityMissingFields: string[] = [];
      const sendingMode = branding?.sending_mode || "recouply_default";
      if (!branding?.from_name?.trim()) senderIdentityMissingFields.push("From Name");
      if (sendingMode === "customer_domain" && !branding?.from_email?.trim()) {
        senderIdentityMissingFields.push("From Email");
      }

      // Combined for backward compatibility
      const brandingMissingFields = [
        ...businessProfileMissingFields,
        ...senderIdentityMissingFields,
      ];

      const paymentMissingFields: string[] = [];
      if (!hasPaymentLink) paymentMissingFields.push("Stripe Payment Link");
      if (!hasPaymentMethods) paymentMissingFields.push("Supported Payment Methods");

      return {
        hasAccounts: (accountsCount || 0) > 0,
        hasInvoices: (invoicesCount || 0) > 0,
        hasPaymentInstructions: hasPaymentLink || hasPaymentMethods,
        hasLogo,
        quickbooksConnected: !!profile?.quickbooks_realm_id,
        workflowsConfigured: (workflowsCount || 0) > 0,
        brandingConfigured: brandingMissingFields.length === 0,
        businessProfileConfigured: businessProfileMissingFields.length === 0,
        senderIdentityConfigured: senderIdentityMissingFields.length === 0,
        brandingMissingFields,
        businessProfileMissingFields,
        senderIdentityMissingFields,
        paymentMissingFields,
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
    businessProfileConfigured: data?.businessProfileConfigured ?? false,
    senderIdentityConfigured: data?.senderIdentityConfigured ?? false,
    brandingMissingFields: data?.brandingMissingFields ?? [],
    businessProfileMissingFields: data?.businessProfileMissingFields ?? [],
    senderIdentityMissingFields: data?.senderIdentityMissingFields ?? [],
    paymentMissingFields: data?.paymentMissingFields ?? [],
    isLoading: accountIdLoading || isLoading,
  };
};
