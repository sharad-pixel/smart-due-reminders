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

export interface BatchProgress {
  current: number;
  total: number;
  percent: number;
  failed: number;
}

export const useCollectionIntelligence = (debtorId?: string) => {
  const queryClient = useQueryClient();
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  // Calculate intelligence score for a single debtor
  const calculateIntelligence = useMutation({
    mutationFn: async ({ debtor_id, recalculate_all }: { debtor_id?: string; recalculate_all?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Single debtor - direct call
      if (debtor_id && !recalculate_all) {
        const { data, error } = await supabase.functions.invoke("calculate-collection-intelligence", {
          body: { debtor_id, recalculate_all: false },
        });
        if (error) throw error;
        return data;
      }

      // Recalculate all - use batch processing
      const { data: debtors, error: fetchError } = await supabase
        .from("debtors")
        .select("id")
        .eq("is_archived", false);

      if (fetchError) throw fetchError;
      if (!debtors || debtors.length === 0) return { processed: 0 };

      const BATCH_SIZE = 5;
      const debtorIds = debtors.map(d => d.id);
      let processedCount = 0;
      let failedCount = 0;

      setBatchProgress({ current: 0, total: debtorIds.length, percent: 0, failed: 0 });

      for (let i = 0; i < debtorIds.length; i += BATCH_SIZE) {
        const batch = debtorIds.slice(i, i + BATCH_SIZE);
        
        // Process batch items in parallel
        const results = await Promise.allSettled(
          batch.map(id =>
            supabase.functions.invoke("calculate-collection-intelligence", {
              body: { debtor_id: id, recalculate_all: false },
            })
          )
        );

        results.forEach(r => {
          if (r.status === "fulfilled" && !r.value.error) {
            processedCount++;
          } else {
            failedCount++;
          }
        });

        setBatchProgress({
          current: processedCount + failedCount,
          total: debtorIds.length,
          percent: Math.round(((processedCount + failedCount) / debtorIds.length) * 100),
          failed: failedCount,
        });

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < debtorIds.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setBatchProgress(null);
      return { processed: processedCount, failed: failedCount, total: debtorIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["collection-intelligence"] });
      queryClient.invalidateQueries({ queryKey: ["collection-intelligence-dashboard"] });
      if (debtorId) {
        queryClient.invalidateQueries({ queryKey: ["debtor", debtorId] });
      }
      const msg = data?.failed 
        ? `Recalculated ${data.processed} of ${data.total} accounts (${data.failed} failed)`
        : "Collection Intelligence scores recalculated";
      toast.success(msg);
    },
    onError: (error: any) => {
      setBatchProgress(null);
      toast.error(error.message || "Failed to calculate intelligence scores");
    },
  });

  return {
    calculateIntelligence,
    batchProgress,
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

// Extended data including invoice and inbound email counts from real data
export interface DebtorIntelligenceWithInvoices extends CollectionIntelligenceData {
  paid_invoices_count: number;
  overdue_invoices_count: number;
  actual_inbound_email_count: number;
  inbound_sentiments: string[];
  has_sufficient_data: boolean;
  primary_currency: string;
}

// Hook for single debtor intelligence with real invoice AND inbound email data
export const useDebtorIntelligence = (debtorId: string) => {
  const [realtimeScore, setRealtimeScore] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["debtor-intelligence", debtorId],
    enabled: !!debtorId,
    queryFn: async () => {
      // Fetch debtor data, invoices, and inbound emails in parallel
      const [debtorResult, invoicesResult, inboundResult] = await Promise.all([
        supabase
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
          .single(),
        supabase
          .from("invoices")
          .select("id, status, due_date, currency")
          .eq("debtor_id", debtorId),
        supabase
          .from("inbound_emails")
          .select("id, ai_sentiment")
          .eq("debtor_id", debtorId)
          .order("created_at", { ascending: false }),
      ]);

      if (debtorResult.error) throw debtorResult.error;

      const debtorData = debtorResult.data;
      const invoices = invoicesResult.data || [];
      const inboundEmails = inboundResult.data || [];

      const today = new Date();
      const paidInvoices = invoices.filter(inv => inv.status === "paid" || inv.status === "Paid");
      const overdueInvoices = invoices.filter(inv => 
        !["paid", "Paid", "Canceled", "Settled"].includes(inv.status) && 
        inv.due_date && new Date(inv.due_date) < today
      );
      const totalInvoices = invoices.length;

      // Get actual inbound email count and sentiments
      const actualInboundCount = inboundEmails.length;
      const inboundSentiments = inboundEmails
        .map(e => e.ai_sentiment)
        .filter((s): s is string => !!s);

      // Determine if we have sufficient data for intelligence
      const hasSufficientData = totalInvoices > 0 || 
        (debtorData.touchpoint_count || 0) > 0 || 
        actualInboundCount > 0;

      // Determine primary currency from invoices (most common one)
      const currencyCounts = invoices.reduce((acc: Record<string, number>, inv: any) => {
        const c = inv.currency || 'USD';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
      const primaryCurrency = Object.keys(currencyCounts).sort((a, b) => currencyCounts[b] - currencyCounts[a])[0] || 'USD';

      return {
        ...debtorData,
        paid_invoices_count: paidInvoices.length,
        overdue_invoices_count: overdueInvoices.length,
        actual_inbound_email_count: actualInboundCount,
        // Use real count instead of cached count
        inbound_email_count: actualInboundCount,
        inbound_sentiments: inboundSentiments,
        has_sufficient_data: hasSufficientData,
        primary_currency: primaryCurrency,
      } as DebtorIntelligenceWithInvoices;
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

    // Also listen for new inbound emails to this debtor
    const inboundChannel = supabase
      .channel(`debtor-inbound-${debtorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inbound_emails",
          filter: `debtor_id=eq.${debtorId}`,
        },
        (payload) => {
          console.log("[REALTIME] New inbound email for debtor:", payload.new);
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(inboundChannel);
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
