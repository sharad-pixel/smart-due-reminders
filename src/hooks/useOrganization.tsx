import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Organization {
  id: string;
  name: string;
  owner_user_id: string;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  created_at: string;
  updated_at: string;
}

export function useOrganization() {
  return useQuery({
    queryKey: ["user-organization"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get organization ID via RPC
      const { data: orgId, error: rpcError } = await supabase.rpc('get_user_organization_id', {
        p_user_id: user.id
      });

      if (rpcError) throw rpcError;
      if (!orgId) return null;

      // Fetch full organization details
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data as Organization | null;
    },
  });
}

export function useOrganizationId() {
  const { data: org } = useOrganization();
  return org?.id;
}
