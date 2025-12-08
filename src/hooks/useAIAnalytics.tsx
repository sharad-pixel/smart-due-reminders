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
      const { data, error } = await supabase.functions.invoke("ai-analytics", {
        body: { scope, context },
      });

      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
