import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Layout from "@/components/Layout";
import { UsageIndicator } from "@/components/UsageIndicator";
import { User } from "@supabase/supabase-js";
import { DollarSign, FileText, TrendingUp, Clock, AlertCircle, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  debtors?: { name: string };
}

interface AIDraft {
  id: string;
  invoice_id: string;
  step_number: number;
  channel: string;
  subject: string | null;
  status: string;
  invoices?: {
    invoice_number: string;
    debtors?: { name: string };
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<AIDraft[]>([]);
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    totalRecovered: 0,
    openInvoicesCount: 0,
    avgDaysPastDue: 0,
  });
  const [agingData, setAgingData] = useState([
    { bucket: "0-30", count: 0, amount: 0 },
    { bucket: "31-60", count: 0, amount: 0 },
    { bucket: "61-90", count: 0, amount: 0 },
    { bucket: "91-120", count: 0, amount: 0 },
    { bucket: "121+", count: 0, amount: 0 },
  ]);
  const [priorityOverdues, setPriorityOverdues] = useState<Invoice[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>(["Open", "InPaymentPlan"]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchDashboardData();
      }
      setLoading(false);
    });
  }, []);

  const getDaysPastDue = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const fetchDashboardData = async () => {
    try {
      const [invoicesRes, draftsRes] = await Promise.all([
        supabase.from("invoices").select("*, debtors(name)"),
        supabase
          .from("ai_drafts")
          .select("*, invoices(invoice_number, debtors(name))")
          .eq("status", "pending_approval")
          .limit(10),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      const allInvoices = invoicesRes.data || [];
      setInvoices(allInvoices);

      if (!draftsRes.error) {
        setPendingDrafts(draftsRes.data || []);
      }

      // Calculate Total Outstanding
      const outstanding = allInvoices
        .filter((inv) => inv.status === "Open" || inv.status === "InPaymentPlan")
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Calculate Total Recovered (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const recovered = allInvoices
        .filter((inv) => {
          if (inv.status !== "Paid" || !inv.payment_date) return false;
          const paymentDate = new Date(inv.payment_date);
          return paymentDate >= ninetyDaysAgo;
        })
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Calculate Open Invoices Count
      const openInvoices = allInvoices.filter((inv) => inv.status === "Open");
      const openCount = openInvoices.length;

      // Calculate Average Days Past Due for Open invoices
      const totalDaysPastDue = openInvoices.reduce((sum, inv) => {
        return sum + getDaysPastDue(inv.due_date);
      }, 0);
      const avgDays = openCount > 0 ? Math.round(totalDaysPastDue / openCount) : 0;

      setStats({
        totalOutstanding: outstanding,
        totalRecovered: recovered,
        openInvoicesCount: openCount,
        avgDaysPastDue: avgDays,
      });

      // Calculate Aging Buckets with status filters
      const buckets = {
        "0-30": { count: 0, amount: 0 },
        "31-60": { count: 0, amount: 0 },
        "61-90": { count: 0, amount: 0 },
        "91-120": { count: 0, amount: 0 },
        "121+": { count: 0, amount: 0 },
      };

      const filteredInvoices = allInvoices.filter(inv => statusFilters.includes(inv.status));
      
      filteredInvoices.forEach((inv) => {
        const days = getDaysPastDue(inv.due_date);
        const amount = Number(inv.amount);

        if (days <= 30) {
          buckets["0-30"].count++;
          buckets["0-30"].amount += amount;
        } else if (days <= 60) {
          buckets["31-60"].count++;
          buckets["31-60"].amount += amount;
        } else if (days <= 90) {
          buckets["61-90"].count++;
          buckets["61-90"].amount += amount;
        } else if (days <= 120) {
          buckets["91-120"].count++;
          buckets["91-120"].amount += amount;
        } else {
          buckets["121+"].count++;
          buckets["121+"].amount += amount;
        }
      });

      setAgingData([
        { bucket: "0-30", count: buckets["0-30"].count, amount: buckets["0-30"].amount },
        { bucket: "31-60", count: buckets["31-60"].count, amount: buckets["31-60"].amount },
        { bucket: "61-90", count: buckets["61-90"].count, amount: buckets["61-90"].amount },
        { bucket: "91-120", count: buckets["91-120"].count, amount: buckets["91-120"].amount },
        { bucket: "121+", count: buckets["121+"].count, amount: buckets["121+"].amount },
      ]);

      // Get Priority Overdues (top 10 by days past due)
      const overdues = openInvoices
        .map((inv) => ({
          ...inv,
          daysPastDue: getDaysPastDue(inv.due_date),
        }))
        .sort((a, b) => b.daysPastDue - a.daysPastDue)
        .slice(0, 10);

      setPriorityOverdues(overdues);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [statusFilters]);

  if (loading || !user) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Welcome back! Here's your collection overview.
          </p>
        </div>

        {/* Usage Indicator */}
        <UsageIndicator />

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold">AI Collection Workflows</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Set up automated collection sequences for your invoices
                </p>
              </div>
              <Button 
                onClick={() => navigate("/settings/ai-workflows")}
                className="w-full sm:w-auto shrink-0"
              >
                Configure Workflows
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Outstanding</CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">${stats.totalOutstanding.toLocaleString()}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Open + In Payment Plan</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Recovered (90 Days)</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">${stats.totalRecovered.toLocaleString()}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Payments received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Open Invoices</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats.openInvoicesCount}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Avg Days Past Due</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats.avgDaysPastDue}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">For open invoices</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">Invoice Aging Analysis</CardTitle>
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                {["Open", "InPaymentPlan", "Paid", "Disputed", "Settled", "Canceled"].map((status) => (
                  <Badge
                    key={status}
                    variant={statusFilters.includes(status) ? "default" : "outline"}
                    className="cursor-pointer text-xs tap-target"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <ResponsiveContainer width="100%" height={250} className="sm:hidden">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  labelFormatter={(label) => `${label} days`}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300} className="hidden sm:block">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  labelFormatter={(label) => `${label} days`}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 text-center">
              {agingData.map((bucket) => (
                <div key={bucket.bucket}>
                  <p className="text-xs sm:text-sm font-medium">{bucket.bucket} days</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{bucket.count} inv</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                  Priority Overdues
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate("/invoices")}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {priorityOverdues.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No overdue invoices</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Debtor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priorityOverdues.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.debtors?.name}</TableCell>
                        <TableCell className="text-right">
                          ${invoice.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-red-600 font-semibold">
                            {invoice.daysPastDue}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Drafts Awaiting Approval</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDrafts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No drafts pending approval</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => navigate(`/invoices/${draft.invoice_id}`)}
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {draft.invoices?.invoice_number} - {draft.invoices?.debtors?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Step {draft.step_number} • {draft.channel.toUpperCase()}
                          {draft.subject && ` • ${draft.subject}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </Layout>
  );
};

export default Dashboard;
