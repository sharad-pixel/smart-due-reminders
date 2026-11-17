import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Program Hub is off by default; Recouply admins switch it on per user. */
export function useProgramHubAccess() {
  const q = useQuery({
    queryKey: ["program-hub-access"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase.rpc("has_program_hub_access" as any, { _user_id: user.id });
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 60_000,
  });
  return { hasAccess: q.data === true, loading: q.isLoading };
}
