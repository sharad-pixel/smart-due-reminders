import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { formatCurrency } from "@/lib/formatters";
import {
  ArrowUpRight,
  ArrowDownRight,
  FileSignature,
  CalendarClock,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Clock,
  BadgeDollarSign,
  Activity,
  ExternalLink,
} from "lucide-react";

/* ---------- helpers ---------- */

type ContractRow = {
  id: string;
  title: string | null;
  status: string | null;
  contract_type: string | null;
  contract_value: number | null;
  currency: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  renewal_date: string | null;
  counterparty_name: string | null;
  created_at: string;
};

type CriticalDate = {
  id: string;
  date_type: string;
  due_date: string | null;
  risk_level: string | null;
  status: string | null;
};

type RiskFlag = {
  id: string;
  severity: string | null;
  flag_type: string | null;
  resolved: boolean | null;
  import_id: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const isWithin = (iso: string | null | undefined, days: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const delta = t - Date.now();
  return delta >= 0 && delta <= days * DAY;
};
const daysUntil = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / DAY);
};

/* ---------- Sparkline ---------- */
const Sparkline = ({ points, color = "hsl(var(--primary))" }: { points: number[]; color?: string }) => {
  const w = 260;
  const h = 56;
  if (points.length < 2) points = [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${h - ((v - min) / range) * (h - 6) - 3}`)
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ---------- KPI card ---------- */
type Trend = "up" | "down" | "neutral";
type KpiProps = {
  label: string;
  value: string;
  delta?: string;
  deltaTrend?: Trend;
  spark?: number[];
  sparkColor?: string;
  loading?: boolean;
};

const KpiCard = ({ label, value, delta, deltaTrend = "up", spark, sparkColor, loading }: KpiProps) => {
  const deltaColor =
    deltaTrend === "up"
      ? "text-emerald-500"
      : deltaTrend === "down"
      ? "text-destructive"
      : "text-muted-foreground";
  const DeltaIcon = deltaTrend === "up" ? ArrowUpRight : deltaTrend === "down" ? ArrowDownRight : Activity;

  return (
    <Card className="relative overflow-hidden border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${deltaColor}`}>
            <DeltaIcon className="h-3 w-3" />
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2.5">
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        )}
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <Sparkline points={spark ?? [2, 3, 2, 4, 3, 5, 4, 6]} color={sparkColor} />
        )}
      </div>
    </Card>
  );
};

/* ---------- Page ---------- */

export default function ContractIntelligenceDashboard() {
  const { accountId, isLoading: accLoading } = useAccountId();

  const { data: contracts, isLoading: cLoading } = useQuery({
    enabled: !!accountId,
    queryKey: ["cid-contracts", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_contract_imports")
        .select("id,contract_name,status,contract_type,contract_value,effective_date,term_end_date,extracted_customer_jsonb,created_at")
        .eq("account_id", accountId!)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((r: any): ContractRow => ({
        id: r.id,
        title: r.contract_name,
        status: r.status,
        contract_type: r.contract_type,
        contract_value: r.contract_value,
        currency: "USD",
        effective_date: r.effective_date,
        expiry_date: r.term_end_date,
        renewal_date: r.term_end_date,
        counterparty_name: r.extracted_customer_jsonb?.name ?? r.extracted_customer_jsonb?.customer_name ?? null,
        created_at: r.created_at,
      }));
    },
  });

  const { data: criticalDates, isLoading: dLoading } = useQuery({
    enabled: !!accountId,
    queryKey: ["cid-critical-dates", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_critical_dates")
        .select("id,date_type,due_date,risk_level,status")
        .eq("account_id", accountId!)
        .order("due_date", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as CriticalDate[];
    },
  });

  const { data: riskFlags, isLoading: rLoading } = useQuery({
    enabled: !!accountId,
    queryKey: ["cid-risk-flags", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_risk_flags")
        .select("id,severity,flag_type,resolved,import_id")
        .eq("account_id", accountId!)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as RiskFlag[];
    },
  });

  const loading = accLoading || cLoading || dLoading || rLoading;

  /* ---- derived metrics ---- */
  const metrics = useMemo(() => {
    const list = contracts ?? [];
    const flags = riskFlags ?? [];
    const dates = criticalDates ?? [];

    const activeContracts = list.filter((c) => (c.status ?? "").toLowerCase() !== "expired");
    const tcv = activeContracts.reduce((s, c) => s + (Number(c.contract_value) || 0), 0);

    const recurring = activeContracts.filter(
      (c) => c.contract_type && /subscription|saas|recurring|msa/i.test(c.contract_type)
    );
    const arr = recurring.reduce((s, c) => s + (Number(c.contract_value) || 0), 0);

    const renewalsNext90 = list.filter(
      (c) => isWithin(c.renewal_date, 90) || isWithin(c.expiry_date, 90)
    );
    const renewalsNext90Value = renewalsNext90.reduce((s, c) => s + (Number(c.contract_value) || 0), 0);

    const expiring30 = list.filter((c) => isWithin(c.expiry_date, 30));

    const unresolvedFlags = flags.filter((f) => !f.resolved);
    const critHighImportIds = new Set(
      unresolvedFlags
        .filter((f) => f.severity && /high|critical/i.test(f.severity))
        .map((f) => f.import_id)
        .filter(Boolean) as string[]
    );
    // Revenue at risk: contracts with high/critical unresolved flags OR expiring in <30d
    const revenueAtRisk = list
      .filter((c) => critHighImportIds.has(c.id) || isWithin(c.expiry_date, 30))
      .reduce((s, c) => s + (Number(c.contract_value) || 0), 0);

    const total = list.length || 1;
    const flagged = new Set(unresolvedFlags.map((f) => f.import_id)).size;
    const healthPct = Math.round(((total - flagged) / total) * 100);

    const criticalDates60 = dates.filter(
      (d) => isWithin(d.due_date, 60) && (d.status ?? "open") !== "closed"
    );

    // Renewal timeline: next 12 weeks
    const buckets = Array.from({ length: 12 }, () => 0);
    for (const c of list) {
      const iso = c.renewal_date || c.expiry_date;
      const d = daysUntil(iso);
      if (d === null || d < 0 || d > 84) continue;
      const week = Math.min(11, Math.floor(d / 7));
      buckets[week] += Number(c.contract_value) || 1;
    }

    // Risk distribution
    const buckets_risk = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const f of unresolvedFlags) {
      const s = (f.severity ?? "low").toLowerCase();
      if (s in buckets_risk) (buckets_risk as Record<string, number>)[s] += 1;
      else buckets_risk.low += 1;
    }
    const totalFlags = Object.values(buckets_risk).reduce((a, b) => a + b, 0) || 1;

    // Recently ingested trend (last 12 weeks — contract count per week)
    const weekly = Array.from({ length: 12 }, () => 0);
    const now = Date.now();
    for (const c of list) {
      const t = new Date(c.created_at).getTime();
      const diffWeeks = Math.floor((now - t) / (7 * DAY));
      if (diffWeeks >= 0 && diffWeeks < 12) weekly[11 - diffWeeks] += 1;
    }

    return {
      totalContracts: list.length,
      activeContracts: activeContracts.length,
      tcv,
      arr,
      recurringCount: recurring.length,
      renewalsNext90,
      renewalsNext90Value,
      expiring30Count: expiring30.length,
      revenueAtRisk,
      unresolvedFlagsCount: unresolvedFlags.length,
      healthPct,
      criticalDates60,
      renewalBuckets: buckets,
      riskBuckets: buckets_risk,
      totalFlags,
      weeklyCounts: weekly,
    };
  }, [contracts, riskFlags, criticalDates]);

  const currency = (contracts?.[0]?.currency as string | undefined) || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  const upcomingRenewals = useMemo(() => {
    return [...metrics.renewalsNext90]
      .sort(
        (a, b) =>
          new Date(a.renewal_date || a.expiry_date || 0).getTime() -
          new Date(b.renewal_date || b.expiry_date || 0).getTime()
      )
      .slice(0, 6);
  }, [metrics.renewalsNext90]);

  const upcomingCriticalDates = useMemo(
    () =>
      [...metrics.criticalDates60]
        .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
        .slice(0, 6),
    [metrics.criticalDates60]
  );

  const maxRenewalBar = Math.max(1, ...metrics.renewalBuckets);

  return (
    <Layout>
      <SEO
        title="Contract Intelligence Dashboard | Recouply"
        description="Real-time contract intelligence — TCV, ARR under contract, renewals, revenue at risk, and critical dates."
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live · Contract Intelligence
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Contract Operating Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Q{Math.floor(new Date().getMonth() / 3) + 1} · {new Date().getFullYear()}</Badge>
              <Badge variant="outline" className="rounded-full">All Entities</Badge>
              <Badge variant="outline" className="rounded-full">{currency}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link to="/ai-ingestion">
                  <FileSignature className="h-4 w-4 mr-1.5" />
                  Manage Contracts
                </Link>
              </Button>
            </div>
          </div>

          {/* Top KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Contract Value"
              value={fmt(metrics.tcv)}
              delta={metrics.tcv > 0 ? "TCV" : undefined}
              deltaTrend="up"
              spark={metrics.weeklyCounts.length ? metrics.weeklyCounts.map((v) => v + 1) : undefined}
              loading={loading}
            />
            <KpiCard
              label="Revenue at Risk"
              value={fmt(metrics.revenueAtRisk)}
              delta={metrics.unresolvedFlagsCount ? `${metrics.unresolvedFlagsCount} flags` : "0 flags"}
              deltaTrend={metrics.revenueAtRisk > 0 ? "down" : "neutral"}
              sparkColor="hsl(var(--destructive))"
              spark={[3, 4, 3, 5, 4, 6, 5, 7]}
              loading={loading}
            />
            <KpiCard
              label="Renewals · 90D"
              value={String(metrics.renewalsNext90.length)}
              delta={fmt(metrics.renewalsNext90Value)}
              deltaTrend="up"
              loading={loading}
            />
            <KpiCard
              label="Contract Health"
              value={`${metrics.healthPct}`}
              delta={`${metrics.totalContracts} total`}
              deltaTrend={metrics.healthPct >= 80 ? "up" : "down"}
              sparkColor="hsl(var(--primary))"
              loading={loading}
            />
          </div>

          {/* Second KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Active Contracts"
              value={String(metrics.activeContracts)}
              delta={`${metrics.recurringCount} recurring`}
              deltaTrend="up"
              loading={loading}
            />
            <KpiCard
              label="Expiring · 30D"
              value={String(metrics.expiring30Count)}
              delta={metrics.expiring30Count > 0 ? "review" : "clear"}
              deltaTrend={metrics.expiring30Count > 0 ? "down" : "up"}
              sparkColor="hsl(var(--destructive))"
              loading={loading}
            />
            <KpiCard
              label="ARR Under Contract"
              value={fmt(metrics.arr)}
              delta={`${metrics.recurringCount} contracts`}
              deltaTrend="up"
              loading={loading}
            />
            <KpiCard
              label="Critical Dates · 60D"
              value={String(metrics.criticalDates60.length)}
              delta="upcoming"
              deltaTrend="neutral"
              sparkColor="hsl(var(--primary))"
              loading={loading}
            />
          </div>

          {/* Renewal timeline + Risk distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <Card className="border-border/60 bg-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Renewal Timeline · Next 12 Weeks
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    Contract value coming up for renewal or expiry by week
                  </div>
                </div>
                <span className="text-xs text-emerald-500 font-medium inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {fmt(metrics.renewalsNext90Value)} · 90d
                </span>
              </div>

              <div className="flex items-end gap-2 h-40">
                {metrics.renewalBuckets.map((v, i) => {
                  const h = (v / maxRenewalBar) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-md bg-gradient-to-t from-primary/70 to-primary/30 border border-primary/40 transition-all"
                          style={{ height: `${Math.max(h, 4)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">W{i + 1}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="border-border/60 bg-card p-6">
              <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Risk Distribution
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Unresolved flags across the portfolio
                </div>
              </div>
              <div className="space-y-4">
                {(["low", "medium", "high", "critical"] as const).map((sev) => {
                  const n = metrics.riskBuckets[sev];
                  const pct = Math.round((n / metrics.totalFlags) * 100);
                  const color =
                    sev === "critical"
                      ? "bg-destructive"
                      : sev === "high"
                      ? "bg-orange-500"
                      : sev === "medium"
                      ? "bg-amber-500"
                      : "bg-emerald-500";
                  return (
                    <div key={sev}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-foreground/80">{sev}</span>
                        <span className="tabular-nums font-medium">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{n} flags</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Upcoming renewals + Critical dates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/60 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Upcoming Renewals</h3>
                </div>
                <Button asChild size="sm" variant="ghost" className="h-8">
                  <Link to="/ai-ingestion">
                    View all <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
              {upcomingRenewals.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No renewals in the next 90 days.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcomingRenewals.map((c) => {
                    const d = daysUntil(c.renewal_date || c.expiry_date);
                    return (
                      <li key={c.id} className="py-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {c.title || c.counterparty_name || "Untitled contract"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.counterparty_name || c.contract_type || "—"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold tabular-nums">
                            {fmt(Number(c.contract_value) || 0)}
                          </div>
                          <div
                            className={`text-[11px] tabular-nums ${
                              d !== null && d <= 30 ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {d !== null ? `${d}d` : "—"}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="border-border/60 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Critical Dates · 60 Days</h3>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {metrics.criticalDates60.length}
                </Badge>
              </div>
              {upcomingCriticalDates.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No critical dates in the next 60 days.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcomingCriticalDates.map((d) => {
                    const days = daysUntil(d.due_date);
                    const risk = (d.risk_level ?? "low").toLowerCase();
                    const riskColor =
                      risk === "critical" || risk === "high"
                        ? "text-destructive"
                        : risk === "medium"
                        ? "text-amber-500"
                        : "text-emerald-500";
                    return (
                      <li key={d.id} className="py-3 flex items-center gap-3">
                        <Clock className={`h-4 w-4 ${riskColor}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium capitalize truncate">
                            {(d.date_type || "date").replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.due_date
                              ? new Date(d.due_date).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"}
                          </div>
                        </div>
                        <div
                          className={`text-[11px] tabular-nums font-medium ${
                            days !== null && days <= 14 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {days !== null ? `${days}d` : "—"}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Footer summary strip */}
          <Card className="border-border/60 bg-card p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: BadgeDollarSign, label: "TCV", value: fmt(metrics.tcv) },
                { icon: Sparkles, label: "ARR", value: fmt(metrics.arr) },
                { icon: FileSignature, label: "Active", value: String(metrics.activeContracts) },
                { icon: ShieldAlert, label: "Open Flags", value: String(metrics.unresolvedFlagsCount) },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className="text-base font-semibold tabular-nums">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
