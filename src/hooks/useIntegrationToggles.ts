import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IntegrationKey =
  | "stripe"
  | "quickbooks"
  | "salesforce"
  | "hubspot"
  | "erp_netsuite"
  | "erp_sage"
  | "ai_ingestion";

export const INTEGRATION_LABELS: Record<IntegrationKey, string> = {
  stripe: "Stripe",
  quickbooks: "QuickBooks Online",
  salesforce: "Salesforce CRM",
  hubspot: "HubSpot CRM",
  erp_netsuite: "Oracle NetSuite",
  erp_sage: "Sage Intacct",
  ai_ingestion: "AI Smart Data Ingestion",
};

export const INTEGRATION_DESCRIPTIONS: Record<IntegrationKey, string> = {
  stripe: "Automatically sync invoices, payments, and customer data from your Stripe account. Track payment statuses, reconcile transactions, and get real-time visibility into your Stripe billing pipeline.",
  quickbooks: "Connect to QuickBooks Online to import invoices, customers, and payment records. Keep your AR data in sync with your accounting system for accurate aging reports and collection workflows.",
  salesforce: "Pull customer account data, open cases, and support history from Salesforce CRM. Enrich debtor profiles with CRM intelligence to prioritize collections and understand customer relationships.",
  hubspot: "Connect HubSpot CRM to sync contacts, companies, deals, and ticket data. Leverage CRM intelligence for smarter collections with full visibility into customer lifecycle and engagement history.",
  erp_netsuite: "Enterprise-grade integration with Oracle NetSuite. Sync customers, invoices, line items, payments, and credits. Supports sandbox and production environments with scheduled or webhook-based synchronization.",
  erp_sage: "Connect to Sage Intacct for full AR data synchronization. Import customers, invoices, and payment records with granular object mapping. Ideal for mid-market and enterprise finance teams.",
  ai_ingestion: "Use AI-powered document scanning to extract invoice data from PDFs, images, and spreadsheets. Includes smart duplicate detection, automated field mapping, and AI-assisted name cleaning for new accounts.",
};

export const ALL_INTEGRATION_KEYS: IntegrationKey[] = [
  "stripe",
  "quickbooks",
  "ai_ingestion",
  "salesforce",
  "hubspot",
  "erp_netsuite",
  "erp_sage",
];

interface IntegrationToggle {
  integration_key: string;
  is_enabled: boolean;
}

/**
 * Fetches admin-controlled integration toggles for the user's account hierarchy.
 * Only integrations explicitly enabled by an admin will be visible.
 */
export const useIntegrationToggles = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["integration-toggles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: toggles } = await supabase
        .from("integration_toggles")
        .select("integration_key, is_enabled");

      return (toggles || []) as IntegrationToggle[];
    },
  });

  const isEnabled = (key: IntegrationKey): boolean => {
    return data?.some(t => t.integration_key === key && t.is_enabled) ?? false;
  };

  return { toggles: data || [], isLoading, isEnabled };
};

/**
 * Admin hook: fetch & toggle integrations for a specific account_id.
 */
export const useAdminIntegrationToggles = (accountId: string | null) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-integration-toggles", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      if (!accountId) return [];
      const { data: toggles } = await supabase
        .from("integration_toggles")
        .select("id, integration_key, is_enabled, account_id")
        .eq("account_id", accountId);
      return (toggles || []) as Array<{
        id: string;
        integration_key: string;
        is_enabled: boolean;
        account_id: string;
      }>;
    },
  });

  const isEnabled = (key: IntegrationKey): boolean => {
    return data?.some(t => t.integration_key === key && t.is_enabled) ?? false;
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: IntegrationKey; enabled: boolean }) => {
      if (!accountId) throw new Error("No account ID");

      const existing = data?.find(t => t.integration_key === key);
      if (existing) {
        const { error } = await supabase
          .from("integration_toggles")
          .update({ is_enabled: enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integration_toggles")
          .insert({ account_id: accountId, integration_key: key, is_enabled: enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-integration-toggles", accountId] });
    },
  });

  return { toggles: data || [], isLoading, isEnabled, toggleMutation };
};
