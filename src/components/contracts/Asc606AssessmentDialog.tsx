import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, FileCheck2, AlertTriangle, ExternalLink, CreditCard, Wallet, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ComplianceDocsManager } from "@/components/clm/ComplianceDocsManager";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";
import { Asc606RequiredDocsChecklist } from "@/components/contracts/Asc606RequiredDocsChecklist";

type Wallet = {
  balance_credits: number;
  pending_overage_credits: number;
  overage_enabled: boolean;
};

type Assessment = {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  risk_score: number | null;
  risk_band: string | null;
  payment_method: string | null;
  report_jsonb: any;
  report_markdown: string | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

const COST = 10;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  accountId: string;
  contractTitle: string;
}

export function Asc606AssessmentDialog({ open, onOpenChange, contractId, accountId, contractTitle }: Props) {
  const queryClient = useQueryClient();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [rerunConfirmed, setRerunConfirmed] = useState(false);

  // Reset the re-run confirmation whenever the dialog closes so the paid
  // payment options stay locked next time it opens on a completed assessment.
  useEffect(() => { if (!open) setRerunConfirmed(false); }, [open]);



  const load = async () => {
    setLoading(true);
    const [{ data: w }, { data: a }] = await Promise.all([
      supabase.from("asc606_credit_wallets").select("balance_credits, pending_overage_credits, overage_enabled").eq("account_id", accountId).maybeSingle(),
      supabase.from("asc606_assessments").select("*").eq("contract_id", contractId).order("created_at", { ascending: false }),
    ]);
    setWallet(w as any ?? { balance_credits: 0, pending_overage_credits: 0, overage_enabled: true });
    setAssessments((a as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, contractId]);

  const pollForCompletion = async (cid: string, since: Date): Promise<boolean> => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data } = await supabase
        .from("asc606_assessments")
        .select("id, status, created_at")
        .eq("contract_id", cid)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.status === "complete") return true;
      if (data?.status === "failed") return false;
    }
    return false;
  };

  const confirmRerun = (label: string) => {
    const latestDone = assessments[0]?.status === "complete";
    if (!latestDone) return true;
    return window.confirm(
      `A completed ASC 606 assessment already exists for this contract. Running ${label} will charge you again for a new assessment. Continue?`
    );
  };

  const runWithCredits = async (method: "credits" | "overage") => {
    const label = method === "credits" ? "with 10 credits" : "as $10 overage";
    if (!confirmRerun(label)) return;
    setRunning(true);
    const startedAt = new Date(Date.now() - 5000);
    try {
      const { error } = await supabase.functions.invoke("asc606-run-assessment", {
        body: { contractId, paymentMethod: method },
      });
      if (error) throw error;
      toast.success("Assessment complete");
      await load();
      queryClient.invalidateQueries({ queryKey: ["asc606-latest-assessment", contractId] });
      queryClient.invalidateQueries({ queryKey: ["asc606-guidance-messages", contractId] });
    } catch (e: any) {
      // Client may have timed out while the server kept running — poll for completion before erroring.
      const recovered = await pollForCompletion(contractId, startedAt);
      if (recovered) {
        toast.success("Assessment complete");
        await load();
        queryClient.invalidateQueries({ queryKey: ["asc606-latest-assessment", contractId] });
        queryClient.invalidateQueries({ queryKey: ["asc606-guidance-messages", contractId] });
      } else {
        toast.error(await functionErrorMessage(e, "Failed to run assessment"));
      }
    } finally {
      setRunning(false);
    }
  };

  const payAndRun = async () => {
    if (!confirmRerun("a paid $10 assessment")) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("asc606-pay-assessment", {
        body: { contractId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(await functionErrorMessage(e, "Failed to start checkout"));
    } finally {
      setPaying(false);
    }
  };


  const balance = Number(wallet?.balance_credits ?? 0);
  const canUseCredits = balance >= COST;
  const canUseOverage = !canUseCredits && (wallet?.overage_enabled ?? true);
  const latest = assessments[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            ASC 606 Revenue Risk Assessment
          </DialogTitle>
          <DialogDescription>{contractTitle}</DialogDescription>
          <div className="pt-2">
            <Asc606ReferenceBanner />
          </div>
        </DialogHeader>


        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            {/* Wallet */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{balance.toFixed(0)} credits available</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(wallet?.pending_overage_credits ?? 0) > 0
                        ? `${Number(wallet?.pending_overage_credits).toFixed(0)} pending overage credits this month`
                        : "Pre-paid credits = $0.80 each (20% off)"}
                    </div>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/billing/asc606-credits"><CreditCard className="h-4 w-4 mr-1" />Buy Credits</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Latest assessment */}
            {latest && latest.status === "complete" && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-5 w-5 text-green-600" />
                        <span className="font-medium">Latest Assessment</span>
                        {latest.risk_band && <Badge variant={riskVariant(latest.risk_band)}>{latest.risk_band}</Badge>}
                        {latest.risk_score != null && <span className="text-sm text-muted-foreground">Score {latest.risk_score}/100</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(latest.completed_at ?? latest.created_at).toLocaleString()} · paid via {latest.payment_method}
                      </div>
                    </div>
                  </div>
                  {latest.report_jsonb?.summary && (
                    <p className="text-sm text-foreground/80 mb-3">{latest.report_jsonb.summary}</p>
                  )}
                  {Array.isArray(latest.report_jsonb?.key_risks) && latest.report_jsonb.key_risks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Key Risks</div>
                      {latest.report_jsonb.key_risks.slice(0, 5).map((k: any, i: number) => (
                        <div key={i} className="text-sm border-l-2 pl-3" style={{ borderColor: severityColor(k.severity) }}>
                          <div className="font-medium">{k.title}</div>
                          <div className="text-xs text-muted-foreground">{k.detail}</div>
                          {k.remediation && <div className="text-xs mt-1"><span className="font-medium">Fix:</span> {k.remediation}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {latest.report_jsonb && <MissingDataSection report={latest.report_jsonb} />}
                  {latest.report_markdown && (
                    <Collapsible className="mt-3">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground -ml-2">
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          View full ASC 606 report
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded-md border bg-card p-4 prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-li:my-0.5 prose-pre:bg-muted prose-pre:border prose-pre:text-xs prose-code:text-xs">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{latest.report_markdown}</ReactMarkdown>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Required documentation checklist */}
            <Asc606RequiredDocsChecklist contractId={contractId} accountId={accountId} />

            {/* Compliance documents library */}
            <ComplianceDocsManager accountId={accountId} defaultStandard="ASC 606" />


            {latest && latest.status === "failed" && (
              <Card className="border-destructive/50">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <div className="font-medium">Last run failed</div>
                    <div className="text-xs text-muted-foreground">{latest.error}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions — payment options are locked once an assessment is complete
                so users don't accidentally pay twice for the same contract. */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-medium">{latest?.status === "complete" ? "Re-run assessment" : "Run assessment"}</div>
                {latest?.status === "complete" && !rerunConfirmed ? (
                  <>
                    <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 flex items-start gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        This contract already has a completed ASC 606 assessment
                        {latest.completed_at ? ` (${new Date(latest.completed_at).toLocaleDateString()})` : ""}
                        {latest.payment_method ? ` — paid via ${latest.payment_method}` : ""}.
                        You don't need to pay again unless the contract changed.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="default">
                        <Link to={`/contracts/live/${contractId}/asc606`}>
                          <FileCheck2 className="h-4 w-4 mr-1" /> View full report
                        </Link>
                      </Button>
                      <Button variant="outline" onClick={() => setRerunConfirmed(true)}>
                        Re-run (requires new payment)
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">
                      Cost: <strong>$9.99</strong> per assessment OR <strong>10 credits</strong> ({balance >= COST ? `you have ${balance.toFixed(0)}` : `$8.00 with pre-paid credits`}).
                    </div>
                    {latest?.status === "complete" && rerunConfirmed && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>Re-running will charge you again. You'll be asked to confirm once more before we run it.</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {canUseCredits && (
                        <Button onClick={() => runWithCredits("credits")} disabled={running}>
                          {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                          Use 10 credits
                        </Button>
                      )}
                      <Button variant={canUseCredits ? "outline" : "default"} onClick={payAndRun} disabled={paying}>
                        {paying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                        Pay $9.99
                      </Button>
                      {canUseOverage && (
                        <Button variant="outline" onClick={() => runWithCredits("overage")} disabled={running}>
                          Use overage ($10 billed monthly)
                        </Button>
                      )}
                      {latest?.status === "complete" && rerunConfirmed && (
                        <Button variant="ghost" onClick={() => setRerunConfirmed(false)}>
                          Cancel re-run
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>



            {/* History */}
            {assessments.length > 1 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-muted-foreground">History</div>
                {assessments.slice(1).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm border-b py-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                      {a.risk_band && <Badge variant={riskVariant(a.risk_band)}>{a.risk_band}</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{a.payment_method}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function riskVariant(band: string): any {
  const b = band.toLowerCase();
  if (b.includes("critical") || b.includes("high")) return "destructive";
  if (b.includes("elevated") || b.includes("moderate")) return "secondary";
  return "outline";
}
function severityColor(s?: string): string {
  const v = (s ?? "").toLowerCase();
  if (v === "high") return "hsl(var(--destructive))";
  if (v === "medium") return "hsl(var(--primary))";
  return "hsl(var(--muted-foreground))";
}

async function functionErrorMessage(e: any, fallback: string): Promise<string> {
  try {
    const ctx = e?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json();
      return body?.message || body?.error || fallback;
    }
  } catch {
    // Fall through to default message.
  }
  return e?.message ?? fallback;
}

function MissingDataSection({ report }: { report: any }) {
  const buckets = [
    { label: "Step 1 — Contract", issues: report?.step1_identify_contract?.issues },
    { label: "Step 2 — Performance Obligations", issues: report?.step2_performance_obligations?.issues },
    { label: "Step 3 — Transaction Price", issues: report?.step3_transaction_price?.issues },
    { label: "Step 4 — Allocate Price", issues: report?.step4_allocate_price?.issues },
    { label: "Step 5 — Recognize Revenue", issues: report?.step5_recognize_revenue?.issues },
  ].filter((b) => Array.isArray(b.issues) && b.issues.length > 0);

  const guidance = Array.isArray(report?.revenue_compliance_guidance) ? report.revenue_compliance_guidance : [];
  if (buckets.length === 0 && guidance.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {buckets.length > 0 && (
        <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 p-3">
          <div className="text-xs font-semibold uppercase text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Missing data & open issues
          </div>
          <div className="space-y-2">
            {buckets.map((b) => (
              <div key={b.label} className="text-sm">
                <div className="font-medium text-foreground">{b.label}</div>
                <ul className="mt-1 ml-4 list-disc text-xs text-muted-foreground space-y-0.5">
                  {b.issues.map((it: any, i: number) => (
                    <li key={i}>{typeof it === "string" ? it : it?.title ?? it?.detail ?? JSON.stringify(it)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {guidance.length > 0 && (
        <div className="rounded-md border bg-card p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Revenue compliance guidance</div>
          <div className="space-y-2">
            {guidance.slice(0, 8).map((g: any, i: number) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{g.asc606_step ?? "ASC 606"}</Badge>
                  <span className="font-medium">{g.area ?? "Guidance"}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{g.guidance}</div>
                {g.evidence_needed && (
                  <div className="text-xs mt-0.5"><span className="font-medium">Evidence needed:</span> {g.evidence_needed}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
