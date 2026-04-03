import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IntegrationKey =
  | "stripe"
  | "quickbooks"
  | "salesforce"
  | "erp_netsuite"
  | "erp_sage"
  | "ai_ingestion";

export const INTEGRATION_LABELS: Record<IntegrationKey, string> = {
  stripe: "Stripe",
  quickbooks: "QuickBooks Online",
  salesforce: "Salesforce CRM",
  erp_netsuite: "Oracle NetSuite",
  erp_sage: "Sage Intacct",
  ai_ingestion: "AI Smart Data Ingestion",
};

export const ALL_INTEGRATION_KEYS: IntegrationKey[] = [
  "stripe",
  "quickbooks",
  "ai_ingestion",
  "salesforce",
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
