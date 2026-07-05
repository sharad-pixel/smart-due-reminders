import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  ShieldCheck,
  FileCheck2,
  Lock,
  ArrowRight,
  Loader2,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ListChecks,
  Plus,
} from "lucide-react";
import { Asc606AssessmentDialog } from "@/components/contracts/Asc606AssessmentDialog";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";

interface Props {
  contractId: string;
  accountId: string;
  contractTitle: string;
}

const DEFAULT_CATEGORIES = [
  { key: "contract_identification", label: "Contract Identification" },
  { key: "performance_obligations", label: "Performance Obligations" },
  { key: "transaction_price", label: "Transaction Price" },
  { key: "billing_terms", label: "Billing Terms" },
  { key: "contract_modifications", label: "Contract Modifications" },
  { key: "renewal_termination", label: "Renewal & Termination" },
  { key: "commercial_completeness", label: "Commercial Completeness" },
  { key: "revenue_intelligence_validation", label: "Revenue Intelligence Validation" },
];

function scoreColor(score: number) {
  if (score >= 80) return { ring: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "text-emerald-700" };
  if (score >= 60) return { ring: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "text-amber-700" };
  return { ring: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "text-red-700" };
}

function statusPill(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "pass")
    return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Pass" };
  if (s === "missing")
    return { icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: "bg-red-50 text-red-700 border-red-200", label: "Missing" };
  return { icon: <HelpCircle className="h-3.5 w-3.5" />, cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Needs Review" };
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" strokeWidth="8" className="stroke-muted fill-none" />
        <circle
          cx="50" cy="50" r="42" strokeWidth="8"
          className={`${c.ring} fill-none transition-all`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-2xl font-bold ${c.label}`}>{Math.round(score)}%</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
      </div>
    </div>
  );
}

function ReadinessBar({ label, value }: { label: string; value: number }) {
  const c = scoreColor(value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${c.label}`}>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Derive fallback category data from a legacy assessment shape (step1_..step5_,
 * key_risks) so contracts assessed before the schema extension still render.
 */
function deriveCategoriesFromLegacy(report: any) {
  if (!report) return [];
  const risks: any[] = Array.isArray(report.key_risks) ? report.key_risks : [];
  const findingsFor = (matchers: string[]) =>
    risks
      .filter((r) => matchers.some((m) => `${r.title || ""} ${r.detail || ""}`.toLowerCase().includes(m)))
      .map((r) => r.title || r.detail)
      .filter(Boolean);

  const steps = {
    contract_identification: report.step1_identify_contract,
    performance_obligations: report.step2_performance_obligations,
    transaction_price: report.step3_transaction_price,
    billing_terms: report.step3_transaction_price,
    contract_modifications: report.step4_allocate_price,
    renewal_termination: report.step5_recognize_revenue,
    commercial_completeness: null,
    revenue_intelligence_validation: report.step4_allocate_price,
  } as Record<string, any>;

  return DEFAULT_CATEGORIES.map((c) => {
    const step = steps[c.key];
    const issues: any[] = step?.issues ?? [];
    return {
      key: c.key,
      label: c.label,
      status: issues.length > 0 ? "review" : step ? "pass" : "review",
      confidence: 70,
      findings: issues.length ? issues : findingsFor([c.label.toLowerCase()]),
      references: [],
      commercial_impact: "",
      recommended_action: "",
    };
  });
}

export function RevenueComplianceReview({ contractId, accountId, contractTitle }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const qc = useQueryClient();

  const { data: contract } = useQuery({
    queryKey: ["contract-debtor", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_imports")
        .select("debtor_id")
        .eq("id", contractId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: latest, isLoading } = useQuery({
    queryKey: ["revenue-compliance-latest", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("asc606_assessments")
        .select("id, status, risk_band, risk_score, completed_at, payment_method, report_jsonb")
        .eq("contract_id", contractId)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const report = latest?.report_jsonb ?? null;
  const hasPaidAssessment = !!latest?.id;

  const view = useMemo(() => {
    if (!report) return null;
    const complianceScore = Number.isFinite(Number(report.compliance_score))
      ? Number(report.compliance_score)
      : Math.max(0, 100 - Number(report.risk_score || 0));
    const riskLevel: string =
      report.risk_level ||
      (report.risk_band ? String(report.risk_band).toLowerCase() : complianceScore >= 80 ? "low" : complianceScore >= 60 ? "medium" : "high");
    const confidence = Number.isFinite(Number(report.confidence)) ? Number(report.confidence) : 85;
    const categoriesRaw: any[] = Array.isArray(report.categories) && report.categories.length
      ? report.categories
      : deriveCategoriesFromLegacy(report);
    const categories = DEFAULT_CATEGORIES.map((d) => {
      const found = categoriesRaw.find((c: any) => c.key === d.key);
      return {
        key: d.key,
        label: d.label,
        status: found?.status || "review",
        confidence: found?.confidence ?? 70,
        findings: Array.isArray(found?.findings) ? found.findings : [],
        references: Array.isArray(found?.references) ? found.references : [],
        commercial_impact: found?.commercial_impact || "",
        recommended_action: found?.recommended_action || "",
      };
    });
    const readiness = report.readiness || {
      commercial_completeness: complianceScore,
      revenue: complianceScore,
      billing: complianceScore,
      collection: complianceScore,
    };
    return {
      complianceScore,
      riskLevel,
      confidence,
      categories,
      readiness,
      executiveSummary: report.executive_summary || report.summary || "",
      aiObservations: Array.isArray(report.ai_observations) ? report.ai_observations : [],
      recommendedActions: Array.isArray(report.recommended_actions)
        ? report.recommended_actions
        : (Array.isArray(report.recommendations) ? report.recommendations.map((t: string) => ({ title: t, priority: "medium" })) : []),
    };
  }, [report]);

  const createTask = useMutation({
    mutationFn: async ({ title, priority = "normal" }: { title: string; priority?: string }) => {
      const debtorId = contract?.debtor_id;
      if (!debtorId) throw new Error("Link this contract to an account first to create tasks.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("collection_tasks").insert({
        user_id: u.user.id,
        debtor_id: debtorId,
        task_type: "contract_followup",
        summary: title,
        details: `Revenue Compliance Review · ${contractTitle}`,
        priority: priority === "high" ? "high" : priority === "low" ? "low" : "normal",
        status: "open",
        level: "debtor",
        source: "user_created",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      qc.invalidateQueries({ queryKey: ["contract-tasks", contract?.debtor_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const c = view ? scoreColor(view.complianceScore) : null;

  return (
    <Card id="asc606">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Revenue Compliance Review
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              AI-assisted review of commercial terms that may impact revenue recognition,
              billing, contract administration, and finance operations. This does not
              replace Finance review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasPaidAssessment ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                  <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Re-run
                </Button>
                <Button size="sm" asChild>
                  <Link to={`/contracts/live/${contractId}/asc606`}>
                    Full review <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Run Review
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Asc606ReferenceBanner variant="inline" />

        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !view ? (
          <div className="border rounded-md p-4 bg-muted/30 flex items-start gap-3">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Revenue Compliance Review is locked</div>
              <div className="text-xs text-muted-foreground mt-1">
                Run a paid Revenue Compliance Review for this contract to unlock the
                categorized review, missing-information audit, executive summary, and
                recommended actions.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Run Review
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/billing/asc606-credits">
                    <CreditCard className="h-3.5 w-3.5 mr-1" /> Buy credits
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Score header */}
            <div className={`rounded-lg border ${c!.border} ${c!.bg} p-4 flex items-center gap-4 flex-wrap`}>
              <ScoreRing score={view.complianceScore} />
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">
                    Risk: {view.riskLevel}
                  </Badge>
                  <Badge variant="outline">Confidence {Math.round(view.confidence)}%</Badge>
                  {latest?.completed_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Reviewed {new Date(latest.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {view.executiveSummary && (
                  <p className="text-sm text-foreground/85 leading-relaxed">
                    {view.executiveSummary}
                  </p>
                )}
              </div>
              <div className="w-full sm:w-72 space-y-2">
                <ReadinessBar label="Commercial Completeness" value={view.readiness.commercial_completeness ?? 0} />
                <ReadinessBar label="Revenue Readiness" value={view.readiness.revenue ?? 0} />
                <ReadinessBar label="Billing Readiness" value={view.readiness.billing ?? 0} />
                <ReadinessBar label="Collection Readiness" value={view.readiness.collection ?? 0} />
              </div>
            </div>

            {/* Category accordion */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Review Categories
              </div>
              <Accordion type="multiple" className="border rounded-md divide-y">
                {view.categories.map((cat) => {
                  const pill = statusPill(cat.status);
                  return (
                    <AccordionItem key={cat.key} value={cat.key} className="border-0 px-3">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 flex-1 pr-3">
                          <Badge variant="outline" className={`${pill.cls} gap-1`}>
                            {pill.icon} {pill.label}
                          </Badge>
                          <span className="text-sm font-medium text-left">{cat.label}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            AI confidence {Math.round(cat.confidence)}%
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 space-y-2 text-sm">
                        {cat.findings.length === 0 && !cat.commercial_impact && !cat.recommended_action ? (
                          <p className="text-xs text-muted-foreground">
                            No findings for this category.
                          </p>
                        ) : (
                          <>
                            {cat.findings.length > 0 && (
                              <div>
                                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Findings</div>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/85">
                                  {cat.findings.map((f: any, i: number) => (
                                    <li key={i}>{typeof f === "string" ? f : (f.title || f.detail || JSON.stringify(f))}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {cat.references.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">References: </span>
                                {cat.references.join(" · ")}
                              </div>
                            )}
                            {cat.commercial_impact && (
                              <div className="text-xs">
                                <span className="font-medium">Commercial impact: </span>
                                <span className="text-foreground/80">{cat.commercial_impact}</span>
                              </div>
                            )}
                            {cat.recommended_action && (
                              <div className="flex items-start justify-between gap-3 rounded-md bg-muted/50 p-2">
                                <div className="text-xs">
                                  <span className="font-medium">Recommended action: </span>
                                  <span className="text-foreground/80">{cat.recommended_action}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs shrink-0"
                                  disabled={createTask.isPending}
                                  onClick={() => createTask.mutate({ title: cat.recommended_action })}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add task
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* AI Observations */}
            {view.aiObservations.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> AI Observations
                </div>
                <ul className="space-y-1.5 text-sm">
                  {view.aiObservations.map((o: string, i: number) => (
                    <li key={i} className="flex gap-2 text-foreground/85">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Actions */}
            {view.recommendedActions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" /> Recommended Actions
                </div>
                <div className="space-y-1.5">
                  {view.recommendedActions.map((a: any, i: number) => {
                    const title = typeof a === "string" ? a : a.title;
                    const priority = typeof a === "string" ? "medium" : (a.priority || "medium");
                    return (
                      <div key={i} className="flex items-start justify-between gap-3 border rounded-md p-2 text-sm">
                        <div className="flex items-start gap-2 flex-1">
                          <Badge
                            variant="outline"
                            className={
                              priority === "high"
                                ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                                : priority === "low"
                                ? "text-[10px]"
                                : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                            }
                          >
                            {priority}
                          </Badge>
                          <span className="text-foreground/85">{title}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          disabled={createTask.isPending}
                          onClick={() => createTask.mutate({ title, priority })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add task
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t">
              This review identifies commercial terms that commonly require Finance
              attention. It does not provide accounting conclusions.{" "}
              <Link
                to={`/contracts/live/${contractId}/asc606`}
                className="text-primary hover:underline font-medium"
              >
                Open the full review workspace
              </Link>{" "}
              for the detailed report, evidence audit, and AI advisor.
            </div>
          </>
        )}
      </CardContent>

      <Asc606AssessmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contractId={contractId}
        accountId={accountId}
        contractTitle={contractTitle}
      />
    </Card>
  );
}

export default RevenueComplianceReview;
