import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CollectionIntelligenceData {
  id: string;
  company_name: string;
  collection_intelligence_score: number | null;
  collection_health_tier: string | null;
  touchpoint_count: number | null;
  inbound_email_count: number | null;
  response_rate: number | null;
  avg_response_sentiment: string | null;
  collection_score_updated_at: string | null;
  total_open_balance: number | null;
  current_balance: number | null;
  payment_score: number | null;
  avg_days_to_pay: number | null;
  open_invoices_count: number | null;
  disputed_invoices_count: number | null;
  max_days_past_due: number | null;
}

export const useCollectionIntelligence = (debtorId?: string) => {
  const queryClient = useQueryClient();

  // Calculate intelligence score for one or all debtors
  const calculateIntelligence = useMutation({
    mutationFn: async ({ debtor_id, recalculate_all }: { debtor_id?: string; recalculate_all?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("calculate-collection-intelligence", {
        body: { debtor_id, recalculate_all },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["collection-intelligence"] });
      if (debtorId) {
        queryClient.invalidateQueries({ queryKey: ["debtor", debtorId] });
      }
      toast.success("Collection Intelligence scores recalculated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to calculate intelligence scores");
    },
  });

  return {
    calculateIntelligence,
  };
};

export const useCollectionIntelligenceDashboard = () => {
  const [realtimeData, setRealtimeData] = useState<CollectionIntelligenceData[]>([]);

  const query = useQuery({
    queryKey: ["collection-intelligence-dashboard"],
    staleTime: 0,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("debtors")
        .select(`
          id, company_name, 
          collection_intelligence_score, collection_health_tier,
          touchpoint_count, inbound_email_count, response_rate,
          avg_response_sentiment, collection_score_updated_at,
          total_open_balance, current_balance, payment_score, avg_days_to_pay,
          open_invoices_count, disputed_invoices_count, max_days_past_due
        `)
        .eq("is_archived", false)
        .order("collection_intelligence_score", { ascending: true, nullsFirst: true });

      if (error) throw error;
      return data as CollectionIntelligenceData[];
    },
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("collection-intelligence-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "debtors",
        },
        (payload) => {
          console.log("[REALTIME] Debtor updated:", payload.new.id);
          // Update the local cache with new data
          setRealtimeData((prev) => {
            const updated = prev.map((d) =>
              d.id === payload.new.id ? { ...d, ...payload.new } : d
            );
            return updated;
          });
          // Also invalidate the query to refresh
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Merge query data with realtime updates
  const data = query.data?.map((d) => {
    const realtimeUpdate = realtimeData.find((r) => r.id === d.id);
    return realtimeUpdate ? { ...d, ...realtimeUpdate } : d;
  });

  // Calculate summary stats
  const summary = data ? {
    totalAccounts: data.length,
    healthyCount: data.filter((d) => d.collection_health_tier === "Healthy").length,
    watchCount: data.filter((d) => d.collection_health_tier === "Watch").length,
    atRiskCount: data.filter((d) => d.collection_health_tier === "At Risk").length,
    criticalCount: data.filter((d) => d.collection_health_tier === "Critical").length,
    unscored: data.filter((d) => d.collection_intelligence_score === null).length,
    avgScore: data.filter((d) => d.collection_intelligence_score !== null).length > 0
      ? Math.round(
          data.filter((d) => d.collection_intelligence_score !== null)
            .reduce((sum, d) => sum + (d.collection_intelligence_score || 0), 0) /
          data.filter((d) => d.collection_intelligence_score !== null).length
        )
      : 0,
  } : null;

  return {
    ...query,
    data,
    summary,
  };
};

// Hook for single debtor intelligence
export const useDebtorIntelligence = (debtorId: string) => {
  const [realtimeScore, setRealtimeScore] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["debtor-intelligence", debtorId],
    enabled: !!debtorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtors")
        .select(`
          id, company_name,
          collection_intelligence_score, collection_health_tier,
          touchpoint_count, inbound_email_count, response_rate,
          avg_response_sentiment, collection_score_updated_at,
          total_open_balance, current_balance, payment_score, avg_days_to_pay,
          open_invoices_count, disputed_invoices_count, max_days_past_due
        `)
        .eq("id", debtorId)
        .single();

      if (error) throw error;
      return data as CollectionIntelligenceData;
    },
  });

  // Setup realtime subscription for this specific debtor
  useEffect(() => {
    if (!debtorId) return;

    const channel = supabase
      .channel(`debtor-intelligence-${debtorId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "debtors",
          filter: `id=eq.${debtorId}`,
        },
        (payload) => {
          console.log("[REALTIME] Debtor intelligence updated:", payload.new);
          if (payload.new.collection_intelligence_score !== undefined) {
            setRealtimeScore(payload.new.collection_intelligence_score);
          }
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debtorId]);

  return {
    ...query,
    data: query.data ? {
      ...query.data,
      collection_intelligence_score: realtimeScore ?? query.data.collection_intelligence_score,
    } : null,
  };
};
