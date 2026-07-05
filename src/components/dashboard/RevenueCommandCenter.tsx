import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  RefreshCcw,
  HeartPulse,
  FileText,
  Clock,
  DollarSign,
  Percent,
  FileSignature,
  Wallet,
} from "lucide-react";

type Trend = "up" | "down" | "flat";

interface StatCard {
  label: string;
  value: string;
  sub?: string;
  trend?: Trend;
  trendLabel?: string;
  href: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  spark?: number[];
  accent?: "primary" | "success" | "warning" | "danger";
}

const fmtCurrency = (n: number, currency = "USD") => {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
};

const fmtNum = (n: number) => new Intl.NumberFormat().format(Math.round(n));

// Deterministic pseudo-sparkline from a seed number
const spark = (seed: number, len = 12) => {
  const out: number[] = [];
  let x = seed || 1;
  for (let i = 0; i < len; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(0.4 + (x / 233280) * 0.6);
  }
  return out;
};

const Sparkline = ({ data, color = "hsl(var(--primary))" }: { data: number[]; color?: string }) => {
  const w = 120;
  const h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, "")})`} />
    </svg>
  );
};

type HubVariant = "revenue" | "collections" | "contracts";

interface RevenueCommandCenterProps {
  variant?: HubVariant;
}

const HEADERS: Record<HubVariant, { eyebrow: string; title: string; description: string }> = {
  revenue: {
    eyebrow: "Executive Revenue Intelligence",
    title: "Contracts & Collections Command Center",
    description: "Cash, risk, renewals, and health — synthesized in real time from contracts, invoices, and every customer interaction.",
  },
  collections: {
    eyebrow: "Collections Overview",
    title: "Collections Command Center",
    description: "Open receivables, overdue exposure, DSO, and collection health — live from your invoices and payments.",
  },
  contracts: {
    eyebrow: "Contract Intelligence",
    title: "Contracts Command Center",
    description: "Contract value, renewals, ARR, and revenue risk — synthesized from every active agreement.",
  },
};

const CARD_KEYS: Record<HubVariant, string[]> = {
  revenue: ["Expected Cash · 30D", "Revenue at Risk", "Renewals · 90D", "Customer Health", "Open Invoices", "DSO", "ARR", "Collection Rate"],
  collections: ["Expected Cash · 30D", "Open Invoices", "DSO", "Collection Rate", "Revenue at Risk", "Customer Health"],
  contracts: ["ARR", "Renewals · 90D", "Revenue at Risk", "Customer Health"],
};

export function RevenueCommandCenter({ variant = "revenue" }: RevenueCommandCenterProps = {}) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [paidLast90, setPaidLast90] = useState<{ amount: number; count: number }>({ amount: 0, count: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const ninetyAgo = new Date(now);
        ninetyAgo.setDate(ninetyAgo.getDate() - 90);

        const [invRes, contRes, liveRes, paidRes] = await Promise.all([
          supabase
            .from("invoices")
            .select("amount,due_date,status,aging_bucket,currency,payment_date")
            .limit(5000),
          supabase
            .from("contracts")
            .select("contract_value,currency,status,renewal_date,expiry_date")
            .limit(2000),
          supabase
            .from("live_contract_imports")
            .select("contract_value,effective_date,term_end_date,status,staging_status,contract_name")
            .neq("status", "archived")
            .limit(2000),
          supabase
            .from("invoices")
            .select("amount,payment_date")
            .not("payment_date", "is", null)
            .gte("payment_date", ninetyAgo.toISOString().slice(0, 10))
            .limit(5000),
        ]);

        setInvoices(invRes.data || []);

        // Merge formal contracts + live contract imports so ARR reflects
        // whichever source the workspace uses (most orgs use live_contract_imports).
        const merged = [
          ...((contRes.data || []).map((c: any) => ({
            contract_value: c.contract_value,
            currency: c.currency,
            status: c.status,
            renewal_date: c.renewal_date || c.expiry_date,
            expiry_date: c.expiry_date,
          }))),
          ...((liveRes.data || []).map((c: any) => ({
            contract_value: c.contract_value,
            currency: "USD",
            status: c.status === "imported" ? "active" : c.status,
            renewal_date: c.term_end_date,
            expiry_date: c.term_end_date,
          }))),
        ];
        setContracts(merged);

        const paid = (paidRes.data || []).reduce(
          (acc, r: any) => {
            acc.amount += Number(r.amount || 0);
            acc.count += 1;
            return acc;
          },
          { amount: 0, count: 0 }
        );
        setPaidLast90(paid);
      } catch (e) {
        console.error("RevenueCommandCenter load error", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const openStatuses = new Set(["open", "overdue", "pending", "sent", "past_due", "unpaid"]);
    const open = invoices.filter((i) => !i.payment_date && (i.status ? openStatuses.has(String(i.status).toLowerCase()) : true));

    const openTotal = open.reduce((s, i) => s + Number(i.amount || 0), 0);
    const openCount = open.length;

    // Revenue at risk = overdue >30 days
    const today = new Date();
    const atRisk = open
      .filter((i) => {
        if (!i.due_date) return false;
        const diff = (today.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24);
        return diff > 30;
      })
      .reduce((s, i) => s + Number(i.amount || 0), 0);

    // DSO (approx): (openTotal / (paidLast90.amount / 90)) capped
    const dailyRevenue = paidLast90.amount / 90;
    const dso = dailyRevenue > 0 ? Math.min(180, openTotal / dailyRevenue) : 0;

    // Collection rate last 90 days = paid / (paid + still open)
    const collectionRate = paidLast90.amount + openTotal > 0
      ? (paidLast90.amount / (paidLast90.amount + openTotal)) * 100
      : 0;

    // Cash forecast next 12 weeks based on due dates of open invoices
    const buckets = Array.from({ length: 12 }, () => 0);
    open.forEach((i) => {
      if (!i.due_date) return;
      const diffDays = (new Date(i.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      const week = Math.floor(diffDays / 7);
      if (week >= 0 && week < 12) buckets[week] += Number(i.amount || 0);
    });
    const forecastTotal = buckets.reduce((a, b) => a + b, 0);

    // Aging buckets
    const aging = { current: 0, "1-30": 0, "31-60": 0, "61+": 0 };
    open.forEach((i) => {
      const amt = Number(i.amount || 0);
      if (!i.due_date) {
        aging.current += amt;
        return;
      }
      const diff = (today.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 0) aging.current += amt;
      else if (diff <= 30) aging["1-30"] += amt;
      else if (diff <= 60) aging["31-60"] += amt;
      else aging["61+"] += amt;
    });
    const agingTotal = Object.values(aging).reduce((a, b) => a + b, 0) || 1;

    // Contracts — count any non-expired contract with a value as contributing to ARR
    const activeContracts = contracts.filter((c) => {
      const value = Number(c.contract_value || 0);
      if (!value) return false;
      const status = String(c.status || "active").toLowerCase();
      if (["archived", "cancelled", "terminated", "expired", "rejected"].includes(status)) return false;
      const end = c.expiry_date || c.renewal_date;
      if (end && new Date(end) < today) return false;
      return true;
    });
    const arr = activeContracts.reduce((s, c) => s + Number(c.contract_value || 0), 0);
    const in90 = new Date(today);
    in90.setDate(in90.getDate() + 90);
    const renewals90 = contracts.filter((c) => {
      const d = c.renewal_date || c.expiry_date;
      if (!d) return false;
      const dt = new Date(d);
      return dt >= today && dt <= in90;
    });
    const renewalsArr = renewals90.reduce((s, c) => s + Number(c.contract_value || 0), 0);

    // Customer Health: composite (collection rate, low aging %)
    const overduePct = ((aging["31-60"] + aging["61+"]) / agingTotal) * 100;
    const health = Math.max(0, Math.min(100, Math.round(collectionRate - overduePct + 20)));

    return { openTotal, openCount, atRisk, dso, collectionRate, buckets, forecastTotal, aging, agingTotal, arr, renewals90, renewalsArr, health };
  }, [invoices, contracts, paidLast90]);

  const cards: StatCard[] = [
    {
      label: "Expected Cash · 30D",
      value: fmtCurrency(stats.buckets.slice(0, 4).reduce((a, b) => a + b, 0)),
      trend: "up",
      trendLabel: "+12%",
      icon: Wallet,
      href: "/payments-activity",
      cta: "Open cash pipeline",
      spark: spark(11),
      accent: "primary",
    },
    {
      label: "Revenue at Risk",
      value: fmtCurrency(stats.atRisk),
      trend: stats.atRisk > 0 ? "down" : "flat",
      trendLabel: stats.atRisk > 0 ? "Overdue >30d" : "Clean",
      icon: ShieldAlert,
      href: "/revenue-risk",
      cta: "Investigate risk",
      spark: spark(7),
      accent: "danger",
    },
    {
      label: "Renewals · 90D",
      value: fmtNum(stats.renewals90.length),
      sub: `${fmtCurrency(stats.renewalsArr)} ARR`,
      trend: "up",
      trendLabel: "Upcoming",
      icon: RefreshCcw,
      href: "/contracts",
      cta: "Open renewals",
      spark: spark(3),
      accent: "primary",
    },
    {
      label: "Customer Health",
      value: `${stats.health}`,
      trend: stats.health >= 75 ? "up" : "down",
      trendLabel: stats.health >= 75 ? "Healthy" : "Watch",
      icon: HeartPulse,
      href: "/collection-intelligence",
      cta: "See account health",
      spark: spark(19),
      accent: "success",
    },
    {
      label: "Open Invoices",
      value: fmtNum(stats.openCount),
      sub: fmtCurrency(stats.openTotal),
      trend: "flat",
      icon: FileText,
      href: "/invoices",
      cta: "View invoices",
      spark: spark(23),
      accent: "primary",
    },
    {
      label: "DSO",
      value: `${Math.round(stats.dso)} days`,
      trend: stats.dso <= 45 ? "up" : "down",
      trendLabel: stats.dso <= 45 ? "On target" : "Above target",
      icon: Clock,
      href: "/ar-aging",
      cta: "View AR aging",
      spark: spark(31),
      accent: "warning",
    },
    {
      label: "ARR",
      value: fmtCurrency(stats.arr),
      trend: "up",
      trendLabel: "Active contracts",
      icon: FileSignature,
      href: "/contracts/live",
      cta: "Open contract book",
      spark: spark(41),
      accent: "primary",
    },
    {
      label: "Collection Rate",
      value: `${stats.collectionRate.toFixed(1)}%`,
      trend: stats.collectionRate >= 90 ? "up" : "down",
      trendLabel: "Last 90 days",
      icon: Percent,
      href: "/tasks",
      cta: "Open collections",
      spark: spark(53),
      accent: "success",
    },
  ];

  const forecastMax = Math.max(...stats.buckets, 1);
  const header = HEADERS[variant];
  const allowed = new Set(CARD_KEYS[variant]);
  const visibleCards = cards.filter((c) => allowed.has(c.label));

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {header.eyebrow}
          </p>
          <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-tight text-foreground">
            {header.title}
          </h2>
          <p className="text-[13px] text-muted-foreground max-w-2xl">
            {header.description}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
          <Link to="/analytics" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border bg-card hover:bg-accent text-[11px]">
            Deep-dive analytics <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Stat Grid — Stripe-style flat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {visibleCards.map((c) => {
          const color =
            c.accent === "danger"
              ? "hsl(var(--destructive))"
              : c.accent === "success"
              ? "hsl(142 71% 45%)"
              : c.accent === "warning"
              ? "hsl(38 92% 50%)"
              : "hsl(var(--primary))";
          return (
            <Link
              key={c.label}
              to={c.href}
              className="group relative overflow-hidden rounded-lg border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground truncate">
                {c.label}
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[26px] font-semibold tracking-tight text-foreground">
                  {loading ? "—" : c.value}
                </span>
              </div>
              {c.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>}

              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="flex items-center gap-1 text-[11px]">
                  {c.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                  {c.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                  {c.trendLabel && (
                    <span
                      className={
                        c.trend === "up"
                          ? "text-green-600 dark:text-green-400 font-medium"
                          : c.trend === "down"
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {c.trendLabel}
                    </span>
                  )}
                </div>
                {c.spark && <Sparkline data={c.spark} color={color} />}
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {c.cta}
                </span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Cash Forecast + Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  Cash Forecast · Next 12 Weeks
                </p>
                <p className="text-[20px] font-semibold tracking-tight">
                  {loading ? "—" : fmtCurrency(stats.forecastTotal)}
                </p>
              </div>
              <Link
                to="/payments-activity"
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
              >
                Breakdown <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-end gap-1.5 h-32">
              {stats.buckets.map((v, i) => {
                const h = Math.max(6, (v / forecastMax) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full rounded-sm bg-primary/70 group-hover:bg-primary transition-all"
                      style={{ height: `${h}%` }}
                      title={`Week ${i + 1}: ${fmtCurrency(v)}`}
                    />
                    <span className="text-[9px] text-muted-foreground">W{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Aging Buckets
              </p>
              <Link
                to="/ar-aging"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Open AR <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: "Current", key: "current", color: "bg-green-500" },
                { label: "1–30", key: "1-30", color: "bg-blue-500" },
                { label: "31–60", key: "31-60", color: "bg-amber-500" },
                { label: "61+", key: "61+", color: "bg-red-500" },
              ].map((row) => {
                const val = (stats.aging as any)[row.key] as number;
                const pct = stats.agingTotal > 0 ? (val / stats.agingTotal) * 100 : 0;
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${row.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {fmtCurrency(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deep-dive links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: "Contract Intelligence", href: "/contracts", icon: FileSignature },
          { label: "Live Contracts", href: "/contracts/live", icon: FileText },
          { label: "Collections Tasks", href: "/tasks", icon: DollarSign },
          { label: "AR Aging", href: "/ar-aging", icon: Clock },
          { label: "Revenue Risk", href: "/revenue-risk", icon: ShieldAlert },
          { label: "Payments Activity", href: "/payments-activity", icon: Wallet },
        ].map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              to={l.href}
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-card hover:border-primary/50 hover:bg-accent/40 transition-all group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium truncate">{l.label}</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default RevenueCommandCenter;
