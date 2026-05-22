import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

type Schedule = {
  scheduled_date?: string | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  revenue_type?: string | null;
};

interface Props {
  schedules: Schedule[];
  effectiveDate?: string | null;
  defaultCurrency?: string | null;
}

const toNum = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const revenueLabel = (t?: string | null) => {
  switch (t) {
    case "recurring": return "Recurring";
    case "non_recurring": return "One-time";
    case "prepaid_usage": return "Prepaid usage";
    case "other": return "Other";
    default: return "Unclassified";
  }
};

export function ContractValueByYearCard({ schedules, effectiveDate, defaultCurrency }: Props) {
  const { rows, currency, totalAll } = useMemo(() => {
    const currency = (schedules.find((s) => s.currency)?.currency) || defaultCurrency || "USD";
    const byYear = new Map<number, { total: number; recurring: number; oneTime: number; prepaid: number; other: number; count: number }>();

    for (const s of schedules) {
      const dateStr = s.service_period_start || s.scheduled_date;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) continue;
      const yr = d.getUTCFullYear();
      const amt = toNum(s.amount);
      if (!byYear.has(yr)) byYear.set(yr, { total: 0, recurring: 0, oneTime: 0, prepaid: 0, other: 0, count: 0 });
      const bucket = byYear.get(yr)!;
      bucket.total += amt;
      bucket.count += 1;
      switch (s.revenue_type) {
        case "recurring": bucket.recurring += amt; break;
        case "non_recurring": bucket.oneTime += amt; break;
        case "prepaid_usage": bucket.prepaid += amt; break;
        default: bucket.other += amt;
      }
    }

    const sortedYears = [...byYear.keys()].sort((a, b) => a - b);
    const rows = sortedYears.map((yr, idx) => {
      const cur = byYear.get(yr)!;
      const prev = idx > 0 ? byYear.get(sortedYears[idx - 1])! : null;
      const yoyAbs = prev ? cur.total - prev.total : 0;
      const yoyPct = prev && prev.total !== 0 ? (cur.total - prev.total) / prev.total : null;
      return { year: yr, ...cur, yoyAbs, yoyPct, prevTotal: prev?.total ?? null };
    });

    const totalAll = rows.reduce((s, r) => s + r.total, 0);
    return { rows, currency, totalAll };
  }, [schedules, defaultCurrency]);

  if (rows.length === 0) return null;

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Contract Value by Year
            </CardTitle>
            <CardDescription>
              Annual breakdown from the invoice schedule — highlights ramps, step-ups, and YoY changes.
              {effectiveDate && <> Effective {new Date(effectiveDate).toLocaleDateString()}.</>}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Lifetime scheduled</div>
            <div className="text-base font-semibold">{formatCurrency(totalAll, currency)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini visualization */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
          {rows.map((r) => {
            const h = Math.max(8, Math.round((r.total / maxTotal) * 80));
            const isRamp = r.yoyPct !== null && r.yoyPct > 0.02;
            const isDrop = r.yoyPct !== null && r.yoyPct < -0.02;
            return (
              <div key={r.year} className="flex flex-col items-center gap-1">
                <div className="w-full flex items-end h-[88px]">
                  <div
                    className={`w-full rounded-t-sm ${isRamp ? "bg-emerald-500/80" : isDrop ? "bg-red-400/80" : "bg-primary/70"}`}
                    style={{ height: `${h}px` }}
                    title={`${r.year}: ${formatCurrency(r.total, currency)}`}
                  />
                </div>
                <div className="text-[11px] font-medium">{r.year}</div>
                <div className="text-[10px] text-muted-foreground">{formatCurrency(r.total, currency)}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Recurring</TableHead>
                <TableHead className="text-right">One-time</TableHead>
                <TableHead className="text-right">Prepaid</TableHead>
                <TableHead className="text-right">YoY change</TableHead>
                <TableHead className="text-right"># Lines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const Icon = r.yoyPct === null ? Minus : r.yoyPct > 0.001 ? TrendingUp : r.yoyPct < -0.001 ? TrendingDown : Minus;
                const tone = r.yoyPct === null ? "secondary" : r.yoyPct > 0.001 ? "default" : r.yoyPct < -0.001 ? "destructive" : "secondary";
                return (
                  <TableRow key={r.year}>
                    <TableCell className="font-medium">{r.year}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.total, currency)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(r.recurring, currency)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(r.oneTime, currency)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(r.prepaid, currency)}</TableCell>
                    <TableCell className="text-right">
                      {r.yoyPct === null ? (
                        <span className="text-xs text-muted-foreground">Baseline</span>
                      ) : (
                        <Badge variant={tone as any} className="gap-1 font-medium">
                          <Icon className="h-3 w-3" />
                          {(r.yoyPct * 100).toFixed(1)}%
                          <span className="opacity-75 ml-1">
                            ({r.yoyAbs >= 0 ? "+" : ""}{formatCurrency(r.yoyAbs, currency)})
                          </span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{r.count}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {rows.length >= 2 && (() => {
          const ramps = rows.filter((r) => r.yoyPct !== null && Math.abs(r.yoyPct) >= 0.05);
          if (ramps.length === 0) return (
            <p className="text-xs text-muted-foreground">No material year-over-year ramps detected (changes &lt; 5%).</p>
          );
          return (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-3 text-xs space-y-1">
              <div className="font-medium flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Year-over-year changes detected
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {ramps.map((r) => (
                  <li key={r.year}>
                    <strong>{r.year}:</strong>{" "}
                    {r.yoyPct! > 0 ? "ramp-up" : "step-down"} of{" "}
                    {(r.yoyPct! * 100).toFixed(1)}%{" "}
                    ({r.yoyAbs >= 0 ? "+" : ""}{formatCurrency(r.yoyAbs, currency)}) vs {r.year - 1}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export default ContractValueByYearCard;
