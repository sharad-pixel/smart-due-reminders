import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  Target,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  Mail,
  MessageSquare,
  Share2,
  Send,
  UserPlus,
  Lock,
} from "lucide-react";
import {
  formatCurrency,
  formatPercent,
  formatROI,
  type AssessmentInputs,
  type AssessmentResults,
  COST_PER_INVOICE,
} from "@/lib/assessmentCalculator";
import { supabase } from "@/integrations/supabase/client";

interface GPTResult {
  risk_tier: string;
  risk_summary: string;
  value_summary: string;
  recommended_actions: { title: string; why: string; time_to_do: string }[];
  minimal_followup_plan: {
    goal: string;
    touches: { day: number; channel: string; tone: string; why: string }[];
    notes: string;
  };
  cta: { headline: string; button_text: string };
}

interface ResultsProps {
  inputs: AssessmentInputs;
  results: AssessmentResults;
  gptResult: GPTResult;
  sessionId: string;
  onReset: () => void;
}

const riskColors: Record<string, string> = {
  Low: "bg-green-500/10 text-green-600 border-green-500/30",
  Medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  High: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  Critical: "bg-red-500/10 text-red-600 border-red-500/30",
};

const toneIcons: Record<string, string> = {
  friendly: "😊",
  firm: "📋",
  very_firm: "⚠️",
};

const CollectionsAssessmentResults = ({
  inputs,
  results,
  gptResult,
  sessionId,
  onReset,
}: ResultsProps) => {
  const [unlocked, setUnlocked] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockName, setUnlockName] = useState("");
  const [unlockCompany, setUnlockCompany] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Share states
  const [shareMode, setShareMode] = useState<"none" | "boss">("none");
  const [bossEmail, setBossEmail] = useState("");
  const [bossName, setBossName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [shareSent, setShareSent] = useState(false);

  const trackEvent = useCallback(
    (eventType: string, metadata?: any) => {
      supabase
        .from("assessment_events")
        .insert({ event_type: eventType, session_id: sessionId, metadata })
        .then(() => {});
    },
    [sessionId]
  );

  const handleUnlock = async () => {
    if (!unlockEmail) return;
    setIsUnlocking(true);
    trackEvent("lead_submitted", { email: unlockEmail });

    const params = new URLSearchParams(window.location.search);

    await supabase.from("assessment_leads").insert({
      name: unlockName || null,
      email: unlockEmail,
      company: unlockCompany || null,
      overdue_count: inputs.overdue_count,
      overdue_total: inputs.overdue_total,
      age_band: inputs.age_band,
      loss_pct_band: inputs.loss_pct_band,
      annual_rate: inputs.annual_rate,
      recouply_cost: results.recouply_cost,
      delay_cost: results.delay_cost,
      loss_risk_cost: results.loss_risk_cost,
      breakeven_pct: results.breakeven_pct,
      roi_multiple: results.roi_multiple,
      risk_tier: gptResult.risk_tier,
      gpt_json: gptResult as any,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
    });

    // Alert support@recouply.ai about new lead
    supabase.functions.invoke("share-assessment", {
      body: {
        to_email: "support@recouply.ai",
        to_name: "Recouply Team",
        sender_name: "Assessment Bot",
        inputs,
        results,
        gptResult,
        share_type: "new_lead_alert",
        lead_info: {
          name: unlockName || "Unknown",
          email: unlockEmail,
          company: unlockCompany || "Not provided",
        },
      },
    }).catch(() => {}); // fire-and-forget

    setIsUnlocking(false);
    setUnlocked(true);
  };

  const handleShareWithBoss = async () => {
    if (!bossEmail) return;
    setIsSending(true);
    trackEvent("assessment_shared", { share_type: "boss", to: bossEmail });

    try {
      const { error } = await supabase.functions.invoke("share-assessment", {
        body: {
          to_email: bossEmail,
          to_name: bossName || undefined,
          sender_name: unlockName || undefined,
          inputs,
          results,
          gptResult,
          share_type: "boss",
        },
      });
      if (error) throw error;
      setShareSent(true);
    } catch (err) {
      console.error("Share error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const delay = (i: number) => 0.1 + i * 0.1;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Your Collections Risk & ROI Assessment
        </h2>
        <Badge className={`text-sm px-4 py-1 border ${riskColors[gptResult.risk_tier] || riskColors.Medium}`}>
          {gptResult.risk_tier} Risk
        </Badge>
      </motion.div>

      {/* Teaser Cards — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card A — Recouply Cost (always shown) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay(0) }}>
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-primary mb-2">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm font-medium">Your Recouply Cost (at ${COST_PER_INVOICE}/invoice)</span>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(results.recouply_cost)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {inputs.overdue_count} overdue invoices.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card B — Cost of Delay (always shown) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay(1) }}>
          <Card className="border-orange-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Estimated Cost of Delay</span>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(results.delay_cost)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Assuming {inputs.annual_rate}% APR over ~{results.delay_months} months.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card C — At-Risk (blurred if locked) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay(2) }} className="relative">
          <Card className={`border-red-500/20 transition-all ${!unlocked ? "select-none" : ""}`}>
            <CardContent className={`p-5 ${!unlocked ? "blur-sm" : ""}`}>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">Estimated At-Risk Amount</span>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(results.loss_risk_cost)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Based on your "hard to collect" estimate.
              </p>
            </CardContent>
          </Card>
          {!unlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </motion.div>

        {/* Card D — Breakeven (blurred if locked) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay(3) }} className="relative">
          <Card className={`border-accent/20 transition-all ${!unlocked ? "select-none" : ""}`}>
            <CardContent className={`p-5 ${!unlocked ? "blur-sm" : ""}`}>
              <div className="flex items-center gap-2 text-accent mb-2">
                <Target className="h-5 w-5" />
                <span className="text-sm font-medium">Breakeven</span>
              </div>
              <p className="text-3xl font-bold">
                {formatCurrency(results.breakeven_recovery)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  (≈ {formatPercent(results.breakeven_pct)})
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                That's all it takes to justify Recouply on these invoices.
              </p>
            </CardContent>
          </Card>
          {!unlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Gate: Email to unlock */}
      {!unlocked && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay(4) }}
          className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-6 space-y-4"
        >
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Lock className="h-5 w-5" />
              <h3 className="text-lg font-bold">Unlock Your Full Assessment</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Enter your email to see your complete risk analysis, ROI breakdown, AI-recommended next steps, and a prioritized follow-up plan.
            </p>
          </div>
          <div className="space-y-3 max-w-sm mx-auto">
            <Input
              placeholder="Your name"
              value={unlockName}
              onChange={(e) => setUnlockName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Work email *"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
              required
            />
            <Input
              placeholder="Company (optional)"
              value={unlockCompany}
              onChange={(e) => setUnlockCompany(e.target.value)}
            />
            <Button
              onClick={handleUnlock}
              disabled={!unlockEmail || isUnlocking}
              className="w-full"
            >
              {isUnlocking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Unlock Full Report
            </Button>
          </div>
        </motion.div>
      )}

      {/* Everything below is only shown when unlocked */}
      {unlocked && (
        <>
          {/* ROI Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 rounded-xl p-6 text-center border border-primary/20"
          >
            <p className="text-sm text-muted-foreground mb-1">Estimated ROI</p>
            <p className="text-4xl font-bold text-primary">{formatROI(results.roi_multiple)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Total estimated impact: {formatCurrency(results.total_impact)} vs cost of {formatCurrency(results.recouply_cost)}
            </p>
          </motion.div>

          {/* Risk Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Risk Assessment</h3>
            </div>
            <p className="text-muted-foreground">{gptResult.risk_summary}</p>
            <p className="text-muted-foreground">{gptResult.value_summary}</p>
          </motion.div>

          {/* Recommended Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h3 className="font-semibold text-lg">Recommended Next Actions</h3>
            {gptResult.recommended_actions?.map((action, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                <CheckCircle2 className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.why}</p>
                  <p className="text-xs text-muted-foreground mt-1">⏱ {action.time_to_do}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Minimal Follow-up Plan */}
          {gptResult.minimal_followup_plan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <h3 className="font-semibold text-lg">Minimal Follow-up Plan</h3>
              <p className="text-sm text-muted-foreground">{gptResult.minimal_followup_plan.goal}</p>
              <div className="space-y-2">
                {gptResult.minimal_followup_plan.touches?.map((touch, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                    <span className="text-sm font-mono font-bold text-primary min-w-[50px]">Day {touch.day}</span>
                    {touch.channel === "email" ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">{toneIcons[touch.tone] || "📧"} {touch.tone}</span>
                    <span className="text-sm text-muted-foreground flex-1">{touch.why}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground italic">
                Focus only on the invoices where delay is most expensive.
              </p>
              {gptResult.minimal_followup_plan.notes && (
                <p className="text-sm text-muted-foreground">{gptResult.minimal_followup_plan.notes}</p>
              )}
            </motion.div>
          )}

          {/* Share with Boss */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-border bg-card p-6 space-y-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Share This Assessment</h3>
            </div>

            {shareSent ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0" />
                <div>
                  <p className="font-medium">Assessment sent!</p>
                  <p className="text-sm text-muted-foreground">We've emailed the full report to {bossEmail}.</p>
                </div>
              </div>
            ) : shareMode === "none" ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShareMode("boss")}
              >
                <UserPlus className="h-4 w-4" />
                Share with My Boss
              </Button>
            ) : (
              <div className="space-y-3 max-w-sm">
                <p className="text-sm text-muted-foreground">
                  We'll send the assessment to your boss with context on the ROI opportunity.
                </p>
                <Input
                  placeholder="Their name (optional)"
                  value={bossName}
                  onChange={(e) => setBossName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Their email *"
                  value={bossEmail}
                  onChange={(e) => setBossEmail(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShareMode("none"); setBossEmail(""); setShareSent(false); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleShareWithBoss}
                    disabled={!bossEmail || isSending}
                  >
                    {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send
                  </Button>
                </div>
              </div>
            )}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-6 border border-primary/20 text-center space-y-4"
          >
            <h3 className="text-xl font-bold">{gptResult.cta?.headline || "Ready to act on these insights?"}</h3>
            <Button size="lg" onClick={() => (window.location.href = "/signup")}>
              {gptResult.cta?.button_text || "Start Free Trial"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
        </>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Estimates are directional and depend on your business and customer behavior.
      </p>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Start Over
        </Button>
      </div>
    </div>
  );
};

export default CollectionsAssessmentResults;
