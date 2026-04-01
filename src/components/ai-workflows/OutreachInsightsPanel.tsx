import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Mail, Clock, AlertCircle, ArrowUpRight, Sparkles, Users, Zap } from "lucide-react";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { personaConfig } from "@/lib/personaConfig";
import { cn } from "@/lib/utils";

export function OutreachInsightsPanel() {
  const { effectiveAccountId } = useEffectiveAccount();

  const { data: insights, isLoading } = useQuery({
    queryKey: ["outreach-insights", effectiveAccountId],
    staleTime: 60_000,
    enabled: !!effectiveAccountId,
    queryFn: async () => {
      if (!effectiveAccountId) return null;

      // Fetch sent drafts for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        { data: sentDrafts },
        { data: allDrafts },
        { data: activities },
        { data: openInvoices },
        { data: recentPayments },
      ] = await Promise.all([
        supabase
          .from("ai_drafts")
          .select("id, sent_at, days_past_due, step_number, status, invoice_id")
          .eq("user_id", effectiveAccountId)
          .not("sent_at", "is", null)
          .gte("sent_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("ai_drafts")
          .select("id, status, created_at, days_past_due")
          .eq("user_id", effectiveAccountId)
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("collection_activities")
          .select("id, channel, direction, responded_at, delivered_at, opened_at, debtor_id")
          .eq("user_id", effectiveAccountId)
          .eq("direction", "outbound")
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("invoices")
          .select("id, due_date, amount_outstanding, aging_bucket, status")
          .eq("user_id", effectiveAccountId)
          .in("status", ["Open", "InPaymentPlan", "PartiallyPaid"]),
        supabase
          .from("invoices")
          .select("id, payment_date, amount")
          .eq("user_id", effectiveAccountId)
          .eq("status", "Paid")
          .gte("payment_date", thirtyDaysAgo.toISOString().split("T")[0]),
      ]);

      const totalSent = sentDrafts?.length || 0;
      const totalGenerated = allDrafts?.length || 0;
      const responded = activities?.filter(a => a.responded_at)?.length || 0;
      const opened = activities?.filter(a => a.opened_at)?.length || 0;
      const delivered = activities?.filter(a => a.delivered_at)?.length || 0;
      const uniqueDebtorsContacted = new Set(activities?.map(a => a.debtor_id)).size;

      // Calculate response rate
      const responseRate = totalSent > 0 ? Math.round((responded / totalSent) * 100) : 0;
      const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;

      // Bucket distribution for open invoices
      const bucketDistribution: Record<string, { count: number; amount: number }> = {};
      openInvoices?.forEach(inv => {
        const bucket = inv.aging_bucket || "current";
        if (!bucketDistribution[bucket]) bucketDistribution[bucket] = { count: 0, amount: 0 };
        bucketDistribution[bucket].count += 1;
        bucketDistribution[bucket].amount += Number(inv.amount_outstanding) || 0;
      });

      // Payments collected
      const totalCollected = recentPayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
      const paymentsCount = recentPayments?.length || 0;

      // Agent performance by step
      const stepPerformance: Record<number, number> = {};
      sentDrafts?.forEach(d => {
        const step = d.step_number || 1;
        stepPerformance[step] = (stepPerformance[step] || 0) + 1;
      });

      // Approval rate
      const approved = allDrafts?.filter(d => d.status === "approved" || d.status === "sent")?.length || 0;
      const approvalRate = totalGenerated > 0 ? Math.round((approved / totalGenerated) * 100) : 0;

      return {
        totalSent,
        totalGenerated,
        responseRate,
        openRate,
        uniqueDebtorsContacted,
        bucketDistribution,
        totalCollected,
        paymentsCount,
        stepPerformance,
        approvalRate,
        totalOpenInvoices: openInvoices?.length || 0,
        totalOutstandingAmount: openInvoices?.reduce((sum, i) => sum + (Number(i.amount_outstanding) || 0), 0) || 0,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">Loading AI outreach insights...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  // Generate smart recommendations
  const recommendations: { icon: React.ReactNode; text: string; priority: "high" | "medium" | "low" }[] = [];

  if (insights.responseRate < 10 && insights.totalSent > 5) {
    recommendations.push({
      icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
      text: "Low response rate. Consider adjusting tone or adding payment links to your templates.",
      priority: "high",
    });
  }

  const highAgingBuckets = ["dpd_91_120", "dpd_121_150", "dpd_150_plus"];
  const highRiskCount = highAgingBuckets.reduce(
    (sum, b) => sum + (insights.bucketDistribution[b]?.count || 0), 0
  );
  if (highRiskCount > 0) {
    recommendations.push({
      icon: <TrendingDown className="h-4 w-4 text-destructive" />,
      text: `${highRiskCount} invoice${highRiskCount > 1 ? "s" : ""} are 90+ days overdue. Escalation workflows should be active.`,
      priority: "high",
    });
  }

  if (insights.approvalRate < 50 && insights.totalGenerated > 3) {
    recommendations.push({
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      text: "Many drafts await approval. Enable auto-approve in Branding settings to streamline.",
      priority: "medium",
    });
  }

  if (insights.totalSent > 10 && insights.paymentsCount > 0) {
    recommendations.push({
      icon: <TrendingUp className="h-4 w-4 text-green-500" />,
      text: `${insights.paymentsCount} payment${insights.paymentsCount > 1 ? "s" : ""} received after outreach — AI-driven follow-ups are working.`,
      priority: "low",
    });
  }

  if (insights.totalSent === 0) {
    recommendations.push({
      icon: <Zap className="h-4 w-4 text-primary" />,
      text: "No emails sent yet. Generate AI templates and run the outreach engine to begin collections.",
      priority: "high",
    });
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Outreach Intelligence
            </CardTitle>
            <CardDescription>30-day performance snapshot and smart recommendations</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Last 30 days</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            icon={<Mail className="h-4 w-4" />}
            label="Emails Sent"
            value={insights.totalSent}
            accent="text-blue-600"
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Accounts Reached"
            value={insights.uniqueDebtorsContacted}
            accent="text-purple-600"
          />
          <MetricCard
            icon={<ArrowUpRight className="h-4 w-4" />}
            label="Response Rate"
            value={`${insights.responseRate}%`}
            accent={insights.responseRate >= 15 ? "text-green-600" : "text-amber-600"}
          />
          <MetricCard
            icon={<Target className="h-4 w-4" />}
            label="Collected"
            value={`$${insights.totalCollected.toLocaleString()}`}
            accent="text-green-600"
          />
        </div>

        {/* Pipeline Funnel */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Outreach Pipeline</p>
          <div className="space-y-2">
            <PipelineRow label="Generated" count={insights.totalGenerated} total={insights.totalGenerated} color="bg-muted-foreground" />
            <PipelineRow label="Approved" count={Math.round(insights.totalGenerated * insights.approvalRate / 100)} total={insights.totalGenerated} color="bg-blue-500" />
            <PipelineRow label="Sent" count={insights.totalSent} total={insights.totalGenerated} color="bg-green-500" />
            <PipelineRow label="Responded" count={Math.round(insights.totalSent * insights.responseRate / 100)} total={insights.totalGenerated} color="bg-primary" />
          </div>
        </div>

        {/* Agent Distribution */}
        {Object.keys(insights.bucketDistribution).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Active Invoices by Agent</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(insights.bucketDistribution)
                .filter(([bucket]) => bucket !== "current" && bucket !== "paid")
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([bucket, data]) => {
                  const persona = getPersonaForBucket(bucket);
                  return (
                    <div key={bucket} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: persona?.color || "#888" }}
                      />
                      <div className="text-xs">
                        <span className="font-medium">{persona?.name || bucket}</span>
                        <span className="text-muted-foreground ml-1">
                          {data.count} inv · ${Math.round(data.amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Smart Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">AI Recommendations</p>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 p-3 rounded-lg border text-sm",
                    rec.priority === "high"
                      ? "bg-amber-500/5 border-amber-500/20"
                      : rec.priority === "medium"
                        ? "bg-blue-500/5 border-blue-500/20"
                        : "bg-green-500/5 border-green-500/20"
                  )}
                >
                  <span className="mt-0.5 shrink-0">{rec.icon}</span>
                  <span>{rec.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", accent)}>{value}</p>
    </div>
  );
}

function PipelineRow({
  label, count, total, color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.max(pct, total > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{count}</span>
    </div>
  );
}

function getPersonaForBucket(bucket: string) {
  const map: Record<string, string> = {
    dpd_1_30: "sam",
    dpd_31_60: "james",
    dpd_61_90: "katy",
    dpd_91_120: "troy",
    dpd_121_150: "jimmy",
    dpd_150_plus: "rocco",
  };
  return personaConfig[map[bucket] || ""] || null;
}
