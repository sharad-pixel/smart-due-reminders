import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrendAnalysis {
  metric: string;
  direction: "up" | "down" | "stable";
  change: number;
  insight: string;
  timeframe: string;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  impact: string;
  accountId?: string;
  accountName?: string;
}

export interface Prediction {
  metric: string;
  value: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

export interface RiskAlert {
  severity: "critical" | "warning" | "info";
  message: string;
  accountId?: string;
  accountName?: string;
  amount?: number;
}

export interface AIAnalyticsResult {
  summary: string;
  trends: TrendAnalysis[];
  recommendations: Recommendation[];
  predictions: Prediction[];
  riskAlerts: RiskAlert[];
}

interface UseAIAnalyticsOptions {
  scope?: "dashboard" | "accounts" | "invoices" | "tasks" | "account-detail";
  context?: Record<string, any>;
  enabled?: boolean;
}

export function useAIAnalytics(options: UseAIAnalyticsOptions = {}) {
  const { scope, context, enabled = true } = options;

  return useQuery({
    queryKey: ["ai-analytics", scope, context],
    queryFn: async (): Promise<AIAnalyticsResult> => {
      const timeoutMs = 30000; // Increased to match backend timeout
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("AI insights timed out. Please try again."));
        }, timeoutMs);
      });

      try {
        const invokePromise = supabase.functions.invoke("ai-analytics", {
          body: { scope, context },
        });

        const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

        if (error) throw error;
        return data;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    refetchOnWindowFocus: false,
    retry: 0,
  });
}
