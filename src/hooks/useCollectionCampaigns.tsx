import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CampaignStrategy {
  campaignName: string;
  recommendedTone: "friendly" | "firm" | "urgent" | "legal";
  recommendedChannel: "email" | "phone" | "sms" | "multi-channel";
  strategyPoints: string[];
  expectedTimeline: string;
  riskMitigation?: string[];
  confidenceScore: number;
  executiveSummary: string;
}

export interface AccountSummary {
  id: string;
  name: string;
  riskScore: number;
  riskTier: string;
  totalBalance: number;
  avgDaysToPay: number;
  openInvoicesCount: number;
  maxDaysPastDue: number;
  agingMix: {
    current: number;
    dpd_1_30: number;
    dpd_31_60: number;
    dpd_61_90: number;
    dpd_91_120: number;
    dpd_121_plus: number;
  };
}

export interface CampaignSummary {
  totalAccounts: number;
  totalBalance: number;
  avgRiskScore: number;
  avgDaysPastDue: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  agingByBalance: {
    current: number;
    dpd_1_30: number;
    dpd_31_60: number;
    dpd_61_90: number;
    dpd_91_120: number;
    dpd_121_plus: number;
  };
}

export interface CollectionCampaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_risk_tier: string;
  min_risk_score: number;
  max_risk_score: number;
  ai_strategy: string | null;
  ai_recommended_tone: string | null;
  ai_recommended_channel: string | null;
  ai_confidence_score: number | null;
  status: string;
  priority: number;
  min_balance: number;
  max_balance: number | null;
  total_accounts: number;
  total_balance: number;
  accounts_contacted: number;
  accounts_collected: number;
  amount_collected: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCollectionCampaigns() {
  const queryClient = useQueryClient();

  // Fetch all campaigns
  const campaignsQuery = useQuery({
    queryKey: ["collection-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CollectionCampaign[];
    },
  });

  // Generate campaign strategy
  const generateStrategy = useMutation({
    mutationFn: async (params: {
      targetRiskTier: "Low" | "Medium" | "High" | "Critical" | "All";
      minBalance?: number;
      maxBalance?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-campaign-strategy", {
        body: params,
      });

      if (error) throw error;
      return data as {
        strategy: CampaignStrategy | null;
        accounts: AccountSummary[];
        summary: CampaignSummary;
        message?: string;
      };
    },
    onError: (error) => {
      console.error("Error generating strategy:", error);
      toast.error("Failed to generate campaign strategy");
    },
  });

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async (campaign: {
      name: string;
      description?: string;
      target_risk_tier: string;
      min_risk_score?: number;
      max_risk_score?: number;
      ai_strategy?: string;
      ai_recommended_tone?: string;
      ai_recommended_channel?: string;
      ai_confidence_score?: number;
      min_balance?: number;
      max_balance?: number;
      total_accounts?: number;
      total_balance?: number;
      starts_at?: string;
      ends_at?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("collection_campaigns")
        .insert({
          ...campaign,
          user_id: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-campaigns"] });
      toast.success("Campaign created successfully");
    },
    onError: (error) => {
      console.error("Error creating campaign:", error);
      toast.error("Failed to create campaign");
    },
  });

  // Update campaign status
  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("collection_campaigns")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-campaigns"] });
      toast.success("Campaign status updated");
    },
    onError: (error) => {
      console.error("Error updating campaign:", error);
      toast.error("Failed to update campaign");
    },
  });

  // Delete campaign
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("collection_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-campaigns"] });
      toast.success("Campaign deleted");
    },
    onError: (error) => {
      console.error("Error deleting campaign:", error);
      toast.error("Failed to delete campaign");
    },
  });

  return {
    campaigns: campaignsQuery.data || [],
    isLoading: campaignsQuery.isLoading,
    generateStrategy,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
  };
}
