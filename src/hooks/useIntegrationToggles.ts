import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IntegrationKey =
  | "stripe"
  | "quickbooks"
  | "salesforce"
  | "hubspot"
  | "erp_netsuite"
  | "erp_oracle"
  | "erp_sage"
  | "dnb"
  | "ai_ingestion";

export const INTEGRATION_LABELS: Record<IntegrationKey, string> = {
  stripe: "Stripe",
  quickbooks: "QuickBooks Online",
  salesforce: "Salesforce CRM",
  hubspot: "HubSpot CRM",
  erp_netsuite: "Oracle NetSuite",
  erp_oracle: "Oracle Fusion ERP",
  erp_sage: "Sage Intacct",
  dnb: "Dun & Bradstreet (D&B)",
  ai_ingestion: "AI Smart Data Ingestion",
};

export const INTEGRATION_DESCRIPTIONS: Record<IntegrationKey, string> = {
  stripe: "Automatically sync invoices, payments, and customer data from your Stripe account. Track payment statuses, reconcile transactions, and get real-time visibility into your Stripe billing pipeline.",
  quickbooks: "Connect to QuickBooks Online to import invoices, customers, and payment records. Keep your AR data in sync with your accounting system for accurate aging reports and collection workflows.",
  salesforce: "Pull customer account data, open cases, and support history from Salesforce CRM. Enrich debtor profiles with CRM intelligence to prioritize collections and understand customer relationships.",
  hubspot: "Connect HubSpot CRM to sync contacts, companies, deals, and ticket data. Leverage CRM intelligence for smarter collections with full visibility into customer lifecycle and engagement history.",
  erp_netsuite: "Enterprise-grade integration with Oracle NetSuite. Sync customers, invoices, line items, payments, and credits. Supports sandbox and production environments with scheduled or webhook-based synchronization.",
  erp_oracle: "Connect Oracle Fusion Cloud ERP / E-Business Suite for enterprise AR synchronization. Sync customers, transactions, receipts, and adjustments via Oracle REST APIs with sandbox and production environment support.",
  erp_sage: "Connect to Sage Intacct for full AR data synchronization. Import customers, invoices, and payment records with granular object mapping. Ideal for mid-market and enterprise finance teams.",
  dnb: "Enrich every account with Dun & Bradstreet credit intelligence: D-U-N-S numbers, PAYDEX scores, Failure Score, Delinquency Score, firmographics, and corporate hierarchies. Powers automated credit limits and risk-tiered outreach.",
  ai_ingestion: "Use AI-powered document scanning to extract invoice data from PDFs, images, and spreadsheets. Includes smart duplicate detection, automated field mapping, and AI-assisted name cleaning for new accounts.",
};

export const ALL_INTEGRATION_KEYS: IntegrationKey[] = [
  "stripe",
  "quickbooks",
  "ai_ingestion",
  "salesforce",
  "hubspot",
  "erp_netsuite",
  "erp_oracle",
  "erp_sage",
  "dnb",
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

      // Get ALL accounts this user belongs to
      const { data: memberships } = await supabase
        .from("account_users")
        .select("account_id, is_owner")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (!memberships?.length) return [];

      // Use effective account: prefer the parent account (where user is NOT owner / is team member),
      // falling back to their own account. This mirrors useEffectiveAccount logic.
      const teamMembership = memberships.find(m => !m.is_owner);
      const effectiveAccountId = teamMembership?.account_id 
        ?? memberships.find(m => m.is_owner)?.account_id;

      if (!effectiveAccountId) return [];

      const { data: toggles } = await supabase
        .from("integration_toggles")
        .select("integration_key, is_enabled")
        .eq("account_id", effectiveAccountId);

      return (toggles || []) as IntegrationToggle[];
    },
  });

  // Integrations that are enabled by default for all accounts
  const DEFAULT_ENABLED: IntegrationKey[] = ["ai_ingestion"];

  const isEnabled = (key: IntegrationKey): boolean => {
    const toggle = data?.find(t => t.integration_key === key);
    // If there's an explicit toggle, use it; otherwise check defaults
    if (toggle) return toggle.is_enabled;
    return DEFAULT_ENABLED.includes(key);
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

  // Integrations that are enabled by default for all accounts
  const DEFAULT_ENABLED: IntegrationKey[] = ["ai_ingestion"];

  const isEnabled = (key: IntegrationKey): boolean => {
    const toggle = data?.find(t => t.integration_key === key);
    if (toggle) return toggle.is_enabled;
    return DEFAULT_ENABLED.includes(key);
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
