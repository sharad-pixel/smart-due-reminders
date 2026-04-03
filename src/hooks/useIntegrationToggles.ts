import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IntegrationKey = "erp_netsuite" | "erp_sage" | "salesforce";

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
