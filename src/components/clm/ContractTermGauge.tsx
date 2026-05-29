import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertTriangle, CheckCircle2, Clock, Receipt, Flag } from "lucide-react";
import { formatDateShort } from "@/lib/formatters";

type KeyDate = {
  id: string;
  date_type: string;
  due_date: string;
  risk_level?: string | null;
};

interface Props {
  effectiveDate?: string | null;
  termEndDate?: string | null;
  keyDates: KeyDate[];
}

const DAY_MS = 86400000;

const dateTypeMeta = (type: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes("opt") || t.includes("notice") || t.includes("cancel")) {
    return { label: "Opt-out / Notice", icon: Flag, accent: "amber" as const };
  }
  if (t.includes("renew")) {
    return { label: "Renewal", icon: AlertTriangle, accent: "amber" as const };
  }
  if (t.includes("invoice") || t.includes("bill")) {
    return { label: "Invoicing", icon: Receipt, accent: "blue" as const };
  }
  if (t.includes("end") || t.includes("expir")) {
    return { label: "Term End", icon: CalendarClock, accent: "red" as const };
  }
  if (t.includes("start") || t.includes("effective")) {
    return { label: "Term Start", icon: CheckCircle2, accent: "emerald" as const };
  }
  return { label: type.replace(/_/g, " "), icon: Clock, accent: "slate" as const };
};

const accentClasses = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

export const ContractTermGauge = ({ effectiveDate, termEndDate, keyDates }: Props) => {
  const today = new Date();
  const start = effectiveDate ? new Date(effectiveDate) : null;
  const end = termEndDate ? new Date(termEndDate) : null;

  const { pct, daysElapsed, daysRemaining, totalDays, status } = useMemo(() => {
    if (!start || !end || end <= start) {
      return { pct: 0, daysElapsed: 0, daysRemaining: 0, totalDays: 0, status: "unknown" as const };
    }
    const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    const elapsed = Math.max(0, Math.round((today.getTime() - start.getTime()) / DAY_MS));
    const remaining = Math.max(0, Math.round((end.getTime() - today.getTime()) / DAY_MS));
    const p = Math.min(100, Math.max(0, (elapsed / total) * 100));
    let s: "upcoming" | "active" | "ending_soon" | "expired" = "active";
    if (today < start) s = "upcoming";
    else if (today > end) s = "expired";
    else if (remaining <= 60) s = "ending_soon";
    return { pct: p, daysElapsed: elapsed, daysRemaining: remaining, totalDays: total, status: s };
  }, [start?.getTime(), end?.getTime(), today.getTime()]);

  const sortedDates = useMemo(() => {
    const riskRank = (r?: string | null) => {
      const v = (r || "").toLowerCase();
      if (v.includes("high") || v.includes("crit")) return 3;
      if (v.includes("med")) return 2;
      if (v.includes("low")) return 1;
      return 0;
    };
    const isTermBoundary = (t: string) => {
      const v = (t || "").toLowerCase();
      return (
        v.includes("start") ||
        v.includes("effective") ||
        v.includes("end") ||
        v.includes("expir")
      );
    };
    const seen = new Map<string, KeyDate>();
    // Authoritative term boundaries from contract props (avoid OCR drift in key_dates)
    if (effectiveDate) {
      seen.set("Term Start__" + effectiveDate.slice(0, 10), {
        id: "synthetic-term-start",
        date_type: "term_start",
        due_date: effectiveDate,
        risk_level: null,
      });
    }
    if (termEndDate) {
      seen.set("Term End__" + termEndDate.slice(0, 10), {
        id: "synthetic-term-end",
        date_type: "term_end",
        due_date: termEndDate,
        risk_level: "high",
      });
    }
    for (const d of keyDates) {
      if (!d.due_date) continue;
      // Skip OCR-extracted start/end entries; use authoritative props instead
      if (isTermBoundary(d.date_type)) continue;
      const meta = dateTypeMeta(d.date_type);
      const dayKey = new Date(d.due_date).toISOString().slice(0, 10);
      const key = `${meta.label}__${dayKey}`;
      const existing = seen.get(key);
      if (!existing || riskRank(d.risk_level) > riskRank(existing.risk_level)) {
        seen.set(key, d);
      }
    }
    const enriched = Array.from(seen.values())
      .map((d) => {
        const due = new Date(d.due_date);
        const days = Math.round((due.getTime() - today.getTime()) / DAY_MS);
        return { ...d, due, days, meta: dateTypeMeta(d.date_type) };
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const upcoming = enriched.filter((d) => d.days >= 0);
    const past = enriched.filter((d) => d.days < 0).reverse();
    return { upcoming, past, all: enriched };
  }, [keyDates, today.getTime(), effectiveDate, termEndDate]);


  // Position key dates on the gauge bar (only those within term window)
  const markers = useMemo(() => {
    if (!start || !end || end <= start) return [];
    const total = end.getTime() - start.getTime();
    return sortedDates.all
      .filter((d) => d.due >= start && d.due <= end)
      .map((d) => ({
        ...d,
        leftPct: Math.min(100, Math.max(0, ((d.due.getTime() - start.getTime()) / total) * 100)),
      }));
  }, [sortedDates.all, start?.getTime(), end?.getTime()]);

  const barColor =
    status === "expired"
      ? "bg-red-500"
      : status === "ending_soon"
        ? "bg-amber-500"
        : status === "upcoming"
          ? "bg-slate-400"
          : "bg-emerald-500";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Contract Term Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {start && end ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  {Math.round(pct)}%
                  <span className="text-sm font-normal text-muted-foreground ml-2">elapsed</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {daysElapsed.toLocaleString()} of {totalDays.toLocaleString()} days
                </div>
              </div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className={
                    status === "expired"
                      ? accentClasses.red
                      : status === "ending_soon"
                        ? accentClasses.amber
                        : status === "upcoming"
                          ? accentClasses.slate
                          : accentClasses.emerald
                  }
                >
                  {status === "expired"
                    ? "Expired"
                    : status === "ending_soon"
                      ? `Ending in ${daysRemaining}d`
                      : status === "upcoming"
                        ? "Not started"
                        : `${daysRemaining}d remaining`}
                </Badge>
              </div>
            </div>

            {/* Gauge bar with markers */}
            <div className="relative pt-6 pb-8">
              <div className="relative h-3 w-full rounded-full bg-muted overflow-visible">
                <div
                  className={`h-full rounded-full ${barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                />
                {/* Today marker */}
                {status !== "expired" && status !== "upcoming" && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                    style={{ left: `${pct}%` }}
                  >
                    <div className="w-1 h-5 bg-foreground rounded-full" />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap text-foreground">
                      Today
                    </div>
                  </div>
                )}
                {/* Date markers */}
                {markers.map((m) => (
                  <div
                    key={m.id}
                    className="absolute -top-5 -translate-x-1/2"
                    style={{ left: `${m.leftPct}%` }}
                    title={`${m.meta.label} · ${formatDateShort(m.due_date)}`}
                  >
                    <m.meta.icon
                      className={`h-3.5 w-3.5 ${
                        m.meta.accent === "amber"
                          ? "text-amber-600"
                          : m.meta.accent === "red"
                            ? "text-red-600"
                            : m.meta.accent === "blue"
                              ? "text-blue-600"
                              : "text-emerald-600"
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-3">
                <div>
                  <div className="font-semibold text-foreground">{formatDateShort(effectiveDate!)}</div>
                  <div>Term Start</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">{formatDateShort(termEndDate!)}</div>
                  <div>Term End</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add an effective date and term end date to see term progress.
          </p>
        )}

        {/* Bold key date callouts */}
        {sortedDates.all.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Key Dates
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[...sortedDates.upcoming.slice(0, 4), ...sortedDates.past.slice(0, 2)].map((d) => {
                const Icon = d.meta.icon;
                const isPast = d.days < 0;
                const isUrgent = !isPast && d.days <= 30;
                return (
                  <div
                    key={d.id}
                    className={`border-2 rounded-lg p-3 ${
                      isPast
                        ? "border-slate-200 bg-slate-50/50 opacity-70"
                        : isUrgent
                          ? "border-amber-300 bg-amber-50"
                          : accentClasses[d.meta.accent]
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${
                            isPast
                              ? "text-slate-500"
                              : isUrgent
                                ? "text-amber-600"
                                : d.meta.accent === "red"
                                  ? "text-red-600"
                                  : d.meta.accent === "blue"
                                    ? "text-blue-600"
                                    : d.meta.accent === "emerald"
                                      ? "text-emerald-600"
                                      : "text-slate-600"
                          }`}
                        />
                        <div className="font-bold text-sm uppercase tracking-tight truncate">
                          {d.meta.label}
                        </div>
                      </div>
                      {isUrgent && (
                        <Badge className="bg-amber-600 text-white text-[10px] flex-shrink-0">
                          URGENT
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 text-base font-bold">
                      {formatDateShort(d.due_date)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isPast
                        ? `${Math.abs(d.days)} day${Math.abs(d.days) === 1 ? "" : "s"} ago`
                        : d.days === 0
                          ? "Today"
                          : `In ${d.days} day${d.days === 1 ? "" : "s"}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
