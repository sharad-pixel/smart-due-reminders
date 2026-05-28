import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, BarChart3, CalendarRange } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

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
  termEndDate?: string | null;
  defaultCurrency?: string | null;
}

const toNum = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Add N years preserving month/day (handles Feb 29 → Feb 28)
const addYears = (d: Date, n: number) => {
  const r = new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate()));
  return r;
};

export function ContractValueByYearCard({ schedules, effectiveDate, termEndDate, defaultCurrency }: Props) {
  const { rows, currency, totalAll, anchor, hasAnchor } = useMemo(() => {
    const currency = (schedules.find((s) => s.currency)?.currency) || defaultCurrency || "USD";

    // Anchor: effectiveDate → fallback to earliest schedule date
    let anchorDate: Date | null = effectiveDate ? new Date(effectiveDate) : null;
    if (!anchorDate || Number.isNaN(anchorDate.getTime())) {
      const dates = schedules
        .map((s) => s.service_period_start || s.scheduled_date)
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime())
        .filter((t) => !Number.isNaN(t));
      anchorDate = dates.length ? new Date(Math.min(...dates)) : null;
    }
    const hasAnchor = !!anchorDate;
    if (!anchorDate) return { rows: [], currency, totalAll: 0, anchor: null, hasAnchor: false };

    // Determine number of term years to cover
    const lastDate = (() => {
      const candidates: number[] = [];
      if (termEndDate) {
        const t = new Date(termEndDate).getTime();
        if (!Number.isNaN(t)) candidates.push(t);
      }
      for (const s of schedules) {
        const d = s.service_period_end || s.service_period_start || s.scheduled_date;
        if (!d) continue;
        const t = new Date(d).getTime();
        if (!Number.isNaN(t)) candidates.push(t);
      }
      return candidates.length ? new Date(Math.max(...candidates)) : anchorDate!;
    })();

    const totalDays = Math.max(1, (lastDate.getTime() - anchorDate.getTime()) / 86400000);
    const numYears = Math.max(1, Math.ceil(totalDays / 365.25));

    // Build term-year buckets
    type Bucket = { idx: number; start: Date; end: Date; total: number; recurring: number; oneTime: number; prepaid: number; other: number; count: number };
    const buckets: Bucket[] = [];
    for (let i = 0; i < numYears; i++) {
      const start = addYears(anchorDate, i);
      const endNext = addYears(anchorDate, i + 1);
      const end = new Date(endNext.getTime() - 86400000); // inclusive last day
      buckets.push({ idx: i + 1, start, end, total: 0, recurring: 0, oneTime: 0, prepaid: 0, other: 0, count: 0 });
    }

    const findBucket = (d: Date) => {
      const t = d.getTime();
      for (const b of buckets) {
        if (t >= b.start.getTime() && t <= b.end.getTime() + 86400000 - 1) return b;
      }
      // Anything before first or after last → clamp
      if (t < buckets[0].start.getTime()) return buckets[0];
      return buckets[buckets.length - 1];
    };

    for (const s of schedules) {
      const dateStr = s.service_period_start || s.scheduled_date;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) continue;
      const amt = toNum(s.amount);
      const bucket = findBucket(d);
      bucket.total += amt;
      bucket.count += 1;
      switch (s.revenue_type) {
        case "recurring": bucket.recurring += amt; break;
        case "non_recurring": bucket.oneTime += amt; break;
        case "prepaid_usage": bucket.prepaid += amt; break;
        default: bucket.other += amt;
      }
    }

    const rows = buckets.map((b, idx) => {
      const prev = idx > 0 ? buckets[idx - 1] : null;
      const yoyAbs = prev ? b.total - prev.total : 0;
      const yoyPct = prev && prev.total !== 0 ? (b.total - prev.total) / prev.total : null;
      return { ...b, yoyAbs, yoyPct };
    });

    const totalAll = rows.reduce((s, r) => s + r.total, 0);
    return { rows, currency, totalAll, anchor: anchorDate, hasAnchor };
  }, [schedules, effectiveDate, termEndDate, defaultCurrency]);

  if (!hasAnchor || rows.length === 0) return null;

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Contract Value by Term Year
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 flex-wrap">
              <CalendarRange className="h-3.5 w-3.5" />
              Term-year buckets anchored to the contract effective date — not calendar years.
              {anchor && (
                <span className="ml-1">
                  Effective <strong>{formatDateShort(anchor.toISOString())}</strong>
                  {termEndDate && <> · ends <strong>{formatDateShort(termEndDate)}</strong></>}
                </span>
              )}
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
            const pct = totalAll > 0 ? (r.total / totalAll) * 100 : 0;
            return (
              <div key={r.idx} className="flex flex-col items-center gap-1">
                <div className="w-full flex items-end h-[88px]">
                  <div
                    className={`w-full rounded-t-sm ${isRamp ? "bg-emerald-500/80" : isDrop ? "bg-red-400/80" : "bg-primary/70"}`}
                    style={{ height: `${h}px` }}
                    title={`Year ${r.idx}: ${formatCurrency(r.total, currency)}`}
                  />
                </div>
                <div className="text-[11px] font-medium">Year {r.idx}</div>
                <div className="text-[10px] text-muted-foreground">{formatCurrency(r.total, currency)}</div>
                <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% of TCV</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term Year</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Allocation</TableHead>
                <TableHead className="text-right">% of TCV</TableHead>
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
                const pct = totalAll > 0 ? (r.total / totalAll) * 100 : 0;
                return (
                  <TableRow key={r.idx}>
                    <TableCell className="font-medium whitespace-nowrap">Year {r.idx}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateShort(r.start.toISOString())} → {formatDateShort(r.end.toISOString())}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.total, currency)}</TableCell>
                    <TableCell className="text-right text-sm">{pct.toFixed(1)}%</TableCell>
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
                <TrendingUp className="h-3.5 w-3.5" /> Term-year changes detected
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {ramps.map((r) => (
                  <li key={r.idx}>
                    <strong>Year {r.idx}</strong> ({formatDateShort(r.start.toISOString())} → {formatDateShort(r.end.toISOString())}):{" "}
                    {r.yoyPct! > 0 ? "ramp-up" : "step-down"} of{" "}
                    {(r.yoyPct! * 100).toFixed(1)}%{" "}
                    ({r.yoyAbs >= 0 ? "+" : ""}{formatCurrency(r.yoyAbs, currency)}) vs Year {r.idx - 1}
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
