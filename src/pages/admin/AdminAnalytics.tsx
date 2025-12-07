import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", "#FFBB28"];

const AdminAnalytics = () => {
  const [signupTrend, setSignupTrend] = useState<any[]>([]);
  const [invoicesByStatus, setInvoicesByStatus] = useState<any[]>([]);
  const [usersByPlan, setUsersByPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Get signup trend for last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Group by date
      const signupsByDate: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(new Date(), 29 - i), "MMM d");
        signupsByDate[date] = 0;
      }
      
      profiles?.forEach((p) => {
        const date = format(new Date(p.created_at), "MMM d");
        if (signupsByDate[date] !== undefined) {
          signupsByDate[date]++;
        }
      });

      setSignupTrend(
        Object.entries(signupsByDate).map(([date, count]) => ({ date, signups: count }))
      );

      // Invoice status distribution
      const { data: invoices } = await supabase
        .from("invoices")
        .select("status");

      const statusCounts: Record<string, number> = {};
      invoices?.forEach((inv) => {
        statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1;
      });

      setInvoicesByStatus(
        Object.entries(statusCounts).map(([status, count]) => ({ name: status, value: count }))
      );

      // Users by plan
      const { data: planData } = await supabase
        .from("profiles")
        .select("plan_type");

      const planCounts: Record<string, number> = {};
      planData?.forEach((p) => {
        const plan = p.plan_type || "Free";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });

      setUsersByPlan(
        Object.entries(planCounts).map(([plan, count]) => ({ name: plan, value: count }))
      );

    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Platform Analytics" description="Usage metrics and trends">
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading analytics...</p>
      ) : (
        <div className="space-y-6">
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
                        {invoicesByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
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
