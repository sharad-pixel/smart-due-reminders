import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Repeat, Wrench, Zap, CircleDot, ShieldCheck } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

interface Schedule {
  id: string;
  scheduled_date: string;
  amount: number | string | null;
  currency?: string | null;
  description?: string | null;
  product_description?: string | null;
  product_category?: string | null;
  revenue_type?: string | null;
  billing_type?: string | null;
  service_start_date?: string | null;
  service_end_date?: string | null;
}

interface Props {
  schedules: Schedule[];
  effectiveDate?: string | null;
  termEndDate?: string | null;
  defaultCurrency?: string;
}

type RevBucket = "recurring" | "professional_services" | "usage" | "one_time";

const DAY = 86400000;

const classify = (s: Schedule): RevBucket => {
  const t = (s.revenue_type || "").toLowerCase();
  const c = (s.product_category || "").toLowerCase();
  if (t.includes("usage") || t.includes("consumption") || c.includes("usage")) return "usage";
  if (t.includes("recurring") || t.includes("subscription") || c.includes("subscription") || c.includes("platform") || c.includes("license"))
    return "recurring";
  if (
    t.includes("professional") ||
    c.includes("professional") ||
    c.includes("implementation") ||
    c.includes("onboarding") ||
    c.includes("training")
  )
    return "professional_services";
  return "one_time";
};

const bucketMeta: Record<RevBucket, { label: string; method: string; icon: any; tone: string }> = {
  recurring: {
    label: "Recurring / Subscription",
    method: "Ratable over service term (ASC 606 §606-10-25-27)",
    icon: Repeat,
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  professional_services: {
    label: "Professional Services",
    method: "Over delivery period, straight-line (input method)",
    icon: Wrench,
    tone: "bg-purple-50 text-purple-700 border-purple-200",
  },
  usage: {
    label: "Consumption / Usage",
    method: "Recognized as consumed (variable consideration)",
    icon: Zap,
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
  one_time: {
    label: "One-Time / Point-in-Time",
    method: "Point-in-time on delivery date",
    icon: CircleDot,
    tone: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

interface RecognitionRow {
  line: Schedule;
  bucket: RevBucket;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  months: number;
  monthly: number;
  recognizedToDate: number;
  deferred: number;
  method: string;
}

const monthsBetween = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(1, m + (e.getDate() >= s.getDate() ? 0 : 0) + (m === 0 ? 1 : 0));
};

const computeRow = (
  line: Schedule,
  bucket: RevBucket,
  effectiveDate?: string | null,
  termEndDate?: string | null,
): RecognitionRow => {
  const amount = Number(line.amount) || 0;
  const today = new Date().toISOString().slice(0, 10);
  const meta = bucketMeta[bucket];

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let months = 1;
  let monthly = amount;
  let recognizedToDate = 0;
  let deferred = amount;

  if (bucket === "recurring") {
    periodStart = line.service_start_date || effectiveDate || line.scheduled_date;
    periodEnd = line.service_end_date || termEndDate || null;
    if (periodStart && periodEnd && periodEnd > periodStart) {
      months = monthsBetween(periodStart, periodEnd);
      monthly = amount / months;
      const totalMs = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
      const elapsedMs = Math.min(
        Math.max(0, new Date(today).getTime() - new Date(periodStart).getTime()),
        totalMs,
      );
      const pct = totalMs > 0 ? elapsedMs / totalMs : 0;
      recognizedToDate = amount * pct;
      deferred = amount - recognizedToDate;
    }
  } else if (bucket === "professional_services") {
    periodStart = line.service_start_date || line.scheduled_date;
    periodEnd = line.service_end_date || null;
    if (periodStart && periodEnd && periodEnd > periodStart) {
      months = monthsBetween(periodStart, periodEnd);
      monthly = amount / months;
      const totalMs = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
      const elapsedMs = Math.min(
        Math.max(0, new Date(today).getTime() - new Date(periodStart).getTime()),
        totalMs,
      );
      const pct = totalMs > 0 ? elapsedMs / totalMs : 0;
      recognizedToDate = amount * pct;
      deferred = amount - recognizedToDate;
    } else {
      // point-in-time on scheduled_date if no service window
      periodStart = line.scheduled_date;
      periodEnd = line.scheduled_date;
      recognizedToDate = line.scheduled_date && line.scheduled_date <= today ? amount : 0;
      deferred = amount - recognizedToDate;
    }
  } else if (bucket === "usage") {
    periodStart = line.service_start_date || line.scheduled_date;
    periodEnd = line.service_end_date || termEndDate || null;
    // Variable — cannot recognize until consumed; show 0 recognized, amount as variable
    recognizedToDate = 0;
    deferred = amount;
    monthly = amount && periodStart && periodEnd ? amount / monthsBetween(periodStart, periodEnd) : amount;
  } else {
    // one_time
    periodStart = line.scheduled_date;
    periodEnd = line.scheduled_date;
    recognizedToDate = line.scheduled_date && line.scheduled_date <= today ? amount : 0;
    deferred = amount - recognizedToDate;
  }

  return {
    line,
    bucket,
    amount,
    periodStart,
    periodEnd,
    months,
    monthly,
    recognizedToDate,
    deferred,
    method: meta.method,
  };
};

export const ContractRevRecASC606 = ({
  schedules,
  effectiveDate,
  termEndDate,
  defaultCurrency = "USD",
}: Props) => {
  // Per-line overrides for non-recurring rows.
  // method: "auto" (default calc) | "point_in_time" (book full amount now) | "custom" (user-entered)
  type Override = { method: "auto" | "point_in_time" | "custom"; custom?: number };
  const storageKey = useMemo(() => {
    const first = (schedules || [])[0]?.id || "none";
    return `revrec-overrides:${first}`;
  }, [schedules]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setOverrides(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  const setOverride = (id: string, next: Override) => {
    setOverrides((prev) => {
      const merged = { ...prev, [id]: next };
      try {
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  };

  const baseRows = useMemo(
    () =>
      (schedules || [])
        .filter((s) => Number(s.amount) > 0)
        .map((s) => computeRow(s, classify(s), effectiveDate, termEndDate))
        .sort((a, b) => (a.line.scheduled_date || "").localeCompare(b.line.scheduled_date || "")),
    [schedules, effectiveDate, termEndDate],
  );

  // Apply overrides on top of computed rows (recurring rows ignore overrides)
  const rows = useMemo(() => {
    return baseRows.map((r) => {
      if (r.bucket === "recurring") return r;
      const o = overrides[r.line.id];
      if (!o || o.method === "auto") return r;
      if (o.method === "point_in_time") {
        return { ...r, recognizedToDate: r.amount, deferred: 0 };
      }
      if (o.method === "custom") {
        const c = Math.max(0, Math.min(r.amount, Number(o.custom) || 0));
        return { ...r, recognizedToDate: c, deferred: r.amount - c };
      }
      return r;
    });
  }, [baseRows, overrides]);

  const grouped = useMemo(() => {
    const g: Record<RevBucket, RecognitionRow[]> = {
      recurring: [],
      professional_services: [],
      usage: [],
      one_time: [],
    };
    rows.forEach((r) => g[r.bucket].push(r));
    return g;
  }, [rows]);

  const totals = useMemo(() => {
    const sum = (arr: RecognitionRow[]) => ({
      amount: arr.reduce((a, r) => a + r.amount, 0),
      recognized: arr.reduce((a, r) => a + r.recognizedToDate, 0),
      deferred: arr.reduce((a, r) => a + r.deferred, 0),
    });
    return {
      recurring: sum(grouped.recurring),
      professional_services: sum(grouped.professional_services),
      usage: sum(grouped.usage),
      one_time: sum(grouped.one_time),
      all: sum(rows),
    };
  }, [grouped, rows]);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Revenue Recognition (ASC 606)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No priced schedule lines yet. Once Order Form lines are extracted, ASC 606 recognition by
            line item and revenue type will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> Revenue Recognition (ASC 606)
          <Badge variant="outline" className="ml-2 text-[10px]">
            By line item · By revenue type
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(bucketMeta) as RevBucket[]).map((b) => {
            const Icon = bucketMeta[b].icon;
            const t = totals[b];
            return (
              <div key={b} className={`rounded-lg border p-3 ${bucketMeta[b].tone}`}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                  <Icon className="h-3.5 w-3.5" />
                  {bucketMeta[b].label}
                </div>
                <div className="mt-1.5 text-lg font-semibold">
                  {formatCurrency(t.amount, defaultCurrency)}
                </div>
                <div className="text-[11px] mt-0.5 opacity-80">
                  Recognized: {formatCurrency(t.recognized, defaultCurrency)} · Deferred:{" "}
                  {formatCurrency(t.deferred, defaultCurrency)}
                </div>
              </div>
            );
          })}
        </div>

        {(Object.keys(grouped) as RevBucket[])
          .filter((b) => grouped[b].length > 0)
          .map((b) => {
            const meta = bucketMeta[b];
            const Icon = meta.icon;
            const editable = b !== "recurring";
            return (
              <div key={b} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <h4 className="text-sm font-semibold">{meta.label}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {grouped[b].length} line{grouped[b].length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground italic">{meta.method}</div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Line Item</TableHead>
                        <TableHead>Service Period</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {editable && <TableHead className="w-[220px]">Recognition Policy</TableHead>}
                        {!editable && <TableHead className="text-right">Monthly</TableHead>}
                        <TableHead className="text-right">Recognized</TableHead>
                        <TableHead className="text-right">Deferred</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped[b].map((r) => {
                        const o = overrides[r.line.id] || { method: "auto" as const };
                        return (
                          <TableRow key={r.line.id}>
                            <TableCell className="text-xs">
                              <div className="font-medium">
                                {r.line.description || r.line.product_description || "Untitled line"}
                              </div>
                              {r.line.product_category && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {r.line.product_category.replace(/_/g, " ")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.periodStart && r.periodEnd ? (
                                r.periodStart === r.periodEnd ? (
                                  formatDateShort(r.periodStart)
                                ) : (
                                  <>
                                    {formatDateShort(r.periodStart)} → {formatDateShort(r.periodEnd)}
                                    <div className="text-[10px] opacity-70">{r.months} mo</div>
                                  </>
                                )
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">
                              {formatCurrency(r.amount, r.line.currency || defaultCurrency)}
                            </TableCell>
                            {editable ? (
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Select
                                    value={o.method}
                                    onValueChange={(v) =>
                                      setOverride(r.line.id, {
                                        method: v as Override["method"],
                                        custom: o.custom,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-[11px] w-[130px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="auto" className="text-xs">Auto (default)</SelectItem>
                                      <SelectItem value="point_in_time" className="text-xs">Book as one-time</SelectItem>
                                      <SelectItem value="custom" className="text-xs">Custom amount</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {o.method === "custom" && (
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      className="h-7 text-[11px] w-[90px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder="0.00"
                                      value={o.custom ?? ""}
                                      onChange={(e) =>
                                        setOverride(r.line.id, {
                                          method: "custom",
                                          custom: e.target.value === "" ? undefined : Number(e.target.value),
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              </TableCell>
                            ) : (
                              <TableCell className="text-right text-xs">
                                {formatCurrency(r.monthly, r.line.currency || defaultCurrency)}
                              </TableCell>
                            )}
                            <TableCell className="text-right text-xs text-emerald-700">
                              {formatCurrency(r.recognizedToDate, r.line.currency || defaultCurrency)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-amber-700">
                              {formatCurrency(r.deferred, r.line.currency || defaultCurrency)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}

        <div className="rounded-md border bg-muted/40 p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">Contract totals</strong> · TCV{" "}
            {formatCurrency(totals.all.amount, defaultCurrency)}
          </div>
          <div className="text-xs">
            <span className="text-emerald-700 font-medium">
              Recognized to date: {formatCurrency(totals.all.recognized, defaultCurrency)}
            </span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-amber-700 font-medium">
              Deferred: {formatCurrency(totals.all.deferred, defaultCurrency)}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <ShieldCheck className="h-3.5 w-3.5" /> ASC 606 Best Practice
          </div>
          <p className="text-[11px] leading-relaxed text-blue-900/90">
            Under ASC 606, revenue is recognized when control of the good or service transfers to the
            customer. Apply the five-step model per performance obligation: (1) identify the contract,
            (2) identify performance obligations, (3) determine transaction price, (4) allocate price
            to obligations, (5) recognize revenue when (or as) each obligation is satisfied.
          </p>
          <ul className="text-[11px] leading-relaxed text-blue-900/90 list-disc pl-4 space-y-0.5">
            <li>
              <strong>Recurring / SaaS:</strong> recognize ratably (straight-line) over the service term — a series of
              distinct services satisfied over time (§606-10-25-27(a)).
            </li>
            <li>
              <strong>Professional Services:</strong> if distinct and delivered over a period, recognize over that
              period using an input method; if the service is a discrete deliverable, recognize at
              point-in-time on acceptance.
            </li>
            <li>
              <strong>One-time fees (setup, activation, license grants):</strong> book point-in-time when control
              transfers. Non-refundable upfront fees not tied to a distinct good/service should be
              deferred over the expected customer life.
            </li>
            <li>
              <strong>Consumption / Usage:</strong> variable consideration — recognize as usage occurs; do not
              accelerate unless a minimum commitment is fixed.
            </li>
            <li>
              Document your judgment for any override in the contract file. Any deviation from
              straight-line for a service-over-time obligation requires a rationale for audit.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
