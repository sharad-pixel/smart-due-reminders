import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, FileCheck2, AlertTriangle, ExternalLink, CreditCard, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

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

  const runWithCredits = async (method: "credits" | "overage") => {
    setRunning(true);
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
      toast.error(await functionErrorMessage(e, "Failed to run assessment"));
    } finally {
      setRunning(false);
    }
  };

  const payAndRun = async () => {
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            ASC 606 Revenue Risk Assessment
          </DialogTitle>
          <DialogDescription>{contractTitle}</DialogDescription>
        </DialogHeader>

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
                  {latest.report_markdown && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Full report</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted p-3 rounded">{latest.report_markdown}</pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            )}

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

            {/* Actions */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-medium">{latest?.status === "complete" ? "Re-run assessment" : "Run assessment"}</div>
                <div className="text-xs text-muted-foreground">
                  Cost: <strong>$9.99</strong> per assessment OR <strong>10 credits</strong> ({balance >= COST ? `you have ${balance.toFixed(0)}` : `$8.00 with pre-paid credits`}).
                </div>
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
                </div>
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
