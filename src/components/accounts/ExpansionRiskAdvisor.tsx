import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, ShieldCheck, AlertTriangle, DollarSign, Loader2, Lightbulb, FileText, ArrowUpRight, Mail, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ExpansionOutreachDraft } from "./ExpansionOutreachDraft";

interface ExpansionRiskAdvisorProps {
  debtorId: string;
  debtorName: string;
  currentBalance: number;
  paymentScore: number | null;
  riskTier: string | null;
}

interface AdvisoryResult {
  risk_level: string;
  risk_score: number;
  risk_summary: string;
  recommended_terms: {
    payment_terms: string;
    billing_structure: string;
    credit_limit_guidance: string;
    deposit_recommendation: string;
  };
  strategic_guidance: Array<{ action: string; rationale: string }>;
  conditions: string[];
  expansion_impact: {
    total_exposure: number;
    exposure_increase_pct: number;
    projected_cash_at_risk: number;
  };
}

const riskColors: Record<string, string> = {
  Low: "bg-green-500/10 text-green-700 border-green-500/30",
  Medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  High: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  Critical: "bg-red-500/10 text-red-700 border-red-500/30",
};

const riskIcons: Record<string, any> = {
  Low: ShieldCheck,
  Medium: AlertTriangle,
  High: AlertTriangle,
  Critical: AlertTriangle,
};

export function ExpansionRiskAdvisor({ debtorId, debtorName, currentBalance, paymentScore, riskTier }: ExpansionRiskAdvisorProps) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("product");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisoryResult | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [showDraft, setShowDraft] = useState(false);

  const handleGenerateOutreach = async () => {
    if (!result) return;
    setDraftLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-expansion-outreach", {
        body: {
          debtor_id: debtorId,
          debtor_name: debtorName,
          current_balance: currentBalance,
          expansion_amount: parseFloat(amount),
          expansion_type: type,
          risk_assessment: result,
        },
      });
      if (error) throw error;
      setDraftSubject(data.subject || "");
      setDraftBody(data.body || "");
      setShowDraft(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate outreach draft");
    } finally {
      setDraftLoading(false);
    }
  };


  const handleAssess = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Enter a valid expansion amount");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("expansion-risk-advisor", {
        body: {
          debtor_id: debtorId,
          expansion_amount: numAmount,
          expansion_type: type,
          expansion_notes: notes,
        },
      });
      if (error) throw error;
      setResult(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to assess expansion risk");
    } finally {
      setLoading(false);
    }
  };

  const RiskIcon = result ? (riskIcons[result.risk_level] || AlertTriangle) : ShieldCheck;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Expansion Risk Advisor</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Evaluate risk and get AI-recommended payment terms before extending additional credit to this customer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current snapshot */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          <span>Open Balance: <strong className="text-foreground">${(currentBalance || 0).toLocaleString()}</strong></span>
          <span>Payment Score: <strong className="text-foreground">{paymentScore ?? "N/A"}</strong></span>
          <span>Risk Tier: <Badge variant="outline" className="text-[10px] px-1.5 py-0">{riskTier || "Unscored"}</Badge></span>
        </div>

        {/* Input form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Expansion Amount ($)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="25,000"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setAmount(val);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expansion Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product Purchase</SelectItem>
                <SelectItem value="service">Service Agreement</SelectItem>
                <SelectItem value="subscription">Subscription Upgrade</SelectItem>
                <SelectItem value="renewal">Contract Renewal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              placeholder="Context about the deal..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-[38px] min-h-[38px] text-xs resize-none"
            />
          </div>
        </div>

        <Button onClick={handleAssess} disabled={loading || !amount} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing Risk & Terms...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Assess Expansion Risk
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2">
            <Separator />

            {/* Risk headline */}
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${riskColors[result.risk_level] || "bg-muted"}`}>
              <RiskIcon className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{result.risk_level} Risk</span>
                  <Badge variant="outline" className="text-[10px]">Score: {result.risk_score}/100</Badge>
                </div>
                <p className="text-xs leading-relaxed">{result.risk_summary}</p>
              </div>
            </div>

            {/* Exposure impact */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-semibold">${result.expansion_impact.total_exposure.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total Exposure</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <ArrowUpRight className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-semibold">{result.expansion_impact.exposure_increase_pct}%</p>
                <p className="text-[10px] text-muted-foreground">Exposure Increase</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <AlertTriangle className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-semibold">${result.expansion_impact.projected_cash_at_risk.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Cash at Risk</p>
              </div>
            </div>

            {/* Recommended terms */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Recommended Terms
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.recommended_terms).map(([key, value]) => (
                  <div key={key} className="bg-muted/30 rounded-md p-2.5">
                    <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-xs font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic guidance */}
            {result.strategic_guidance?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Strategic Guidance
                </h4>
                <div className="space-y-1.5">
                  {result.strategic_guidance.map((g, i) => (
                    <div key={i} className="bg-muted/30 rounded-md p-2.5">
                      <p className="text-xs font-medium">{g.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{g.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conditions */}
            {result.conditions?.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold">Conditions</h4>
                <ul className="space-y-1">
                  {result.conditions.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 italic">
              This assessment is AI-generated guidance — not financial or legal advice. Always apply your own credit policies.
            </p>

            {/* Generate Outreach Button */}
            <Button
              onClick={handleGenerateOutreach}
              disabled={draftLoading}
              variant="outline"
              className="w-full border-primary/30 hover:bg-primary/5"
            >
              {draftLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Outreach Draft...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Generate AI Outreach Message
                </>
              )}
            </Button>

            {/* Editable Draft */}
            {showDraft && (
              <ExpansionOutreachDraft
                debtorId={debtorId}
                subject={draftSubject}
                body={draftBody}
                onSubjectChange={setDraftSubject}
                onBodyChange={setDraftBody}
                onRegenerate={handleGenerateOutreach}
                regenerateLoading={draftLoading}
                onClose={() => setShowDraft(false)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
