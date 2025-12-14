import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { format, subDays } from "date-fns";
import { Mail, FileText, AlertTriangle, Activity, TrendingUp, Send } from "lucide-react";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", "#FFBB28"];

interface ActivityMetrics {
  totalDrafts: number;
  sentDrafts: number;
  pendingDrafts: number;
  totalOutreach: number;
  totalActivities: number;
  riskScoreSnapshots: number;
}

const AdminAnalytics = () => {
  const [signupTrend, setSignupTrend] = useState<any[]>([]);
  const [invoicesByStatus, setInvoicesByStatus] = useState<any[]>([]);
  const [usersByPlan, setUsersByPlan] = useState<any[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);
  const [draftsByStatus, setDraftsByStatus] = useState<any[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics>({
    totalDrafts: 0,
    sentDrafts: 0,
    pendingDrafts: 0,
    totalOutreach: 0,
    totalActivities: 0,
    riskScoreSnapshots: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = subDays(new Date(), 30);

      // Fetch all data in parallel
      const [
        { data: profiles },
        { data: invoices },
        { data: planData },
        { data: aiDrafts },
        { data: outreachLogs },
        { data: collectionActivities },
        { data: riskHistory },
        { count: totalDraftsCount },
        { count: sentDraftsCount },
        { count: pendingDraftsCount },
        { count: totalOutreachCount },
        { count: totalActivitiesCount },
        { count: riskSnapshotsCount },
      ] = await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("invoices").select("status"),
        supabase.from("profiles").select("plan_type"),
        supabase.from("ai_drafts").select("created_at, status").gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("outreach_logs").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("collection_activities").select("created_at, activity_type").gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("debtor_risk_history").select("created_at, risk_tier").gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("ai_drafts").select("*", { count: "exact", head: true }),
        supabase.from("ai_drafts").select("*", { count: "exact", head: true }).not("sent_at", "is", null),
        supabase.from("ai_drafts").select("*", { count: "exact", head: true }).in("status", ["pending_approval", "approved"]),
        supabase.from("outreach_logs").select("*", { count: "exact", head: true }),
        supabase.from("collection_activities").select("*", { count: "exact", head: true }),
        supabase.from("debtor_risk_history").select("*", { count: "exact", head: true }),
      ]);

      // Set activity metrics
      setActivityMetrics({
        totalDrafts: totalDraftsCount || 0,
        sentDrafts: sentDraftsCount || 0,
        pendingDrafts: pendingDraftsCount || 0,
        totalOutreach: totalOutreachCount || 0,
        totalActivities: totalActivitiesCount || 0,
        riskScoreSnapshots: riskSnapshotsCount || 0,
      });

      // Process signup trend
      const signupsByDate: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(new Date(), 29 - i), "MMM d");
        signupsByDate[date] = 0;
      }
      profiles?.forEach((p) => {
        const date = format(new Date(p.created_at), "MMM d");
        if (signupsByDate[date] !== undefined) signupsByDate[date]++;
      });
      setSignupTrend(Object.entries(signupsByDate).map(([date, count]) => ({ date, signups: count })));

      // Process activity trend (drafts + outreach + activities combined)
      const activityByDate: Record<string, { drafts: number; outreach: number; activities: number }> = {};
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(new Date(), 29 - i), "MMM d");
        activityByDate[date] = { drafts: 0, outreach: 0, activities: 0 };
      }
      aiDrafts?.forEach((d) => {
        const date = format(new Date(d.created_at), "MMM d");
        if (activityByDate[date]) activityByDate[date].drafts++;
      });
      outreachLogs?.forEach((o) => {
        const date = format(new Date(o.created_at), "MMM d");
        if (activityByDate[date]) activityByDate[date].outreach++;
      });
      collectionActivities?.forEach((a) => {
        const date = format(new Date(a.created_at), "MMM d");
        if (activityByDate[date]) activityByDate[date].activities++;
      });
      setActivityTrend(Object.entries(activityByDate).map(([date, counts]) => ({ date, ...counts })));

      // Invoice status distribution
      const statusCounts: Record<string, number> = {};
      invoices?.forEach((inv) => {
        statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
      });
      setInvoicesByStatus(Object.entries(statusCounts).map(([status, count]) => ({ name: status, value: count })));

      // Users by plan
      const planCounts: Record<string, number> = {};
      planData?.forEach((p) => {
        const plan = p.plan_type || "Free";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });
      setUsersByPlan(Object.entries(planCounts).map(([plan, count]) => ({ name: plan, value: count })));

      // Draft status distribution
      const draftStatusCounts: Record<string, number> = {};
      aiDrafts?.forEach((d) => {
        const status = d.status || "unknown";
        draftStatusCounts[status] = (draftStatusCounts[status] || 0) + 1;
      });
      setDraftsByStatus(Object.entries(draftStatusCounts).map(([status, count]) => ({ name: status, value: count })));

      // Risk tier distribution
      const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      riskHistory?.forEach((r) => {
        const tier = r.risk_tier?.toLowerCase() || "unknown";
        if (riskCounts[tier] !== undefined) riskCounts[tier]++;
      });
      setRiskDistribution(Object.entries(riskCounts).map(([tier, count]) => ({ name: tier, value: count })));

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    { label: "Total AI Drafts", value: activityMetrics.totalDrafts, icon: FileText, color: "text-blue-500" },
    { label: "Sent Drafts", value: activityMetrics.sentDrafts, icon: Send, color: "text-green-500" },
    { label: "Pending Drafts", value: activityMetrics.pendingDrafts, icon: Mail, color: "text-yellow-500" },
    { label: "Outreach Logs", value: activityMetrics.totalOutreach, icon: TrendingUp, color: "text-purple-500" },
    { label: "Collection Activities", value: activityMetrics.totalActivities, icon: Activity, color: "text-cyan-500" },
    { label: "Risk Snapshots", value: activityMetrics.riskScoreSnapshots, icon: AlertTriangle, color: "text-orange-500" },
  ];

  return (
    <AdminLayout title="Platform Analytics" description="Usage metrics, activity trends, and risk insights">
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading analytics...</p>
      ) : (
        <div className="space-y-6">
          {/* Activity Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${metric.color}`} />
                      <span className="text-xs text-muted-foreground">{metric.label}</span>
                    </div>
                    <p className="text-2xl font-bold">{metric.value.toLocaleString()}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Activity Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Trend (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="drafts" stackId="1" stroke="#8884d8" fill="#8884d8" name="AI Drafts" />
                    <Area type="monotone" dataKey="outreach" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Outreach" />
                    <Area type="monotone" dataKey="activities" stackId="1" stroke="#ffc658" fill="#ffc658" name="Activities" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Signup Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Signups (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signupTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="signups" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={invoicesByStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {invoicesByStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Draft Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>AI Draft Status (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={draftsByStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#82ca9d"
                        dataKey="value"
                      >
                        {draftsByStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Risk Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Tier Distribution (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ff7300" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Users by Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Users by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usersByPlan}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAnalytics;
