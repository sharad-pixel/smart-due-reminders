import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the current viewer's effective role for a CLM workspace.
 * Order of precedence:
 *   1. Internal contact (clm_instance_contacts) matched by user_id or email
 *   2. External access record (clm_external_access) matched by email
 *   3. "owner" if the viewer created the instance
 *   4. "viewer" fallback
 */
export const useMyClmRole = (
  instanceId: string | undefined,
  contacts: any[] = [],
  externalAccess: any[] = [],
  instance?: { created_by?: string | null } | null,
) => {
  return useQuery({
    queryKey: ["clm-my-role", instanceId, contacts.length, externalAccess.length],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const email = (user?.email ?? "").toLowerCase();
      const uid = user?.id;

      const internal = contacts.find((c: any) =>
        (c.user_id && c.user_id === uid) ||
        (c.email && c.email.toLowerCase() === email)
      );
      if (internal?.role) return { role: String(internal.role).toLowerCase(), userId: uid, email };

      const ext = externalAccess.find((e: any) =>
        e.email && e.email.toLowerCase() === email && !e.revoked_at
      );
      if (ext?.role) return { role: String(ext.role).toLowerCase(), userId: uid, email };

      if (instance?.created_by && instance.created_by === uid) {
        return { role: "owner", userId: uid, email };
      }
      return { role: "viewer", userId: uid, email };
    },
  });
};
