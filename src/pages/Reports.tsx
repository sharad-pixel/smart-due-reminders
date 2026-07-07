import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { Info, MessageSquare, CheckCircle2, Circle, FileText, AlertTriangle, TrendingUp, Sparkles, ArrowUpRight, Gauge, Users as UsersIcon } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_AGENT_MAP, AGING_BUCKETS, getAgingBucketFromDays } from "@/lib/agingBuckets";

type Range = "3m" | "6m" | "1y" | "2y";

const rangeMonths: Record<Range, number> = { "3m": 3, "6m": 6, "1y": 12, "2y": 24 };

interface MonthBucket {
  label: string;
  key: string;
  start: Date;
  end: Date;
  invoiced: number;      // total billed in month
  recovered: number;     // amount collected on those invoices
  outstanding: number;   // still outstanding
  overdue: number;       // past due and outstanding
  recoveryRate: number;  // %
  outreach: number;      // # of outbound collection activities in month
  manualCollected: number; // recovered without workflow assistance (fallback bucket)
  autoCollected: number;   // recovered attributed to outreach
}

interface ContractStats {
  totalContracts: number;
  activeSchedules: number;
  scheduledValue: number;
  invoicesFromContracts: number;
  contractInvoicedAmount: number;
  contractRecoveredAmount: number;
  contractOverdueAmount: number;
}

interface ContractInsight {
  contractId: string;
  name: string;
  invoiced: number;
  recovered: number;
  overdue: number;
  overdueRate: number;
  recoveryRate: number;
  invoiceCount: number;
  overdueInvoiceCount: number;
  outreachCount: number;
  outreachPerOverdueInvoice: number;
  suggestedCadence: string;
  currentCadence: string;
  expectedLift: number;
  severity: "high" | "medium" | "low";
}

interface AgentStat {
  agentKey: string;
  agentName: string;
  bucketLabel: string;
  completed: number;
  inbound: number;
  forecasted: number;
  responseRate: number;
  invoicesInBucket: number;
  overdueAmount: number;
  recoveredAmount: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function Reports() {
  const [range, setRange] = useState<Range>("1y");
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<MonthBucket[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [dso, setDso] = useState<number | null>(null);
  const [contract, setContract] = useState<ContractStats>({
    totalContracts: 0,
    activeSchedules: 0,
    scheduledValue: 0,
    invoicesFromContracts: 0,
    contractInvoicedAmount: 0,
    contractRecoveredAmount: 0,
    contractOverdueAmount: 0,
  });
  const [insights, setInsights] = useState<ContractInsight[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);

  const dateRange = useMemo(() => {
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(end, rangeMonths[range] - 1));
    return { start, end };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const months: MonthBucket[] = [];
      for (let i = rangeMonths[range] - 1; i >= 0; i--) {
        const s = startOfMonth(subMonths(new Date(), i));
        const e = endOfMonth(s);
        months.push({
          label: format(s, "MMM yy"),
          key: format(s, "yyyy-MM"),
          start: s,
          end: e,
          invoiced: 0,
          recovered: 0,
          outstanding: 0,
          overdue: 0,
          recoveryRate: 0,
          outreach: 0,
          manualCollected: 0,
          autoCollected: 0,
        });
      }

      // Paginate invoices in range
      const invoices: any[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("invoices")
          .select("id, amount, amount_outstanding, status, issue_date, due_date, paid_date, source_contract_id, aging_bucket")
          .gte("issue_date", format(dateRange.start, "yyyy-MM-dd"))
          .lte("issue_date", format(dateRange.end, "yyyy-MM-dd"))
          .eq("is_archived", false)
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        invoices.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const now = new Date();
      const daysToPaySamples: number[] = [];
      let contractInvoiced = 0;
      let contractRecovered = 0;
      let contractOverdue = 0;
      let contractInvoiceCount = 0;

      // Per-contract aggregation for optimization insights
      const contractAgg = new Map<
        string,
        {
          invoiced: number;
          recovered: number;
          overdue: number;
          invoiceCount: number;
          overdueInvoiceCount: number;
          invoiceIds: Set<string>;
        }
      >();

      // Per-invoice aging bucket (for agent attribution)
      const invoiceBucket = new Map<string, string>();
      // Aggregate open invoices per bucket for forecasting
      const bucketOpenCounts = new Map<string, { count: number; overdue: number; recovered: number }>();

      invoices.forEach((inv: any) => {
        const issue = inv.issue_date ? new Date(inv.issue_date) : null;
        if (!issue) return;
        const key = format(issue, "yyyy-MM");
        const b = months.find((m) => m.key === key);
        if (!b) return;
        const amt = Number(inv.amount || 0);
        const outs = Number(inv.amount_outstanding || 0);
        const recovered = Math.max(0, amt - outs);
        b.invoiced += amt;
        b.recovered += recovered;
        b.outstanding += outs;
        const isOverdue = !!(inv.due_date && new Date(inv.due_date) < now && outs > 0);
        if (isOverdue) b.overdue += outs;
        if (inv.paid_date && inv.due_date) {
          const d = differenceInDays(new Date(inv.paid_date), new Date(inv.due_date));
          daysToPaySamples.push(d);
        }

        // Determine bucket for agent attribution
        let bucketKey: string = inv.aging_bucket;
        if (!bucketKey && inv.due_date) {
          const dpd = differenceInDays(now, new Date(inv.due_date));
          bucketKey = getAgingBucketFromDays(dpd);
        }
        if (bucketKey) {
          invoiceBucket.set(inv.id, bucketKey);
          if (bucketKey !== "current") {
            const agg = bucketOpenCounts.get(bucketKey) ?? { count: 0, overdue: 0, recovered: 0 };
            if (outs > 0) {
              agg.count++;
              agg.overdue += outs;
            }
            agg.recovered += recovered;
            bucketOpenCounts.set(bucketKey, agg);
          }
        }

        if (inv.source_contract_id) {
          contractInvoiceCount++;
          contractInvoiced += amt;
          contractRecovered += recovered;
          if (isOverdue) contractOverdue += outs;
          const cid = inv.source_contract_id as string;
          const agg = contractAgg.get(cid) ?? {
            invoiced: 0,
            recovered: 0,
            overdue: 0,
            invoiceCount: 0,
            overdueInvoiceCount: 0,
            invoiceIds: new Set<string>(),
          };
          agg.invoiced += amt;
          agg.recovered += recovered;
          if (isOverdue) {
            agg.overdue += outs;
            agg.overdueInvoiceCount++;
          }
          agg.invoiceCount++;
          agg.invoiceIds.add(inv.id);
          contractAgg.set(cid, agg);
        }
      });

      // Collection activities per month + per invoice + per agent bucket
      const { data: acts } = await supabase
        .from("collection_activities")
        .select("created_at, direction, invoice_id")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .limit(10000);

      const outreachByInvoice = new Map<string, number>();
      const agentAgg = new Map<string, { completed: number; inbound: number }>();
      (acts || []).forEach((a: any) => {
        const key = format(new Date(a.created_at), "yyyy-MM");
        const b = months.find((m) => m.key === key);
        if (b) b.outreach += 1;
        if (a.invoice_id) {
          outreachByInvoice.set(a.invoice_id, (outreachByInvoice.get(a.invoice_id) ?? 0) + 1);
          const bucket = invoiceBucket.get(a.invoice_id);
          if (bucket && bucket !== "current") {
            const cur = agentAgg.get(bucket) ?? { completed: 0, inbound: 0 };
            if (a.direction === "inbound") cur.inbound++;
            else cur.completed++;
            agentAgg.set(bucket, cur);
          }
        }
      });

      // Build per-agent stats (skip current bucket which has no agent)
      const monthsInRange = Math.max(1, rangeMonths[range]);
      const builtAgentStats: AgentStat[] = Object.entries(BUCKET_AGENT_MAP).map(
        ([bucketKey, agent]) => {
          const acts = agentAgg.get(bucketKey) ?? { completed: 0, inbound: 0 };
          const open = bucketOpenCounts.get(bucketKey) ?? { count: 0, overdue: 0, recovered: 0 };
          const totalContact = acts.completed + acts.inbound;
          // Forecasted = expected touches next month based on open overdue invoices in bucket.
          // Assume ~2 touches per open overdue invoice per month for that bucket.
          const forecasted = open.count * 2;
          const bucketDef = AGING_BUCKETS.find((b) => b.key === bucketKey);
          return {
            agentKey: agent.key,
            agentName: agent.name,
            bucketLabel: bucketDef?.label ?? bucketKey,
            completed: acts.completed,
            inbound: acts.inbound,
            forecasted,
            responseRate: totalContact > 0 ? (acts.inbound / totalContact) * 100 : 0,
            invoicesInBucket: open.count,
            overdueAmount: open.overdue,
            recoveredAmount: open.recovered,
          };
        }
      );



      // Split recovered into "automated" (months with outreach) vs "manual"
      months.forEach((m) => {
        m.recoveryRate = m.invoiced > 0 ? Math.round((m.recovered / m.invoiced) * 100) : 0;
        if (m.outreach > 0 && m.recovered > 0) {
          const autoShare = Math.min(1, m.outreach / Math.max(m.outreach, 5));
          m.autoCollected = Math.round(m.recovered * autoShare);
          m.manualCollected = m.recovered - m.autoCollected;
        } else {
          m.manualCollected = m.recovered;
        }
      });

      const totalActs = (acts || []).length;
      const avgDaysLate = daysToPaySamples.length
        ? Math.round(daysToPaySamples.reduce((s, d) => s + d, 0) / daysToPaySamples.length)
        : null;

      // Contract intelligence
      const [{ count: schedulesCount }, { data: schedRows }, { count: importsCount }] = await Promise.all([
        supabase.from("contract_invoice_schedules").select("id", { count: "exact", head: true }),
        supabase.from("contract_invoice_schedules").select("scheduled_amount, amount").limit(1000),
        supabase.from("live_contract_imports").select("id", { count: "exact", head: true }),
      ]);

      const scheduledValue = (schedRows || []).reduce(
        (s: number, r: any) => s + Number(r.scheduled_amount ?? r.amount ?? 0),
        0
      );

      // Build optimization insights: rank contracts by overdue exposure
      const candidateIds = Array.from(contractAgg.entries())
        .filter(([, v]) => v.invoiced > 0)
        .sort((a, b) => b[1].overdue - a[1].overdue)
        .slice(0, 8)
        .map(([id]) => id);

      const nameById = new Map<string, string>();
      if (candidateIds.length > 0) {
        const { data: contractRows } = await supabase
          .from("live_contract_imports")
          .select("id, contract_name, file_name")
          .in("id", candidateIds);
        (contractRows || []).forEach((c: any) => {
          nameById.set(c.id, c.contract_name || c.file_name || `Contract ${String(c.id).slice(0, 8)}`);
        });
      }

      const builtInsights: ContractInsight[] = candidateIds
        .map((cid) => {
          const v = contractAgg.get(cid)!;
          let outreachCount = 0;
          v.invoiceIds.forEach((iid) => {
            outreachCount += outreachByInvoice.get(iid) ?? 0;
          });
          const overdueRate = v.invoiced > 0 ? v.overdue / v.invoiced : 0;
          const recoveryRate = v.invoiced > 0 ? v.recovered / v.invoiced : 0;
          const outreachPerOverdue =
            v.overdueInvoiceCount > 0 ? outreachCount / v.overdueInvoiceCount : outreachCount;

          let currentCadence = "No outreach";
          if (outreachPerOverdue >= 4) currentCadence = "Weekly";
          else if (outreachPerOverdue >= 2) currentCadence = "Bi-weekly";
          else if (outreachPerOverdue >= 1) currentCadence = "Monthly";

          let suggestedCadence = currentCadence;
          let uplift = 0.05;
          let severity: "high" | "medium" | "low" = "low";

          if (overdueRate > 0.5 && outreachPerOverdue < 2) {
            suggestedCadence = "Every 3–5 days + escalation";
            uplift = 0.25;
            severity = "high";
          } else if (overdueRate > 0.3 && outreachPerOverdue < 2) {
            suggestedCadence = "Weekly with phone touchpoint";
            uplift = 0.18;
            severity = "high";
          } else if (overdueRate > 0.15 && outreachPerOverdue < 3) {
            suggestedCadence = "Weekly reminders";
            uplift = 0.12;
            severity = "medium";
          } else if (overdueRate > 0.05) {
            suggestedCadence = "Add pre-due-date reminder (T-3d)";
            uplift = 0.08;
            severity = "medium";
          } else {
            suggestedCadence = "Maintain current cadence";
            uplift = 0.03;
            severity = "low";
          }

          return {
            contractId: cid,
            name: nameById.get(cid) || `Contract ${cid.slice(0, 8)}`,
            invoiced: v.invoiced,
            recovered: v.recovered,
            overdue: v.overdue,
            overdueRate,
            recoveryRate,
            invoiceCount: v.invoiceCount,
            overdueInvoiceCount: v.overdueInvoiceCount,
            outreachCount,
            outreachPerOverdueInvoice: outreachPerOverdue,
            currentCadence,
            suggestedCadence,
            expectedLift: v.overdue * uplift,
            severity,
          };
        })
        .filter((i) => i.overdue > 0)
        .slice(0, 5);

      if (!cancelled) {
        setBuckets(months);
        setActivityTotal(totalActs);
        setDso(avgDaysLate);
        setContract({
          totalContracts: importsCount || 0,
          activeSchedules: schedulesCount || 0,
          scheduledValue,
          invoicesFromContracts: contractInvoiceCount,
          contractInvoicedAmount: contractInvoiced,
          contractRecoveredAmount: contractRecovered,
          contractOverdueAmount: contractOverdue,
        });
        setInsights(builtInsights);
        setAgentStats(builtAgentStats);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, dateRange]);

  const totals = useMemo(() => {
    const invoiced = buckets.reduce((s, b) => s + b.invoiced, 0);
    const recovered = buckets.reduce((s, b) => s + b.recovered, 0);
    const outstanding = buckets.reduce((s, b) => s + b.outstanding, 0);
    const overdue = buckets.reduce((s, b) => s + b.overdue, 0);
    const rate = invoiced > 0 ? (recovered / invoiced) * 100 : 0;
    return { invoiced, recovered, outstanding, overdue, rate };
  }, [buckets]);

  const optimizeItems = [
    { label: "Connect billing source", done: true },
    { label: "Enable AI outreach workflows", done: true },
    { label: "Turn on payment reminders", done: totals.recovered > 0 },
    { label: "Configure escalation rules", done: false },
  ];

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Revenue recovery</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Automated recovery reporting across invoices, outreach and contract-driven revenue.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            {["overview", "outreach", "agents", "contracts", "aging"].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="capitalize data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 pt-2 bg-transparent"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
              <div className="space-y-8 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-md border overflow-hidden">
                    {(["3m", "6m", "1y", "2y"] as Range[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`px-3 py-1.5 text-sm ${
                          range === r
                            ? "bg-primary/10 text-primary border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(dateRange.start, "MMM dd, yyyy")} – {format(dateRange.end, "MMM dd, yyyy")}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
                  <Kpi label="Invoiced" value={currency(totals.invoiced)} />
                  <Kpi
                    label="Overdue rate"
                    value={`${totals.invoiced > 0 ? Math.round((totals.overdue / totals.invoiced) * 100) : 0}%`}
                    hint={currency(totals.overdue)}
                  />
                  <Kpi label="Recovered" value={currency(totals.recovered)} />
                  <Kpi label="Recovery rate" value={`${Math.round(totals.rate)}%`} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <Kpi label="Outstanding" value={currency(totals.outstanding)} />
                  <Kpi label="Outreach sent" value={num(activityTotal)} />
                  <Kpi
                    label="Avg days late on paid"
                    value={dso == null ? "—" : `${dso}d`}
                  />
                  <Kpi
                    label="Contract-linked invoiced"
                    value={currency(contract.contractInvoicedAmount)}
                  />
                </div>

                <OptimizationInsights insights={insights} />

                <ReportSection title="Recovery breakdown">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <LegendDot color="hsl(var(--muted-foreground) / 0.35)" label="Outstanding" />
                    <LegendDot color="hsl(var(--primary))" label="Recovered" />
                    <LegendDot color="hsl(var(--foreground) / 0.7)" label="Recovery rate" line />
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={buckets} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                          formatter={(v: any, name: string) =>
                            name === "recoveryRate" ? `${v}%` : currency(Number(v))
                          }
                        />
                        <Bar dataKey="outstanding" stackId="a" fill="hsl(var(--muted-foreground) / 0.35)" />
                        <Bar dataKey="recovered" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Line
                          type="monotone"
                          dataKey="recoveryRate"
                          stroke="hsl(var(--foreground))"
                          strokeWidth={1.5}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </ReportSection>

                <ReportSection title="Recovered volume by method">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <LegendDot color="hsl(var(--primary) / 0.4)" label="Automated outreach" />
                    <LegendDot color="hsl(var(--primary))" label="Manual collection" />
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buckets} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                          formatter={(v: any) => currency(Number(v))}
                        />
                        <Bar dataKey="autoCollected" stackId="b" fill="hsl(var(--primary) / 0.4)" />
                        <Bar dataKey="manualCollected" stackId="b" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ReportSection>
              </div>

              <aside className="space-y-8">
                <div>
                  <h3 className="font-semibold mb-3">Optimize your recovery</h3>
                  <ul className="space-y-2">
                    {optimizeItems.map((i) => (
                      <li key={i.label} className="flex items-center gap-2 text-sm">
                        {i.done ? (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className={i.done ? "" : "text-primary hover:underline cursor-pointer"}>
                          {i.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-1">
                    Contract intelligence <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </h3>
                  <div className="rounded-md border p-4 space-y-3 text-sm">
                    <Stat icon={FileText} label="Contracts ingested" value={num(contract.totalContracts)} />
                    <Stat icon={TrendingUp} label="Active billing schedules" value={num(contract.activeSchedules)} />
                    <Stat label="Scheduled value" value={currency(contract.scheduledValue)} />
                    <Stat label="Invoices from contracts" value={num(contract.invoicesFromContracts)} />
                    <Stat
                      icon={AlertTriangle}
                      label="Contract overdue"
                      value={currency(contract.contractOverdueAmount)}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Resources</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-foreground">Recovery analytics explained</p>
                      <Link to="/knowledge-base" className="text-primary hover:underline">View doc →</Link>
                    </div>
                    <div>
                      <p className="text-foreground">Configure automated recovery workflows</p>
                      <Link to="/settings/ai-workflows" className="text-primary hover:underline">View doc →</Link>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="outreach" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Kpi label="Total outreach sent" value={num(activityTotal)} />
              <Kpi
                label="Avg outreach per month"
                value={num(Math.round(activityTotal / Math.max(1, buckets.length)))}
              />
              <Kpi
                label="Recovered per outreach"
                value={activityTotal > 0 ? currency(Math.round(totals.recovered / activityTotal)) : "—"}
              />
            </div>
            <ReportSection title="Outreach volume">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buckets} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="outreach" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ReportSection>
          </TabsContent>

          <TabsContent value="agents" className="mt-6 space-y-6">
            <CollectionsByAgent agents={agentStats} />
          </TabsContent>



          <TabsContent value="contracts" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Kpi label="Contracts ingested" value={num(contract.totalContracts)} />
              <Kpi label="Active schedules" value={num(contract.activeSchedules)} />
              <Kpi label="Scheduled value" value={currency(contract.scheduledValue)} />
              <Kpi label="Contract invoices" value={num(contract.invoicesFromContracts)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <Kpi label="Contract invoiced" value={currency(contract.contractInvoicedAmount)} />
              <Kpi label="Contract recovered" value={currency(contract.contractRecoveredAmount)} />
              <Kpi label="Contract overdue" value={currency(contract.contractOverdueAmount)} />
            </div>
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Recouply's contract intelligence links each invoice back to the source contract and its billing schedule.
              Metrics above cover invoices tied to <code>source_contract_id</code> within the selected time range.
              <div className="mt-3">
                <Link to="/contracts" className="text-primary hover:underline">View contracts →</Link>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="aging" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Kpi label="Outstanding" value={currency(totals.outstanding)} />
              <Kpi label="Overdue" value={currency(totals.overdue)} />
              <Kpi
                label="On-time"
                value={currency(Math.max(0, totals.outstanding - totals.overdue))}
              />
              <Kpi label="Avg days late" value={dso == null ? "—" : `${dso}d`} />
            </div>
            <ReportSection title="Overdue trend">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buckets} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => currency(Number(v))}
                    />
                    <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ReportSection>
          </TabsContent>
        </Tabs>
      </div>
      {loading && <div className="fixed bottom-4 right-4 text-xs text-muted-foreground">Loading…</div>}
    </Layout>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {label} <Info className="h-3 w-3" />
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function LegendDot({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {line ? (
        <span className="inline-block w-4 h-0.5" style={{ background: color }} />
      ) : (
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function OptimizationInsights({ insights }: { insights: ContractInsight[] }) {
  const totalLift = insights.reduce((s, i) => s + i.expectedLift, 0);
  const severityBadge = (s: ContractInsight["severity"]) => {
    if (s === "high") return "bg-destructive/10 text-destructive border-destructive/20";
    if (s === "medium") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Optimization insights</h2>
        </div>
        {totalLift > 0 && (
          <div className="text-sm text-muted-foreground">
            Projected recovery lift{" "}
            <span className="font-semibold text-foreground">{currency(totalLift)}</span>
          </div>
        )}
      </div>

      {insights.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          No underperforming contracts detected in this period. Ingest more contracts or extend the
          time range to surface cadence recommendations.
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {insights.map((i) => (
            <div key={i.contractId} className="p-4 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto] gap-4 items-start">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${severityBadge(i.severity)}`}
                  >
                    {i.severity}
                  </span>
                  <span className="font-medium truncate">{i.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {i.invoiceCount} invoice{i.invoiceCount === 1 ? "" : "s"} · {i.overdueInvoiceCount} overdue ·{" "}
                  {Math.round(i.overdueRate * 100)}% overdue rate
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Recovery rate {Math.round(i.recoveryRate * 100)}% · {i.outreachCount} outreach touchpoints
                </div>
              </div>

              <div className="text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Gauge className="h-3 w-3" /> Cadence
                </div>
                <div className="mt-0.5">
                  <span className="text-muted-foreground line-through mr-1">{i.currentCadence}</span>
                  <span className="font-medium">{i.suggestedCadence}</span>
                </div>
              </div>

              <div className="text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ArrowUpRight className="h-3 w-3" /> Expected lift
                </div>
                <div className="mt-0.5 font-semibold text-primary">{currency(i.expectedLift)}</div>
                <div className="text-xs text-muted-foreground">of {currency(i.overdue)} overdue</div>
              </div>

              <div className="justify-self-start md:justify-self-end">
                <Link to={`/contracts?id=${i.contractId}`}>
                  <Button size="sm" variant="outline">Apply</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionsByAgent({ agents }: { agents: AgentStat[] }) {
  const totals = agents.reduce(
    (acc, a) => ({
      completed: acc.completed + a.completed,
      inbound: acc.inbound + a.inbound,
      forecasted: acc.forecasted + a.forecasted,
      overdue: acc.overdue + a.overdueAmount,
      recovered: acc.recovered + a.recoveredAmount,
    }),
    { completed: 0, inbound: 0, forecasted: 0, overdue: 0, recovered: 0 }
  );
  const totalContact = totals.completed + totals.inbound;
  const avgResponse = totalContact > 0 ? (totals.inbound / totalContact) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <Kpi label="Outreach completed" value={num(totals.completed)} />
        <Kpi label="Inbound replies" value={num(totals.inbound)} />
        <Kpi label="Forecasted (next 30d)" value={num(totals.forecasted)} />
        <Kpi label="Avg response rate" value={`${Math.round(avgResponse)}%`} />
        <Kpi label="Overdue under management" value={currency(totals.overdue)} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Collections by agent</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Outreach attribution based on invoice aging bucket
          </span>
        </div>

        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Agent</th>
                <th className="text-left px-4 py-2 font-medium">Bucket</th>
                <th className="text-right px-4 py-2 font-medium">Completed</th>
                <th className="text-right px-4 py-2 font-medium">Forecasted</th>
                <th className="text-right px-4 py-2 font-medium">Inbound</th>
                <th className="text-right px-4 py-2 font-medium">Response rate</th>
                <th className="text-right px-4 py-2 font-medium">Open invoices</th>
                <th className="text-right px-4 py-2 font-medium">Overdue $</th>
                <th className="text-right px-4 py-2 font-medium">Recovered $</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agents.map((a) => {
                const maxBar = Math.max(1, ...agents.map((x) => x.completed + x.forecasted));
                const completedPct = (a.completed / maxBar) * 100;
                const forecastPct = (a.forecasted / maxBar) * 100;
                return (
                  <tr key={a.agentKey} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {a.agentName.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-medium">{a.agentName}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">{a.agentKey} persona</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.bucketLabel}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium">{num(a.completed)}</div>
                      <div className="mt-1 h-1 bg-muted rounded">
                        <div className="h-1 bg-primary rounded" style={{ width: `${completedPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium">{num(a.forecasted)}</div>
                      <div className="mt-1 h-1 bg-muted rounded">
                        <div className="h-1 bg-primary/40 rounded" style={{ width: `${forecastPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{num(a.inbound)}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          a.responseRate >= 25
                            ? "text-primary font-medium"
                            : a.responseRate >= 10
                            ? "text-amber-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {Math.round(a.responseRate)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{num(a.invoicesInBucket)}</td>
                    <td className="px-4 py-3 text-right">{currency(a.overdueAmount)}</td>
                    <td className="px-4 py-3 text-right text-primary">{currency(a.recoveredAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Agents are mapped to aging buckets: Sam (1-30d), James (31-60d), Katy (61-90d), Jimmy (91-120d),
          Troy (121-150d), Rocco (150+d). Forecasted assumes ~2 touches per open overdue invoice next month.
        </p>
      </section>
    </div>
  );
}


