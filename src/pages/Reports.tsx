import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
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
  Legend,
} from "recharts";
import { Info, MessageSquare, CheckCircle2, Circle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Range = "3m" | "6m" | "1y" | "2y";

const rangeMonths: Record<Range, number> = { "3m": 3, "6m": 6, "1y": 12, "2y": 24 };

interface MonthBucket {
  label: string;
  key: string;
  start: Date;
  end: Date;
  outstanding: number;
  recovered: number;
  overdue: number;
  recoveryRate: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function Reports() {
  const [range, setRange] = useState<Range>("1y");
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<MonthBucket[]>([]);

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
          outstanding: 0,
          recovered: 0,
          overdue: 0,
          recoveryRate: 0,
        });
      }

      const { data: invoices } = await supabase
        .from("invoices")
        .select("amount_due, amount_paid, status, issue_date, due_date, paid_at")
        .gte("issue_date", dateRange.start.toISOString())
        .lte("issue_date", dateRange.end.toISOString());

      (invoices || []).forEach((inv: any) => {
        const issue = inv.issue_date ? new Date(inv.issue_date) : null;
        if (!issue) return;
        const key = format(issue, "yyyy-MM");
        const b = months.find((m) => m.key === key);
        if (!b) return;
        const due = Number(inv.amount_due || 0);
        const paid = Number(inv.amount_paid || 0);
        b.outstanding += due;
        b.recovered += paid;
        if (inv.status === "overdue" || (inv.due_date && new Date(inv.due_date) < new Date() && paid < due)) {
          b.overdue += due - paid;
        }
      });

      months.forEach((m) => {
        m.recoveryRate = m.outstanding > 0 ? Math.round((m.recovered / m.outstanding) * 100) : 0;
      });

      if (!cancelled) {
        setBuckets(months);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, dateRange]);

  const totals = useMemo(() => {
    const invoiced = buckets.reduce((s, b) => s + b.outstanding, 0);
    const recovered = buckets.reduce((s, b) => s + b.recovered, 0);
    const overdue = buckets.reduce((s, b) => s + b.overdue, 0);
    const rate = invoiced > 0 ? (recovered / invoiced) * 100 : 0;
    return { invoiced, recovered, overdue, rate };
  }, [buckets]);

  const optimizeItems = [
    { label: "Connect billing source", done: true },
    { label: "Enable AI outreach workflows", done: true },
    { label: "Turn on payment reminders", done: false },
    { label: "Configure escalation rules", done: false },
  ];

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Revenue recovery</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Automated recovery reporting across failed payments, outreach and reconciliations.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Give feedback
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            {["overview", "retries", "emails", "automations"].map((t) => (
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
              {/* MAIN */}
              <div className="space-y-8 min-w-0">
                {/* Range chips */}
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

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
                  <Kpi label="Invoiced" value={currency(totals.invoiced)} />
                  <Kpi
                    label="Overdue rate"
                    value={`${totals.invoiced > 0 ? Math.round((totals.overdue / totals.invoiced) * 100) : 0}%`}
                  />
                  <Kpi label="Recovered payments" value={currency(totals.recovered)} />
                  <Kpi label="Recovery rate" value={`${Math.round(totals.rate)}%`} />
                </div>

                {/* Chart 1: Recovery breakdown */}
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
                        <Bar dataKey="outstanding" stackId="a" fill="hsl(var(--muted-foreground) / 0.35)" radius={[0, 0, 0, 0]} />
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

                {/* Chart 2 */}
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
                        <Bar dataKey="recovered" stackId="b" fill="hsl(var(--primary) / 0.4)" />
                        <Bar dataKey="overdue" stackId="b" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ReportSection>
              </div>

              {/* SIDE RAIL */}
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
                    Top accounts in recovery <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </h3>
                  <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground flex gap-2">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>This panel populates with accounts actively being retried once live data flows.</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Resources</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-foreground">Recovery analytics explained</p>
                      <Link to="/knowledge-base" className="text-primary hover:underline">
                        View doc →
                      </Link>
                    </div>
                    <div>
                      <p className="text-foreground">
                        Configure automated recovery workflows for failed subscription payments
                      </p>
                      <Link to="/settings/ai-workflows" className="text-primary hover:underline">
                        View doc →
                      </Link>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="retries" className="mt-6">
            <EmptyReport title="Retry analytics" description="Failed payment retry cadence and success rates coming soon." />
          </TabsContent>
          <TabsContent value="emails" className="mt-6">
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Email performance</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Deep-dive deliverability lives in the Email Delivery report.
              </p>
              <Link to="/reports/email-delivery">
                <Button size="sm">Open Email Delivery →</Button>
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="automations" className="mt-6">
            <EmptyReport title="Automation impact" description="Attribution of collected revenue to individual workflows coming soon." />
          </TabsContent>
        </Tabs>
      </div>
      {loading && <div className="fixed bottom-4 right-4 text-xs text-muted-foreground">Loading…</div>}
    </Layout>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {label} <Info className="h-3 w-3" />
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="outline" size="sm">Explore</Button>
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

function EmptyReport({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border p-10 text-center">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
