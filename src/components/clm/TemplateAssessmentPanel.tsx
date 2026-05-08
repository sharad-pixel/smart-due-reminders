import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Sparkles, Loader2, RefreshCw, AlertTriangle, Lightbulb, FileWarning, EyeOff, Eye } from "lucide-react";
import { useReassessTemplate, useToggleAssessmentRiskIgnored, type ClmTemplate } from "@/hooks/useClmTemplates";

interface KeyRisk { title: string; severity?: string; clause?: string; explanation?: string; evidence_quote?: string }
interface Recommendation { title: string; priority?: string; rationale?: string }
interface Assessment {
  overall_risk?: "low" | "medium" | "high";
  risk_score?: number;
  executive_summary?: string;
  key_risks?: KeyRisk[];
  recommendations?: Recommendation[];
  missing_clauses?: string[];
  favorability?: "favors_us" | "favors_counterparty" | "balanced";
}

const sevColor = (s?: string) => {
  if (s === "high") return "destructive";
  if (s === "medium") return "secondary";
  return "outline";
};

const favorabilityLabel = (f?: string) =>
  f === "favors_us" ? "Favors us" : f === "favors_counterparty" ? "Favors counterparty" : f === "balanced" ? "Balanced" : null;

export const TemplateAssessmentPanel = ({ template }: { template: ClmTemplate }) => {
  const reassess = useReassessTemplate();
  const status = template.assessment_status;
  const a: Assessment | null = (template.assessment as Assessment) ?? null;

  const canRun = template.status === "ready";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> GPT-5 Risk Assessment
          </CardTitle>
          <CardDescription>
            Independent attorney-style review — runs alongside the AI sectionalization.
            {template.assessed_at && (
              <span className="ml-1 text-xs">Last run {new Date(template.assessed_at).toLocaleString()}</span>
            )}
          </CardDescription>
        </div>
        {canRun && status !== "running" && (
          <Button variant="outline" size="sm" onClick={() => reassess.mutate(template.id)} disabled={reassess.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" />{a ? "Re-assess" : "Run assessment"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {status === "running" || (status === "pending" && canRun) ? (
          <div className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">GPT-5 is reading the contract — this typically takes 20–60 seconds…</p>
          </div>
        ) : status === "failed" ? (
          <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{template.assessment_error ?? "Assessment failed"}</span>
          </div>
        ) : !a ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Assessment will run automatically once sectionalization completes.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Top-level row */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Overall Risk</p>
                <Badge variant={sevColor(a.overall_risk) as any} className="capitalize mt-1">{a.overall_risk ?? "—"}</Badge>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{a.risk_score ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
                {typeof a.risk_score === "number" && <Progress value={a.risk_score} className="h-1.5 mt-2" />}
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Favorability</p>
                <p className="font-medium mt-1 text-sm">{favorabilityLabel(a.favorability) ?? "—"}</p>
              </div>
            </div>

            {a.executive_summary && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Executive Summary
                </p>
                <p className="text-sm">{a.executive_summary}</p>
              </div>
            )}

            {a.key_risks && a.key_risks.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Key Risks
                </p>
                <ul className="space-y-2">
                  {a.key_risks.map((r, i) => (
                    <li key={i} className="rounded border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={sevColor(r.severity) as any} className="capitalize text-xs">{r.severity ?? "—"}</Badge>
                        <span className="font-medium text-sm">{r.title}</span>
                        {r.clause && <span className="text-xs text-muted-foreground">· {r.clause}</span>}
                      </div>
                      {r.explanation && <p className="text-sm text-muted-foreground">{r.explanation}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {a.recommendations && a.recommendations.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Recommendations
                </p>
                <ul className="space-y-2">
                  {a.recommendations.map((r, i) => (
                    <li key={i} className="rounded border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={sevColor(r.priority) as any} className="capitalize text-xs">{r.priority ?? "—"}</Badge>
                        <span className="font-medium text-sm">{r.title}</span>
                      </div>
                      {r.rationale && <p className="text-sm text-muted-foreground">{r.rationale}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {a.missing_clauses && a.missing_clauses.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <FileWarning className="h-4 w-4 text-muted-foreground" /> Potentially Missing Clauses
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {a.missing_clauses.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            {template.assessment_model && (
              <p className="text-xs text-muted-foreground text-right">Model: {template.assessment_model}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
