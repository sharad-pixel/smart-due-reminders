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
  // Enhanced strategy fields
  channelSequence?: string[];
  paymentPrediction?: {
    expectedAmount: number;
    expectedDays: number;
    probability: number;
  };
  prioritizedAccounts?: {
    accountId: string;
    priorityScore: number;
    recommendedAction: string;
  }[];
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
  // Enhanced fields
  email?: string;
  phone?: string;
  lastContactDate?: string;
  lastPaymentDate?: string;
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

export interface CampaignAccount {
  id: string;
  campaign_id: string;
  debtor_id: string;
  status: string;
  balance_at_assignment: number;
  risk_score_at_assignment: number;
  amount_collected: number;
  last_action_at: string | null;
  notes: string | null;
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

  // Fetch campaign accounts for a specific campaign
  const useCampaignAccounts = (campaignId: string | null) => {
    return useQuery({
      queryKey: ["campaign-accounts", campaignId],
      queryFn: async () => {
        if (!campaignId) return [];
        
        const { data, error } = await supabase
          .from("campaign_accounts")
          .select(`
            *,
            debtors (
              id,
              name,
              email,
              phone,
              payment_score,
              payment_risk_tier,
              total_open_balance,
              avg_days_to_pay,
              open_invoices_count,
              max_days_past_due
            )
          `)
          .eq("campaign_id", campaignId)
          .order("risk_score_at_assignment", { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled: !!campaignId,
    });
  };

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

  // Create campaign with account assignments
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
      accountIds?: string[]; // Accounts to assign to campaign
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { accountIds, ...campaignData } = campaign;

      // Create campaign
      const { data: newCampaign, error: campaignError } = await supabase
        .from("collection_campaigns")
        .insert({
          ...campaignData,
          user_id: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Assign accounts if provided
      if (accountIds && accountIds.length > 0) {
        // Fetch account details for assignment
        const { data: debtors, error: debtorError } = await supabase
          .from("debtors")
          .select("id, payment_score, total_open_balance")
          .in("id", accountIds);

        if (debtorError) throw debtorError;

        const accountAssignments = debtors?.map(debtor => ({
          campaign_id: newCampaign.id,
          debtor_id: debtor.id,
          user_id: user.id,
          balance_at_assignment: debtor.total_open_balance || 0,
          risk_score_at_assignment: debtor.payment_score || 50,
          status: "pending",
        })) || [];

        if (accountAssignments.length > 0) {
          const { error: assignError } = await supabase
            .from("campaign_accounts")
            .insert(accountAssignments);

          if (assignError) throw assignError;
        }
      }

      return newCampaign;
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
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          starts_at: status === "active" ? new Date().toISOString() : undefined,
        })
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

  // Generate drafts for campaign accounts
  const generateCampaignDrafts = useMutation({
    mutationFn: async ({ campaignId }: { campaignId: string }) => {
      // Fetch campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from("collection_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Fetch campaign accounts
      const { data: accounts, error: accountsError } = await supabase
        .from("campaign_accounts")
        .select(`
          *,
          debtors (
            id,
            name,
            email,
            user_id
          )
        `)
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      if (accountsError) throw accountsError;

      const strategy = campaign.ai_strategy ? JSON.parse(campaign.ai_strategy) : null;
      
      // Generate drafts using the AI for each account
      let draftsCreated = 0;
      let errors: string[] = [];

      for (const account of accounts || []) {
        try {
          const { error: draftError } = await supabase.functions.invoke("generate-outreach-draft", {
            body: {
              debtorId: account.debtor_id,
              channel: campaign.ai_recommended_channel || "email",
              tone: campaign.ai_recommended_tone || "firm",
              context: `Campaign: ${campaign.name}. ${strategy?.executiveSummary || ""}`,
              campaignId: campaignId,
            },
          });

          if (draftError) {
            errors.push(`Failed for ${account.debtors?.name}: ${draftError.message}`);
          } else {
            draftsCreated++;
            
            // Update account status
            await supabase
              .from("campaign_accounts")
              .update({ 
                status: "draft_generated",
                last_action_at: new Date().toISOString()
              })
              .eq("id", account.id);
          }
        } catch (err: any) {
          errors.push(`Failed for ${account.debtors?.name}: ${err.message}`);
        }
      }

      // Update campaign contacted count
      await supabase
        .from("collection_campaigns")
        .update({ 
          accounts_contacted: campaign.accounts_contacted + draftsCreated,
          updated_at: new Date().toISOString()
        })
        .eq("id", campaignId);

      return { draftsCreated, errors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collection-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-accounts"] });
      
      if (data.draftsCreated > 0) {
        toast.success(`Generated ${data.draftsCreated} draft${data.draftsCreated !== 1 ? 's' : ''}`);
      }
      if (data.errors.length > 0) {
        toast.warning(`${data.errors.length} error${data.errors.length !== 1 ? 's' : ''} occurred`);
      }
    },
    onError: (error) => {
      console.error("Error generating drafts:", error);
      toast.error("Failed to generate campaign drafts");
    },
  });

  // Log outreach activity (tracked in Inbound-AI)
  const logOutreachActivity = useMutation({
    mutationFn: async ({
      campaignId,
      accountId,
      debtorId,
      channel,
      subject,
      messageBody,
    }: {
      campaignId: string;
      accountId: string;
      debtorId: string;
      channel: string;
      subject?: string;
      messageBody: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Log to collection_activities for tracking in Inbound-AI
      const { data, error } = await supabase
        .from("collection_activities")
        .insert({
          user_id: user.id,
          debtor_id: debtorId,
          activity_type: "campaign_outreach",
          channel,
          direction: "outbound",
          subject,
          message_body: messageBody,
          sent_at: new Date().toISOString(),
          metadata: {
            campaign_id: campaignId,
            campaign_account_id: accountId,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // Update campaign account
      await supabase
        .from("campaign_accounts")
        .update({
          status: "contacted",
          last_action_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["collection-activities"] });
      toast.success("Outreach logged successfully");
    },
    onError: (error) => {
      console.error("Error logging outreach:", error);
      toast.error("Failed to log outreach");
    },
  });

  // Delete campaign
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      // Delete campaign accounts first
      const { error: accountsError } = await supabase
        .from("campaign_accounts")
        .delete()
        .eq("campaign_id", id);

      if (accountsError) throw accountsError;

      // Delete campaign
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

  // Record collection
  const recordCollection = useMutation({
    mutationFn: async ({
      campaignId,
      accountId,
      amount,
    }: {
      campaignId: string;
      accountId: string;
      amount: number;
    }) => {
      // Update campaign account
      const { data: account, error: accountError } = await supabase
        .from("campaign_accounts")
        .select("amount_collected")
        .eq("id", accountId)
        .single();

      if (accountError) throw accountError;

      await supabase
        .from("campaign_accounts")
        .update({
          amount_collected: (account?.amount_collected || 0) + amount,
          status: "collected",
          last_action_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      // Update campaign totals
      const { data: campaign, error: campaignError } = await supabase
        .from("collection_campaigns")
        .select("amount_collected, accounts_collected")
        .eq("id", campaignId)
        .single();

      if (campaignError) throw campaignError;

      await supabase
        .from("collection_campaigns")
        .update({
          amount_collected: (campaign?.amount_collected || 0) + amount,
          accounts_collected: (campaign?.accounts_collected || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-accounts"] });
      toast.success("Collection recorded");
    },
    onError: (error) => {
      console.error("Error recording collection:", error);
      toast.error("Failed to record collection");
    },
  });

  return {
    campaigns: campaignsQuery.data || [],
    isLoading: campaignsQuery.isLoading,
    refetch: campaignsQuery.refetch,
    useCampaignAccounts,
    generateStrategy,
    createCampaign,
    updateCampaignStatus,
    deleteCampaign,
    generateCampaignDrafts,
    logOutreachActivity,
    recordCollection,
  };
}
