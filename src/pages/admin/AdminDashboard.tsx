import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  FileText,
  Building2,
  Mail,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalInvoices: number;
  totalDebtors: number;
  waitlistCount: number;
  recentSignups: number;
  suspendedUsers: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch counts in parallel
      const [
        { count: totalUsers },
        { count: totalInvoices },
        { count: totalDebtors },
        { count: waitlistCount },
        { count: suspendedUsers },
        { data: recentUsersData },
        { data: activityData },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase.from("debtors").select("*", { count: "exact", head: true }),
        supabase.from("waitlist_signups").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_suspended", true),
        supabase.from("profiles").select("id, email, name, company_name, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("admin_user_actions").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      // Count users signed up in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: recentSignups } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString());

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: (totalUsers || 0) - (suspendedUsers || 0),
        totalInvoices: totalInvoices || 0,
        totalDebtors: totalDebtors || 0,
        waitlistCount: waitlistCount || 0,
        recentSignups: recentSignups || 0,
        suspendedUsers: suspendedUsers || 0,
      });

      setRecentUsers(recentUsersData || []);
      setRecentActivity(activityData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-500" },
    { label: "Active Users", value: stats?.activeUsers || 0, icon: CheckCircle, color: "text-green-500" },
    { label: "Total Invoices", value: stats?.totalInvoices || 0, icon: FileText, color: "text-purple-500" },
    { label: "Total Accounts", value: stats?.totalDebtors || 0, icon: Building2, color: "text-orange-500" },
    { label: "Waitlist", value: stats?.waitlistCount || 0, icon: Mail, color: "text-cyan-500" },
    { label: "7-Day Signups", value: stats?.recentSignups || 0, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Suspended", value: stats?.suspendedUsers || 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <AdminLayout title="Admin Dashboard" description="Platform overview and key metrics">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{loading ? "..." : stat.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : recentUsers.length === 0 ? (
              <p className="text-muted-foreground">No users yet</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{user.name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      {user.company_name && (
                        <p className="text-xs text-muted-foreground">{user.company_name}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(user.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Admin Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Admin Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-muted-foreground">No admin actions yet</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((action) => (
                  <div key={action.id} className="py-2 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{action.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(action.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {action.action_type && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded">{action.action_type}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
