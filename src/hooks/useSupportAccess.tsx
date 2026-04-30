import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SupportGrant {
  id: string;
  account_id: string;
  granted_by: string;
  scope: "read" | "write";
  reason: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export const useSupportAccess = (accountId?: string) => {
  const [activeGrant, setActiveGrant] = useState<SupportGrant | null>(null);
  const [history, setHistory] = useState<SupportGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGrants = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_access_grants")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load support grants", error);
      setLoading(false);
      return;
    }
    const rows = (data || []) as SupportGrant[];
    const now = new Date();
    setActiveGrant(
      rows.find((g) => !g.revoked_at && new Date(g.expires_at) > now) || null
    );
    setHistory(rows);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  const grantAccess = async (params: {
    durationHours: number;
    scope: "read" | "write";
    reason?: string;
  }) => {
    const { error } = await supabase.functions.invoke("grant-support-access", {
      body: params,
    });
    if (error) {
      toast.error(error.message || "Failed to grant access");
      throw error;
    }
    toast.success("Support access granted");
    await fetchGrants();
  };

  const revokeAccess = async (grantId: string) => {
    const { error } = await supabase.functions.invoke("revoke-support-access", {
      body: { grant_id: grantId },
    });
    if (error) {
      toast.error(error.message || "Failed to revoke access");
      throw error;
    }
    toast.success("Support access revoked");
    await fetchGrants();
  };

  return { activeGrant, history, loading, grantAccess, revokeAccess, refetch: fetchGrants };
};
