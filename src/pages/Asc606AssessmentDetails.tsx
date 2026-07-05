import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileCheck2, AlertTriangle, Lock, Sparkles, CreditCard } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Asc606ChatPanel } from "@/components/clm/Asc606ChatPanel";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";
import { Asc606RequiredDocsChecklist } from "@/components/contracts/Asc606RequiredDocsChecklist";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import SEO from "@/components/seo/SEO";

function riskVariant(band: string): any {
  const b = (band || "").toLowerCase();
  if (b.includes("critical") || b.includes("high")) return "destructive";
  if (b.includes("elevated") || b.includes("moderate")) return "secondary";
  return "outline";
}
function severityColor(s: string): string {
  const v = (s || "").toLowerCase();
  if (v.includes("critical")) return "hsl(var(--destructive))";
  if (v.includes("high")) return "hsl(var(--destructive))";
  if (v.includes("medium") || v.includes("moderate")) return "hsl(45 93% 47%)";
  return "hsl(var(--muted-foreground))";
}

const Asc606AssessmentDetails = () => {
  const { importId } = useParams<{ importId: string }>();
  const navigate = useNavigate();
  const { accountId } = useClmEntitlement();

  const { data: contract, isLoading: cLoading } = useQuery({
    queryKey: ["live-contract-mini", importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_imports")
        .select("id, contract_name, account_id")
        .eq("id", importId!)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: assessments = [], isLoading: aLoading } = useQuery({
    queryKey: ["asc606-assessments-full", importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data } = await supabase
        .from("asc606_assessments")
        .select("*")
        .eq("contract_id", importId!)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const latest = useMemo(
    () => assessments.find((a: any) => a.status === "complete") ?? null,
    [assessments],
  );

  const title = contract?.contract_name || "Contract";
  const effectiveAccountId = contract?.account_id || accountId || "";

  return (
    <Layout>
      <SEO
        title={`ASC 606 Assessment · ${title}`}
        description="Full paid ASC 606 assessment: compliance report, key risks, missing evidence, and AI advisor prompts."
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/contracts/live/${importId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to contract
          </Button>
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">ASC 606 Assessment</h1>
            {latest?.risk_band && (
              <Badge variant={riskVariant(latest.risk_band)}>
                {latest.risk_band}
                {latest.risk_score != null ? ` · ${latest.risk_score}/100` : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{title}</p>
        </div>

        <Asc606ReferenceBanner />

        {cLoading || aLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !latest ? (
          <Card>
            <CardContent className="p-6 flex items-start gap-3">
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">No paid assessment on record</div>
                <div className="text-sm text-muted-foreground mt-1">
                  This page is only available for contracts with a completed paid ASC 606
                  assessment. Purchase and run an assessment to unlock the full compliance
                  report and AI advisor prompts.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link to={`/contracts/live/${importId}`}>
                      <FileCheck2 className="h-4 w-4 mr-1" /> Back to contract to run
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/billing/asc606-credits">
                      <CreditCard className="h-4 w-4 mr-1" /> Buy credits
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Latest report summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-green-600" /> Latest assessment
                  <span className="text-xs font-normal text-muted-foreground">
                    {new Date(latest.completed_at ?? latest.created_at).toLocaleString()} · paid via{" "}
                    {latest.payment_method ?? "—"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {latest.report_jsonb?.summary && (
                  <p className="text-sm text-foreground/90">{latest.report_jsonb.summary}</p>
                )}
                {Array.isArray(latest.report_jsonb?.key_risks) &&
                  latest.report_jsonb.key_risks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Key risks
                      </div>
                      {latest.report_jsonb.key_risks.map((k: any, i: number) => (
                        <div
                          key={i}
                          className="text-sm border-l-2 pl-3"
                          style={{ borderColor: severityColor(k.severity) }}
                        >
                          <div className="font-medium">{k.title}</div>
                          <div className="text-xs text-muted-foreground">{k.detail}</div>
                          {k.remediation && (
                            <div className="text-xs mt-1">
                              <span className="font-medium">Fix:</span> {k.remediation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                {Array.isArray(latest.report_jsonb?.missing_data) &&
                  latest.report_jsonb.missing_data.length > 0 && (
                    <div className="rounded-md border bg-amber-50 border-amber-200 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                        <AlertTriangle className="h-4 w-4" /> Missing evidence
                      </div>
                      <ul className="mt-1 text-xs text-amber-900 list-disc pl-5 space-y-0.5">
                        {latest.report_jsonb.missing_data.map((m: any, i: number) => (
                          <li key={i}>{typeof m === "string" ? m : m.item || JSON.stringify(m)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                {latest.report_markdown && (
                  <div className="mt-2 rounded-md border bg-card p-4 prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-li:my-0.5 prose-pre:bg-muted prose-pre:border prose-pre:text-xs prose-code:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {latest.report_markdown}
                    </ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Advisor prompts (chat) — unlocked because paid assessment exists */}
            <Asc606ChatPanel contractId={importId!} contractTitle={title} />

            {/* Required docs checklist */}
            {effectiveAccountId && (
              <Asc606RequiredDocsChecklist
                contractId={importId!}
                accountId={effectiveAccountId}
              />
            )}

            {/* History */}
            {assessments.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {assessments.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between text-sm border-b py-1.5 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {a.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                        {a.risk_band && (
                          <Badge variant={riskVariant(a.risk_band)}>{a.risk_band}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {a.payment_method ?? "—"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Asc606AssessmentDetails;
