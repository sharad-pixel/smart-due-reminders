import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  TrendingDown,
  Target,
  AlertTriangle,
  Users,
  FileText,
  DollarSign,
  BarChart3,
  Brain,
  ArrowRight,
  CheckCircle2,
  Zap,
  Clock,
  PieChart,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const RevenueRiskFeature = () => {
  return (
    <MarketingLayout>
      <SEOHead
        title="Revenue Risk & ECL Intelligence | Recouply.ai"
        description="Predict expected credit losses, score invoice collectability, and protect revenue with AI-powered risk intelligence aligned to ASC 326 & IFRS 9 standards."
        keywords="expected credit loss, ECL, revenue risk, collectability score, ASC 326, IFRS 9, accounts receivable risk, credit loss prediction"
        canonical="https://recouply.ai/features/revenue-risk"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 max-w-6xl text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">
              <Shield className="h-3 w-3 mr-1" />
              Revenue Protection
            </Badge>
          </motion.div>
          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Know Your{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Revenue Risk
            </span>{" "}
            Before It Hits
          </motion.h1>
          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8"
          >
            AI-powered Expected Credit Loss (ECL) intelligence that scores every invoice,
            predicts defaults, and tells you exactly how much AR is at risk — aligned
            to ASC 326 &amp; IFRS 9 simplified approaches.
          </motion.p>
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" asChild>
              <Link to="/signup">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/collections-assessment">See Your Risk Score</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Interactive Demo / Dashboard Preview */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Live Risk Dashboard</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              See how Recouply scores your portfolio in real time — every metric below
              is calculated automatically from your invoice data.
            </p>
          </div>

          {/* Mock dashboard cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: DollarSign, label: "Total AR", value: "$847,500", sub: "142 invoices · 38 accounts", color: "text-foreground" },
              { icon: TrendingDown, label: "Overdue AR", value: "$312,400", sub: "36.8% of total", color: "text-orange-600" },
              { icon: Target, label: "Avg Collectability", value: "74%", sub: "Moderate", color: "text-yellow-600" },
              { icon: AlertTriangle, label: "Expected Credit Loss", value: "$48,200", sub: "5.7% of AR at risk", color: "text-red-600" },
              { icon: Users, label: "Engagement-Adj ECL", value: "$31,700", sub: "34% adjusted down", color: "text-amber-600" },
              { icon: FileText, label: "At Risk Invoices", value: "23", sub: "of 142 total", color: "text-foreground" },
            ].map((card, i) => (
              <motion.div key={card.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                      <card.icon className="h-3.5 w-3.5" />
                      {card.label}
                    </div>
                    <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ECL Methodology */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-3">
              <Brain className="h-3 w-3 mr-1" />
              Methodology
            </Badge>
            <h2 className="text-3xl font-bold mb-4">How the ECL Engine Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A multi-signal scoring model inspired by ASC 326 (CECL) and IFRS 9
              simplified approach — purpose-built for accounts receivable teams.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Collectability Score */}
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Collectability Score (0–100)</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Each invoice gets a composite score from four weighted signals:
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Aging Penalty", pct: "40%", desc: "Days Past Due buckets — older = higher penalty" },
                    { label: "Behavioral Penalty", pct: "25%", desc: "Avg days-to-pay, payment consistency history" },
                    { label: "Status Penalty", pct: "20%", desc: "Disputes, payment plans, partial payments" },
                    { label: "Engagement Boost", pct: "15%", desc: "Active conversations reduce risk; silence increases it" },
                  ].map((signal) => (
                    <div key={signal.label} className="flex items-start gap-3">
                      <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">{signal.pct}</Badge>
                      <div>
                        <p className="text-sm font-medium">{signal.label}</p>
                        <p className="text-xs text-muted-foreground">{signal.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ECL Calculation */}
            <Card className="border-destructive/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold">Expected Credit Loss</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  ECL = Outstanding Amount × Probability of Default (PD)
                </p>
                <div className="bg-muted/50 rounded-lg p-4 mb-4 font-mono text-sm">
                  <p className="text-muted-foreground">PD = 1 − (Collectability Score / 100)</p>
                  <p className="text-muted-foreground mt-1">ECL = Amount × PD</p>
                  <p className="text-primary mt-2 font-semibold">Engagement-Adjusted PD:</p>
                  <p className="text-muted-foreground">Active discussion → PD × 0.60 (−40%)</p>
                  <p className="text-muted-foreground">No response → PD × 1.50 (+50%)</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Engagement signals from inbound AI conversations dynamically adjust
                  the probability of default, ensuring active debtors aren't over-reserved.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Risk Tiers */}
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-center mb-6">Risk Classification Tiers</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { tier: "Low Risk", range: "80–100", color: "bg-green-500", textColor: "text-green-700", bgColor: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800" },
                { tier: "Moderate", range: "60–79", color: "bg-yellow-500", textColor: "text-yellow-700", bgColor: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800" },
                { tier: "At Risk", range: "40–59", color: "bg-orange-500", textColor: "text-orange-700", bgColor: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800" },
                { tier: "High Risk", range: "< 40", color: "bg-red-500", textColor: "text-red-700", bgColor: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800" },
              ].map((t) => (
                <div key={t.tier} className={`p-4 rounded-lg ${t.bgColor} border ${t.border} text-center`}>
                  <div className={`w-3 h-3 rounded-full ${t.color} mx-auto mb-2`} />
                  <p className={`font-semibold text-sm ${t.textColor}`}>{t.tier}</p>
                  <p className="text-xs text-muted-foreground">Score {t.range}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Overview */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What You Get</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: "Portfolio-Level ECL Dashboard", desc: "Total AR, overdue breakdown, average collectability, and engagement-adjusted ECL — all in one view." },
              { icon: PieChart, title: "Risk Distribution Analytics", desc: "See how your invoices distribute across Low, Moderate, At Risk, and High Risk tiers at a glance." },
              { icon: Brain, title: "AI Insights & Reserve Guidance", desc: "AI-generated summaries with recommended reserve amounts and supporting rationale for auditors." },
              { icon: FileText, title: "PDF & CSV Export", desc: "Print-optimized reserve reports and granular debtor/invoice-level CSV exports for finance teams." },
              { icon: Users, title: "Engagement-vs-Risk Matrix", desc: "Correlate debtor engagement signals with risk scores to prioritize outreach where it matters." },
              { icon: Clock, title: "Automated Recalculation", desc: "Scores recalculate on every invoice change, payment, or inbound conversation — always current." },
            ].map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full">
                  <CardContent className="p-6">
                    <f.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI / Value Proposition */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">The Cost of Not Knowing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Companies that lack real-time risk visibility over-reserve by 15–30%
              or worse — write off receivables they could have collected.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, stat: "34%", label: "Faster bad-debt detection", desc: "Identify at-risk invoices before they age past recovery." },
              { icon: DollarSign, stat: "2.3×", label: "Better reserve accuracy", desc: "Engagement-adjusted ECL prevents over-reserving on active conversations." },
              { icon: CheckCircle2, stat: "60%", label: "Less time on reserve reports", desc: "Auto-generated PDF reports with AI rationale replace manual spreadsheet work." },
            ].map((item, i) => (
              <motion.div key={item.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-4xl font-bold text-primary mb-1">{item.stat}</p>
                  <p className="font-semibold mb-2">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Stop Guessing. Start Protecting Revenue.
          </h2>
          <p className="text-muted-foreground mb-8">
            Get your first Revenue Risk report within minutes of importing your invoices.
            No credit card required to start.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/signup">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default RevenueRiskFeature;
