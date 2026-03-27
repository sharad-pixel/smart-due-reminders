import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays, addDays } from "date-fns";
import { CalendarIcon, TrendingUp, Eye, ChevronDown, ChevronUp, Mail, Clock } from "lucide-react";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
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
  invoices: (ForecastInvoice & { forecast_dpd: number; planned_steps: PlannedStep[] })[];
  totalAmount: number;
  count: number;
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
  const [forecastDate, setForecastDate] = useState<Date>(addDays(new Date(), 30));
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

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

  // Fetch workflow steps for planned outreach
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

  // Build forecast
  const forecast = useMemo(() => {
    if (!invoices) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(forecastDate);
    target.setHours(0, 0, 0, 0);

    // Build workflow steps lookup by bucket
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
      const currentBucket = getBucketForDPD(currentDPD);

      // Calculate planned outreach steps
      const plannedSteps: PlannedStep[] = [];

      // Get the bucket the invoice will be in on forecast date
      // and calculate what outreach steps are planned
      const bucketEnteredAt = inv.bucket_entered_at ? new Date(inv.bucket_entered_at) : null;

      // For each bucket the invoice will pass through, show planned steps
      const bucketsToCheck = BUCKET_CONFIG.filter(
        (b) => b.value !== "current" && b.min <= forecastDPD && b.min >= Math.max(1, currentDPD)
      );

      // Also include current bucket steps
      if (futureBucket !== "current" && stepsByBucket[futureBucket]) {
        const steps = stepsByBucket[futureBucket];
        steps.forEach((step) => {
          // Estimate when bucket was/will be entered
          const bucketConfig = BUCKET_CONFIG.find((b) => b.value === futureBucket);
          if (!bucketConfig) return;
          const bucketEntryDPD = bucketConfig.min;
          const bucketEntryDate = addDays(dueDate, bucketEntryDPD);
          const stepDate = addDays(bucketEntryDate, step.day_offset);

          let status: PlannedStep["status"] = "future";
          if (stepDate <= today) status = "completed";
          else if (stepDate <= target) status = "upcoming";

          plannedSteps.push({
            label: step.label,
            channel: step.channel,
            day_offset: step.day_offset,
            scheduled_date: format(stepDate, "MMM d, yyyy"),
            status,
          });
        });
      }

      // Also gather steps from intermediate buckets
      BUCKET_CONFIG.forEach((bc) => {
        if (bc.value === "current" || bc.value === futureBucket) return;
        if (bc.min > currentDPD && bc.min <= forecastDPD && stepsByBucket[bc.value]) {
          stepsByBucket[bc.value].forEach((step) => {
            const bucketEntryDate = addDays(dueDate, bc.min);
            const stepDate = addDays(bucketEntryDate, step.day_offset);
            let status: PlannedStep["status"] = "future";
            if (stepDate <= today) status = "completed";
            else if (stepDate <= target) status = "upcoming";

            plannedSteps.push({
              label: step.label,
              channel: step.channel,
              day_offset: step.day_offset,
              scheduled_date: format(stepDate, "MMM d, yyyy"),
              status,
            });
          });
        }
      });

      // Sort steps by date
      plannedSteps.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

      bucketMap[futureBucket].invoices.push({
        ...inv,
        forecast_dpd: forecastDPD,
        planned_steps: plannedSteps,
      });
      bucketMap[futureBucket].totalAmount += Number(inv.amount_outstanding || inv.amount || 0);
      bucketMap[futureBucket].count++;
    });

    return Object.values(bucketMap).filter((b) => b.count > 0);
  }, [invoices, forecastDate, workflowSteps]);

  const totalForecast = forecast.reduce((s, b) => s + b.totalAmount, 0);
  const totalInvoices = forecast.reduce((s, b) => s + b.count, 0);

  const toggleBucket = (bucket: string) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      next.has(bucket) ? next.delete(bucket) : next.add(bucket);
      return next;
    });
  };

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
              See which buckets invoices will fall into on a future date and what outreach is planned
            </CardDescription>
          </div>
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

              return (
                <div key={bucket.bucket} className="border rounded-lg overflow-hidden">
                  {/* Bucket Header */}
                  <button
                    onClick={() => toggleBucket(bucket.bucket)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    {persona && (
                      <PersonaAvatar persona={bucket.persona!} size="sm" />
                    )}
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
                        <span>{bucket.count} invoice{bucket.count !== 1 ? "s" : ""}</span>
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
                            <TableHead className="text-xs text-right">Outstanding</TableHead>
                            <TableHead className="text-xs text-right">DPD</TableHead>
                            <TableHead className="text-xs">Planned Outreach</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bucket.invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="text-xs font-medium">
                                {inv.invoice_number || inv.id.slice(0, 8)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {inv.debtors?.company_name || inv.debtors?.name || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                ${Number(inv.amount_outstanding || inv.amount || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                <Badge variant="secondary" className="text-xs">
                                  {inv.forecast_dpd}d
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {inv.planned_steps.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {inv.planned_steps.map((step, i) => (
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
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
