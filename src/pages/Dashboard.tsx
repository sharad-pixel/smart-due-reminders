import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Layout from "@/components/Layout";
import { UsageIndicator } from "@/components/UsageIndicator";
import { User } from "@supabase/supabase-js";
import { DollarSign, FileText, TrendingUp, Clock, AlertCircle, Eye, RefreshCw, TrendingDown, Play, HeartPulse, Zap } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useDebtorDashboard, usePaymentScore } from "@/hooks/usePaymentScore";
import { AgingBucketBreakdown } from "@/components/AgingBucketBreakdown";
import { InvoiceCollectabilityReport } from "@/components/InvoiceCollectabilityReport";
import { PaymentActivityCard } from "@/components/PaymentActivityCard";
import { SortableTableHead, SortDirection } from "@/components/ui/sortable-table-head";
import { useSavedViews, ViewConfig } from "@/hooks/useSavedViews";
import { SavedViewsManager } from "@/components/SavedViewsManager";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { useLatestDigest } from "@/hooks/useDailyDigest";
import { AIInsightsCard } from "@/components/AIInsightsCard";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  debtors?: { name: string };
}

interface DashboardTask {
  id: string;
  summary: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  debtor_id: string;
  invoice_id?: string | null;
  details?: string | null;
  ai_reasoning?: string | null;
  recommended_action?: string | null;
  assigned_to?: string | null;
  assigned_persona?: string | null;
  completed_at?: string | null;
  debtors?: { name: string; company_name: string };
  invoices?: { invoice_number: string };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingTasks, setPendingTasks] = useState<DashboardTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [runningOutreach, setRunningOutreach] = useState(false);
  const [syncingDigest, setSyncingDigest] = useState(false);
  const { refetch: refetchDigest } = useLatestDigest();
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
  const [tasksAssignedToMeOnly, setTasksAssignedToMeOnly] = useState(false);
  
  // Debtor Dashboard state
  const { data: debtorData, isLoading: debtorLoading } = useDebtorDashboard();
  const { calculateScore } = usePaymentScore();
  
  // Sorting state for Priority Overdues
  const [overdueSortKey, setOverdueSortKey] = useState<string | null>("daysPastDue");
  const [overdueSortDir, setOverdueSortDir] = useState<SortDirection>("desc");

  // Saved views
  const {
    savedViews,
    activeView,
    saveView,
    updateView,
    deleteView,
    setDefaultView,
    loadView,
    clearActiveView
  } = useSavedViews('/dashboard');

  // Build current view config
  const currentConfig: ViewConfig = useMemo(() => ({
    filters: { statusFilters },
    sorting: overdueSortKey ? { column: overdueSortKey, direction: overdueSortDir || 'asc' } : undefined
  }), [statusFilters, overdueSortKey, overdueSortDir]);

  // Apply loaded view config
  useEffect(() => {
    if (activeView?.view_config) {
      const config = activeView.view_config;
      if (config.filters) {
        if (config.filters.statusFilters !== undefined) setStatusFilters(config.filters.statusFilters);
      }
      if (config.sorting) {
        setOverdueSortKey(config.sorting.column);
        setOverdueSortDir(config.sorting.direction as SortDirection);
      }
    }
  }, [activeView]);
  
  const handleOverdueSort = (key: string) => {
    if (overdueSortKey === key) {
      if (overdueSortDir === "asc") setOverdueSortDir("desc");
      else if (overdueSortDir === "desc") { setOverdueSortDir(null); setOverdueSortKey(null); }
      else setOverdueSortDir("asc");
    } else {
      setOverdueSortKey(key);
      setOverdueSortDir("asc");
    }
  };
  
  const sortedOverdues = useMemo(() => {
    if (!overdueSortKey || !overdueSortDir) return priorityOverdues;
    return [...priorityOverdues].sort((a: any, b: any) => {
      let aVal = overdueSortKey === "debtors.name" ? a.debtors?.name : a[overdueSortKey];
      let bVal = overdueSortKey === "debtors.name" ? b.debtors?.name : b[overdueSortKey];
      if (aVal == null) return overdueSortDir === "asc" ? 1 : -1;
      if (bVal == null) return overdueSortDir === "asc" ? -1 : 1;
      if (typeof aVal === "string") return overdueSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return overdueSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [priorityOverdues, overdueSortKey, overdueSortDir]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchDashboardData();
        } else if (event === 'SIGNED_OUT' || !session) {
          navigate("/login");
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchDashboardData();
      } else {
        navigate("/login");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const getDaysPastDue = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const fetchDashboardData = async () => {
    try {
      const [invoicesRes, tasksRes] = await Promise.all([
        supabase.from("invoices").select("*, debtors(name)"),
        supabase
          .from("collection_tasks")
          .select("*, debtors(name, company_name), invoices(invoice_number)")
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      const allInvoices = invoicesRes.data || [];
      setInvoices(allInvoices);

      if (!tasksRes.error) {
        setPendingTasks(tasksRes.data || []);
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

  const runOutreach = async () => {
    setRunningOutreach(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-template-based-messages');
      
      if (error) throw error;
      
      if (data?.sent > 0) {
        toast.success(`Sent ${data.sent} outreach messages`);
      } else if (data?.skipped > 0) {
        toast.info(`No new messages to send. ${data.skipped} already sent.`);
      } else {
        toast.info("No invoices matched template criteria today");
      }
    } catch (err: any) {
      console.error('Error running outreach:', err);
      toast.error(err.message || 'Failed to run outreach');
    } finally {
      setRunningOutreach(false);
    }
  };

  const syncDigest = async () => {
    setSyncingDigest(true);
    try {
      const { error } = await supabase.functions.invoke('daily-digest-runner', {
        body: { force: true, userId: user?.id, skipEmail: true }
      });
      if (error) throw error;
      toast.success('Digest synced with latest data');
      refetchDigest();
      fetchDashboardData();
    } catch (err: any) {
      console.error('Error syncing digest:', err);
      toast.error(err.message || 'Failed to sync digest');
    } finally {
      setSyncingDigest(false);
    }
  };

  const handleTaskClick = (task: DashboardTask) => {
    setSelectedTask({
      id: task.id,
      user_id: '',
      debtor_id: task.debtor_id,
      invoice_id: task.invoice_id || undefined,
      task_type: task.task_type,
      priority: task.priority as 'low' | 'normal' | 'high' | 'urgent',
      status: task.status as 'open' | 'in_progress' | 'done' | 'cancelled',
      summary: task.summary,
      details: task.details || undefined,
      ai_reasoning: task.ai_reasoning || undefined,
      recommended_action: task.recommended_action || undefined,
      assigned_to: task.assigned_to || undefined,
      assigned_persona: task.assigned_persona || undefined,
      due_date: task.due_date || undefined,
      completed_at: task.completed_at || undefined,
      created_at: task.created_at,
      updated_at: task.updated_at,
    });
    setTaskModalOpen(true);
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task updated");
      fetchDashboardData();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleTaskArchive = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task archived");
      fetchDashboardData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleTaskAssign = async (taskId: string, assignedTo: string | null, assignedPersona: string | null) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          assigned_to: assignedTo, 
          assigned_persona: assignedPersona 
        })
        .eq("id", taskId);

      if (error) throw error;
      fetchDashboardData();
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">Dashboard</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
              Welcome back! Here's your collection overview.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={syncDigest} 
              disabled={syncingDigest}
              className="gap-2"
            >
              <Zap className={`h-4 w-4 ${syncingDigest ? 'animate-pulse' : ''}`} />
              {syncingDigest ? 'Syncing...' : 'Sync All Activity'}
            </Button>
            <SavedViewsManager
              savedViews={savedViews}
              activeView={activeView}
              currentConfig={currentConfig}
              onSave={saveView}
              onUpdate={updateView}
              onDelete={deleteView}
              onSetDefault={setDefaultView}
              onLoad={loadView}
              onClear={clearActiveView}
            />
          </div>
        </div>

        {/* Usage Indicator */}
        <UsageIndicator />

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">AI Collection Workflows</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Set up automated collection sequences for your invoices
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline"
                    onClick={runOutreach}
                    disabled={runningOutreach}
                    className="w-full sm:w-auto shrink-0"
                  >
                    {runningOutreach ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Outreach Now
                  </Button>
                  <Button 
                    onClick={() => navigate("/settings/ai-workflows")}
                    className="w-full sm:w-auto shrink-0"
                  >
                    Configure Workflows
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-green-500" />
                    Daily Health Digest
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    View your daily collections health summary and AR metrics
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/daily-digest")}
                  className="w-full sm:w-auto shrink-0 border-green-500/30 hover:bg-green-500/10"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Digest
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

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

        {/* AI Insights */}
        <AIInsightsCard scope="dashboard" compact />

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

        {/* Invoice Collectability Report Widget */}
        <InvoiceCollectabilityReport />

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
                      <SortableTableHead
                        sortKey="invoice_number"
                        currentSortKey={overdueSortKey}
                        currentSortDirection={overdueSortDir}
                        onSort={handleOverdueSort}
                      >
                        Invoice #
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="debtors.name"
                        currentSortKey={overdueSortKey}
                        currentSortDirection={overdueSortDir}
                        onSort={handleOverdueSort}
                      >
                        Account
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="amount"
                        currentSortKey={overdueSortKey}
                        currentSortDirection={overdueSortDir}
                        onSort={handleOverdueSort}
                        className="text-right"
                      >
                        Amount
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="daysPastDue"
                        currentSortKey={overdueSortKey}
                        currentSortDirection={overdueSortDir}
                        onSort={handleOverdueSort}
                        className="text-right"
                      >
                        Days
                      </SortableTableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOverdues.map((invoice: any) => (
                      <TableRow 
                        key={invoice.id} 
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
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
                          <Eye className="h-4 w-4 text-muted-foreground" />
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
              <div className="flex items-center justify-between">
                <CardTitle>Open Tasks</CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={tasksAssignedToMeOnly ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setTasksAssignedToMeOnly(!tasksAssignedToMeOnly)}
                  >
                    Assigned to Me
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/tasks")}>
                    View All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const displayTasks = tasksAssignedToMeOnly 
                  ? pendingTasks.filter(t => t.assigned_to === user?.id)
                  : pendingTasks;
                
                if (displayTasks.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        {tasksAssignedToMeOnly ? "No tasks assigned to you" : "No open tasks"}
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {displayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="flex-1">
                          <p className="font-medium line-clamp-1">
                            {task.summary}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {task.debtors?.company_name || task.debtors?.name}
                            {task.invoices?.invoice_number && ` • ${task.invoices.invoice_number}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "default" : "secondary"}>
                            {task.priority}
                          </Badge>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Payment Activity Section */}
        <PaymentActivityCard limit={5} />

        {/* Account Dashboard Section */}
        <div className="space-y-6 pt-8 border-t">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Account Analytics</h2>
              <p className="text-muted-foreground">Monitor payment scores and risk indicators</p>
            </div>
            <Button 
              onClick={() => calculateScore.mutate({ recalculate_all: true })} 
              disabled={calculateScore.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${calculateScore.isPending ? "animate-spin" : ""}`} />
              Recalculate Scores
            </Button>
          </div>

          {/* Account Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{debtorData?.summary.totalDebtors || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Days Sales Outstanding</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{debtorData?.summary.dso || 0}</div>
                <p className="text-xs text-muted-foreground">Days average</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Payment Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{debtorData?.summary.avgScore || 50}</div>
                <p className="text-xs text-muted-foreground">Out of 100</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{debtorData?.summary.lowRisk || 0}</div>
                <p className="text-xs text-muted-foreground">Score 80-100</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Risk</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{debtorData?.summary.highRisk || 0}</div>
                <p className="text-xs text-muted-foreground">Score 0-49</p>
              </CardContent>
            </Card>
          </div>

          {/* Aging Bucket Breakdown */}
          <AgingBucketBreakdown />
        </div>

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          open={taskModalOpen}
          onOpenChange={setTaskModalOpen}
          onStatusChange={handleTaskStatusChange}
          onArchive={handleTaskArchive}
          onAssign={handleTaskAssign}
          onNoteAdded={fetchDashboardData}
        />
      </div>
    </Layout>
  );
};

export default Dashboard;
