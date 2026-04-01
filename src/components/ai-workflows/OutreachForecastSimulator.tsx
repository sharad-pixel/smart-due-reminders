import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInDays, addDays } from "date-fns";
import { CalendarIcon, Eye, ChevronDown, ChevronUp, Mail, Clock, ChevronLeft, ChevronRight, ExternalLink, Building2, FileText, Filter } from "lucide-react";
import { personaConfig } from "@/lib/personaConfig";
import { PersonaAvatar } from "@/components/ai/PersonaAvatar";
import { cn } from "@/lib/utils";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

interface ForecastInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding: number;
  due_date: string;
  status: string;
  aging_bucket: string;
  bucket_entered_at: string | null;
  debtor_id: string;
  debtors: {
    id: string;
    name: string;
    company_name: string | null;
  };
}

interface BucketForecast {
  bucket: string;
  label: string;
  persona: string | null;
  invoices: ForecastRow[];
  totalAmount: number;
  count: number;
}

interface ForecastRow extends ForecastInvoice {
  forecast_dpd: number;
  planned_steps: PlannedStep[];
  outreach_category: "workflow" | "account_level" | "proactive" | "none";
}

interface PlannedStep {
  label: string;
  channel: string;
  day_offset: number;
  scheduled_date: string;
  status: "completed" | "upcoming" | "future";
}

const BUCKET_CONFIG = [
  { value: "current", label: "Current (0 days)", min: -Infinity, max: 0 },
  { value: "dpd_1_30", label: "1–30 DPD", min: 1, max: 30 },
  { value: "dpd_31_60", label: "31–60 DPD", min: 31, max: 60 },
  { value: "dpd_61_90", label: "61–90 DPD", min: 61, max: 90 },
  { value: "dpd_91_120", label: "91–120 DPD", min: 91, max: 120 },
  { value: "dpd_121_150", label: "121–150 DPD", min: 121, max: 150 },
  { value: "dpd_150_plus", label: "150+ DPD", min: 151, max: Infinity },
];

const PERSONA_MAP: Record<string, string> = {
  dpd_1_30: "sam",
  dpd_31_60: "james",
  dpd_61_90: "katy",
  dpd_91_120: "troy",
  dpd_121_150: "jimmy",
  dpd_150_plus: "rocco",
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "workflow", label: "Workflow" },
  { value: "account_level", label: "Account Level" },
  { value: "proactive", label: "Proactive" },
  { value: "none", label: "No Outreach" },
];

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  workflow: { label: "Workflow", className: "bg-blue-500/10 text-blue-600 border-blue-200" },
  account_level: { label: "Account Level", className: "bg-violet-500/10 text-violet-600 border-violet-200" },
  proactive: { label: "Proactive", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  none: { label: "No Outreach", className: "bg-muted text-muted-foreground border-border" },
};

const PAGE_SIZE = 25;

function getBucketForDPD(dpd: number): string {
  if (dpd <= 0) return "current";
  if (dpd <= 30) return "dpd_1_30";
  if (dpd <= 60) return "dpd_31_60";
  if (dpd <= 90) return "dpd_61_90";
  if (dpd <= 120) return "dpd_91_120";
  if (dpd <= 150) return "dpd_121_150";
  return "dpd_150_plus";
}

export function OutreachForecastSimulator() {
  const { effectiveAccountId } = useEffectiveAccount();
  const navigate = useNavigate();
  const [forecastDate, setForecastDate] = useState<Date>(addDays(new Date(), 30));
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bucketPages, setBucketPages] = useState<Record<string, number>>({});

  // Fetch open invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["forecast-invoices", effectiveAccountId],
    enabled: !!effectiveAccountId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, amount, amount_outstanding, due_date, status, aging_bucket, bucket_entered_at, debtor_id,
          debtors!inner(id, name, company_name)
        `)
        .eq("user_id", effectiveAccountId!)
        .in("status", ["Open", "InPaymentPlan", "PartiallyPaid"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as unknown as ForecastInvoice[];
    },
  });

  // Fetch workflow steps
  const { data: workflowSteps } = useQuery({
    queryKey: ["forecast-workflow-steps", effectiveAccountId],
    enabled: !!effectiveAccountId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_workflows")
        .select(`
          id, aging_bucket, is_active,
          collection_workflow_steps(id, label, step_order, day_offset, channel, is_active)
        `)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch account-level outreach debtors (to tag category)
  const { data: accountOutreachDebtors } = useQuery({
    queryKey: ["forecast-account-outreach", effectiveAccountId],
    enabled: !!effectiveAccountId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_activities")
        .select("debtor_id, activity_type")
        .eq("user_id", effectiveAccountId!)
        .eq("activity_type", "account_level_outreach")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Set((data || []).map((d) => d.debtor_id));
    },
  });

  // Fetch proactive draft debtors
  const { data: proactiveDebtors } = useQuery({
    queryKey: ["forecast-proactive", effectiveAccountId],
    enabled: !!effectiveAccountId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_logs")
        .select("invoice_id, delivery_metadata")
        .eq("user_id", effectiveAccountId!)
        .limit(500);
      if (error) throw error;
      const proactiveInvoiceIds = new Set<string>();
      (data || []).forEach((log: any) => {
        const meta = log.delivery_metadata;
        if (meta && typeof meta === "object" && (meta as any).outreach_category === "proactive" && log.invoice_id) {
          proactiveInvoiceIds.add(log.invoice_id);
        }
      });
      return proactiveInvoiceIds;
    },
  });

  // Build forecast
  const forecast = useMemo(() => {
    if (!invoices) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(forecastDate);
    target.setHours(0, 0, 0, 0);

    const stepsByBucket: Record<string, { label: string; day_offset: number; channel: string }[]> = {};
    workflowSteps?.forEach((wf: any) => {
      if (!wf.is_active) return;
      const steps = (wf.collection_workflow_steps || [])
        .filter((s: any) => s.is_active !== false)
        .sort((a: any, b: any) => a.step_order - b.step_order)
        .map((s: any) => ({ label: s.label, day_offset: s.day_offset, channel: s.channel }));
      stepsByBucket[wf.aging_bucket] = steps;
    });

    const bucketMap: Record<string, BucketForecast> = {};
    BUCKET_CONFIG.forEach((b) => {
      bucketMap[b.value] = {
        bucket: b.value,
        label: b.label,
        persona: PERSONA_MAP[b.value] || null,
        invoices: [],
        totalAmount: 0,
        count: 0,
      };
    });

    invoices.forEach((inv) => {
      const dueDate = new Date(inv.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const forecastDPD = Math.max(0, differenceInDays(target, dueDate));
      const currentDPD = Math.max(0, differenceInDays(today, dueDate));
      const futureBucket = getBucketForDPD(forecastDPD);

      // Planned outreach steps
      const plannedSteps: PlannedStep[] = [];

      if (futureBucket !== "current" && stepsByBucket[futureBucket]) {
        stepsByBucket[futureBucket].forEach((step) => {
          const bucketConfig = BUCKET_CONFIG.find((b) => b.value === futureBucket);
          if (!bucketConfig) return;
          const bucketEntryDate = addDays(dueDate, bucketConfig.min);
          const stepDate = addDays(bucketEntryDate, step.day_offset);
          let status: PlannedStep["status"] = "future";
          if (stepDate <= today) status = "completed";
          else if (stepDate <= target) status = "upcoming";
          plannedSteps.push({ label: step.label, channel: step.channel, day_offset: step.day_offset, scheduled_date: format(stepDate, "MMM d, yyyy"), status });
        });
      }

      BUCKET_CONFIG.forEach((bc) => {
        if (bc.value === "current" || bc.value === futureBucket) return;
        if (bc.min > currentDPD && bc.min <= forecastDPD && stepsByBucket[bc.value]) {
          stepsByBucket[bc.value].forEach((step) => {
            const bucketEntryDate = addDays(dueDate, bc.min);
            const stepDate = addDays(bucketEntryDate, step.day_offset);
            let status: PlannedStep["status"] = "future";
            if (stepDate <= today) status = "completed";
            else if (stepDate <= target) status = "upcoming";
            plannedSteps.push({ label: step.label, channel: step.channel, day_offset: step.day_offset, scheduled_date: format(stepDate, "MMM d, yyyy"), status });
          });
        }
      });

      plannedSteps.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

      // Determine outreach category
      let outreach_category: ForecastRow["outreach_category"] = "none";
      if (accountOutreachDebtors?.has(inv.debtor_id)) {
        outreach_category = "account_level";
      } else if (proactiveDebtors?.has(inv.id)) {
        outreach_category = "proactive";
      } else if (plannedSteps.length > 0) {
        outreach_category = "workflow";
      }

      const row: ForecastRow = { ...inv, forecast_dpd: forecastDPD, planned_steps: plannedSteps, outreach_category };

      bucketMap[futureBucket].invoices.push(row);
      bucketMap[futureBucket].totalAmount += Number(inv.amount_outstanding || inv.amount || 0);
      bucketMap[futureBucket].count++;
    });

    return Object.values(bucketMap).filter((b) => b.count > 0);
  }, [invoices, forecastDate, workflowSteps, accountOutreachDebtors, proactiveDebtors]);

  const totalForecast = forecast.reduce((s, b) => s + b.totalAmount, 0);
  const totalInvoices = forecast.reduce((s, b) => s + b.count, 0);

  const toggleBucket = (bucket: string) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      next.has(bucket) ? next.delete(bucket) : next.add(bucket);
      return next;
    });
  };

  const getPageForBucket = (bucket: string) => bucketPages[bucket] || 1;
  const setPageForBucket = (bucket: string, page: number) => setBucketPages((p) => ({ ...p, [bucket]: page }));

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Outreach Forecast Simulator
            </CardTitle>
            <CardDescription>
              Project invoice aging &amp; planned outreach on a future date
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setBucketPages({}); }}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <CalendarIcon className="h-4 w-4" />
                  {format(forecastDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={forecastDate}
                  onSelect={(d) => d && setForecastDate(d)}
                  disabled={(d) => d <= new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Forecast Date" value={format(forecastDate, "MMM d")} sub={`${differenceInDays(forecastDate, new Date())} days out`} />
          <SummaryCard label="Open Invoices" value={totalInvoices.toString()} sub="projected still open" />
          <SummaryCard label="Total Outstanding" value={`$${totalForecast.toLocaleString()}`} sub="at risk" />
          <SummaryCard label="Buckets Active" value={forecast.length.toString()} sub="with invoices" />
        </div>

        {loadingInvoices ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            Loading forecast...
          </div>
        ) : forecast.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No open invoices found.</p>
        ) : (
          <div className="space-y-2">
            {forecast.map((bucket) => {
              const persona = bucket.persona ? personaConfig[bucket.persona] : null;
              const isExpanded = expandedBuckets.has(bucket.bucket);
              const upcomingSteps = bucket.invoices.reduce(
                (sum, inv) => sum + inv.planned_steps.filter((s) => s.status === "upcoming").length, 0
              );

              // Apply category filter
              const filteredInvoices = categoryFilter === "all"
                ? bucket.invoices
                : bucket.invoices.filter((inv) => inv.outreach_category === categoryFilter);

              const page = getPageForBucket(bucket.bucket);
              const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
              const paginated = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

              if (categoryFilter !== "all" && filteredInvoices.length === 0) return null;

              return (
                <div key={bucket.bucket} className="border rounded-lg overflow-hidden">
                  {/* Bucket Header */}
                  <button
                    onClick={() => toggleBucket(bucket.bucket)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    {persona && <PersonaAvatar persona={bucket.persona!} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{bucket.label}</span>
                        {persona && (
                          <Badge variant="outline" className="text-xs" style={{ borderColor: persona.color, color: persona.color }}>
                            {persona.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
                        <span>${Math.round(bucket.totalAmount).toLocaleString()}</span>
                        {upcomingSteps > 0 && (
                          <span className="flex items-center gap-1 text-primary">
                            <Mail className="h-3 w-3" />
                            {upcomingSteps} outreach planned
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded Invoice List */}
                  {isExpanded && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Invoice</TableHead>
                            <TableHead className="text-xs">Account</TableHead>
                            <TableHead className="text-xs">Category</TableHead>
                            <TableHead className="text-xs text-right">Outstanding</TableHead>
                            <TableHead className="text-xs text-right">DPD</TableHead>
                            <TableHead className="text-xs">Planned Outreach</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginated.map((inv) => {
                            const catBadge = CATEGORY_BADGE[inv.outreach_category];
                            return (
                              <TableRow key={inv.id} className="group">
                                {/* Invoice link */}
                                <TableCell className="text-xs">
                                  <button
                                    onClick={() => navigate(`/invoices/${inv.id}`)}
                                    className="flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
                                  >
                                    <FileText className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                                    {inv.invoice_number || inv.id.slice(0, 8)}
                                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                </TableCell>
                                {/* Account link */}
                                <TableCell className="text-xs">
                                  <button
                                    onClick={() => navigate(`/debtors/${inv.debtor_id}`)}
                                    className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    <span className="truncate max-w-[120px]">
                                      {inv.debtors?.company_name || inv.debtors?.name || "—"}
                                    </span>
                                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                </TableCell>
                                {/* Outreach Category */}
                                <TableCell>
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", catBadge.className)}>
                                    {catBadge.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium">
                                  ${Number(inv.amount_outstanding || inv.amount || 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-xs text-right">
                                  <Badge variant="secondary" className="text-xs">{inv.forecast_dpd}d</Badge>
                                </TableCell>
                                <TableCell>
                                  {inv.planned_steps.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {inv.planned_steps.slice(0, 3).map((step, i) => (
                                        <span
                                          key={i}
                                          className={cn(
                                            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border",
                                            step.status === "completed"
                                              ? "bg-muted text-muted-foreground line-through"
                                              : step.status === "upcoming"
                                                ? "bg-primary/10 text-primary border-primary/20"
                                                : "bg-muted/50 text-muted-foreground border-dashed"
                                          )}
                                          title={`${step.label} — ${step.scheduled_date}`}
                                        >
                                          {step.channel === "email" ? <Mail className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                                          {step.scheduled_date}
                                        </span>
                                      ))}
                                      {inv.planned_steps.length > 3 && (
                                        <span className="text-[10px] text-muted-foreground">+{inv.planned_steps.length - 3}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      {/* Pagination */}
                      {filteredInvoices.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
                          <span className="text-xs text-muted-foreground">
                            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={page <= 1}
                              onClick={() => setPageForBucket(bucket.bucket, page - 1)}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs text-muted-foreground px-1">
                              {page}/{totalPages}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={page >= totalPages}
                              onClick={() => setPageForBucket(bucket.bucket, page + 1)}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
