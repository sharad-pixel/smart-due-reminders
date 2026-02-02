import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Mail, 
  MousePointerClick, 
  Target, 
  TrendingUp,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CampaignOutreachWorkflow } from "./CampaignOutreachWorkflow";
import { CampaignLeadsTable } from "./CampaignLeadsTable";

interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  lead_score: number | null;
  segment: string | null;
  lifecycle_stage: string | null;
  last_engaged_at: string | null;
  created_at: string;
  status: string;
}

interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  target_segment: string | null;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  total_leads: number | null;
  emails_sent: number | null;
  opens: number | null;
  clicks: number | null;
  conversions: number | null;
  created_at: string;
  pricing_tier?: string | null;
}

interface CampaignDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MarketingCampaign | null;
  leads: MarketingLead[];
  activities?: any[];
  isLoadingLeads?: boolean;
  isLoadingActivities?: boolean;
  onRemoveLeads?: (leadIds: string[]) => void;
  onSendOutreach?: (leadIds: string[]) => void;
  isRemovingLeads?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
};

const campaignTypeColors: Record<string, string> = {
  nurture: "bg-blue-100 text-blue-800",
  acquisition: "bg-green-100 text-green-800",
  reactivation: "bg-orange-100 text-orange-800",
  announcement: "bg-purple-100 text-purple-800",
  promotion: "bg-pink-100 text-pink-800",
};

const tierColors: Record<string, string> = {
  solo_pro: "bg-blue-100 text-blue-800",
  starter: "bg-emerald-100 text-emerald-800",
  growth: "bg-orange-100 text-orange-800",
  professional: "bg-purple-100 text-purple-800",
};

export function CampaignDetailsModal({
  open,
  onOpenChange,
  campaign,
  leads,
  isLoadingLeads,
  onRemoveLeads,
  isRemovingLeads,
}: CampaignDetailsModalProps) {
  const queryClient = useQueryClient();

  // Fetch lead progress for this campaign
  const { data: leadProgress = [] } = useQuery({
    queryKey: ["lead-campaign-progress", campaign?.id],
    queryFn: async () => {
      if (!campaign) return [];
      const { data, error } = await supabase
        .from("lead_campaign_progress")
        .select("*")
        .eq("campaign_id", campaign.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign,
  });

  // Count unsubscribed leads
  const unsubscribedCount = useMemo(() => {
    return leads.filter(l => l.status === "unsubscribed").length;
  }, [leads]);

  // Calculate campaign metrics
  const metrics = useMemo(() => {
    if (!campaign) return { openRate: 0, clickRate: 0, conversionRate: 0 };
    
    const openRate = campaign.emails_sent && campaign.opens
      ? (campaign.opens / campaign.emails_sent) * 100
      : 0;
    const clickRate = campaign.opens && campaign.clicks
      ? (campaign.clicks / campaign.opens) * 100
      : 0;
    const conversionRate = campaign.total_leads && campaign.conversions
      ? (campaign.conversions / campaign.total_leads) * 100
      : 0;

    return { openRate, clickRate, conversionRate };
  }, [campaign]);

  // Calculate workflow progress
  const workflowStats = useMemo(() => {
    const total = leadProgress.length;
    const completed = leadProgress.filter(p => p.step_2_sent_at).length;
    const inProgress = leadProgress.filter(p => p.step_0_sent_at && !p.step_2_sent_at).length;
    const pending = total - completed - inProgress;
    
    return { total, completed, inProgress, pending };
  }, [leadProgress]);

  // Remove leads mutation
  const removeLeadsMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      // Remove from marketing_leads campaign assignment
      const { error } = await supabase
        .from("marketing_leads")
        .update({ campaign_id: null })
        .in("id", leadIds);
      if (error) throw error;

      // Also remove from lead_campaign_progress
      await supabase
        .from("lead_campaign_progress")
        .delete()
        .in("lead_id", leadIds)
        .eq("campaign_id", campaign?.id);

      // Update campaign lead count
      if (campaign) {
        const remainingCount = leads.length - leadIds.length;
        await supabase
          .from("marketing_campaigns")
          .update({ total_leads: Math.max(0, remainingCount) })
          .eq("id", campaign.id);
      }
    },
    onSuccess: () => {
      toast.success("Leads removed from campaign");
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["lead-campaign-progress"] });
      onRemoveLeads?.([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{campaign.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {campaign.description || "No description provided"}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {campaign.pricing_tier && (
                <Badge className={tierColors[campaign.pricing_tier] || "bg-slate-100"}>
                  {campaign.pricing_tier.replace("_", " ")}
                </Badge>
              )}
              <Badge className={campaignTypeColors[campaign.campaign_type] || "bg-slate-100"}>
                {campaign.campaign_type}
              </Badge>
              <Badge className={statusColors[campaign.status] || "bg-slate-100"}>
                {campaign.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Campaign Stats */}
        <div className="grid grid-cols-5 gap-3 py-4 border-b flex-shrink-0">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3 w-3" />
              Total Leads
            </div>
            <p className="text-xl font-bold">{leads.length || campaign.total_leads || 0}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Mail className="h-3 w-3" />
              Emails Sent
            </div>
            <p className="text-xl font-bold">{campaign.emails_sent || 0}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Calendar className="h-3 w-3" />
              Workflow Progress
            </div>
            <p className="text-xl font-bold">
              {workflowStats.completed}/{workflowStats.total}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MousePointerClick className="h-3 w-3" />
              Clicks
            </div>
            <p className="text-xl font-bold">{campaign.clicks || 0}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3 w-3" />
              Conversions
            </div>
            <p className="text-xl font-bold">{campaign.conversions || 0}</p>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-4 py-3 flex-shrink-0">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Open Rate</span>
              <span className="font-medium">{metrics.openRate.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.openRate} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Click Rate</span>
              <span className="font-medium">{metrics.clickRate.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.clickRate} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Conversion Rate</span>
              <span className="font-medium">{metrics.conversionRate.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.conversionRate} className="h-2" />
          </div>
        </div>

        {/* Unsubscribed Warning */}
        {unsubscribedCount > 0 && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800">
              {unsubscribedCount} lead{unsubscribedCount !== 1 ? "s have" : " has"} unsubscribed and will not receive emails
            </span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="outreach" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="outreach">
              <Mail className="h-4 w-4 mr-2" />
              Outreach Workflow
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="h-4 w-4 mr-2" />
              Assigned Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outreach" className="flex-1 overflow-auto mt-4">
            <CampaignOutreachWorkflow 
              campaignId={campaign.id}
              campaignName={campaign.name}
              pricingTier={campaign.pricing_tier}
              leadsCount={leads.filter(l => l.status !== "unsubscribed").length}
            />
          </TabsContent>

          <TabsContent value="leads" className="flex-1 overflow-hidden mt-4">
            <CampaignLeadsTable
              leads={leads}
              leadProgress={leadProgress}
              campaignId={campaign.id}
              isLoading={isLoadingLeads}
              onRemoveLeads={(ids) => removeLeadsMutation.mutate(ids)}
              isRemovingLeads={removeLeadsMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="analytics" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              {/* Workflow Funnel */}
              <Card className="p-4">
                <h3 className="font-medium mb-4">Workflow Funnel</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Leads Assigned</span>
                    <div className="flex items-center gap-2">
                      <Progress value={100} className="w-32 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{leads.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Day 0 Sent</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={leads.length > 0 ? (leadProgress.filter(p => p.step_0_sent_at).length / leads.length) * 100 : 0} 
                        className="w-32 h-2" 
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {leadProgress.filter(p => p.step_0_sent_at).length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Day 3 Sent</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={leads.length > 0 ? (leadProgress.filter(p => p.step_1_sent_at).length / leads.length) * 100 : 0} 
                        className="w-32 h-2" 
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {leadProgress.filter(p => p.step_1_sent_at).length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Day 7 Sent (Completed)</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={leads.length > 0 ? (leadProgress.filter(p => p.step_2_sent_at).length / leads.length) * 100 : 0} 
                        className="w-32 h-2" 
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {leadProgress.filter(p => p.step_2_sent_at).length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600 font-medium">Conversions</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={leads.length > 0 ? ((campaign.conversions || 0) / leads.length) * 100 : 0} 
                        className="w-32 h-2 [&>div]:bg-green-500" 
                      />
                      <span className="text-sm font-medium w-12 text-right text-green-600">
                        {campaign.conversions || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{workflowStats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{workflowStats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{workflowStats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
