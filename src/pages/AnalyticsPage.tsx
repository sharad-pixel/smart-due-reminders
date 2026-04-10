import { Button } from "@/components/ui/button";
import SEOHead from "@/components/seo/SEOHead";
import { useNavigate } from "react-router-dom";
import { BarChart3, ArrowRight, TrendingUp, ShieldAlert, Target, DollarSign, Activity, CreditCard, AlertTriangle, PieChart, Brain, Layers, FileText, CheckCircle, Clock, Eye, Zap } from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const AnalyticsPage = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEOHead
        title="AR Analytics & Risk Scoring | Real-Time Dashboards | Recouply"
        description="Real-time accounts receivable analytics with risk assessment scoring, expansion risk analysis, AR aging dashboards, and AI-powered daily digests."
        keywords="AR analytics, accounts receivable dashboard, risk scoring, expansion risk assessment, AR aging analysis, collection analytics"
      />

      {/* Hero */}
      <section className="py-24 px-4 bg-gradient-to-b from-primary/5 via-background to-background overflow-hidden">
        <div className="container mx-auto text-center max-w-5xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8 border border-primary/20"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Analytics & Risk Intelligence</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
          >
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              See Risk Before It Hits
            </span>
            <br />
            <span className="text-foreground">Your Bottom Line</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto"
          >
            Real-time AR dashboards, AI-powered risk scoring, expansion risk assessment, and 
            daily performance digests — all in one intelligence platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex gap-4 justify-center flex-wrap"
          >
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8 gap-2">
              Start Free Trial <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")} className="text-lg px-8">
              Book a Demo
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Risk Assessment Scoring */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Multi-Dimensional Risk Scoring
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every customer gets a dynamic risk profile based on payment behavior, communication patterns, and financial signals.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Risk Profile Card */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <Card className="shadow-xl border-0 overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm opacity-80">Risk Profile</div>
                        <div className="text-xl font-bold">Acme Corp</div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">72</div>
                        <div className="text-xs opacity-80">Collectability Score</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Payment Score", value: "68", trend: "↓ 4pt" },
                        { label: "Engagement", value: "High", trend: "↑" },
                        { label: "Avg DPD", value: "42d", trend: "→" },
                      ].map((m) => (
                        <div key={m.label} className="bg-muted/50 rounded-lg p-3 text-center">
                          <div className="text-[10px] uppercase text-muted-foreground font-semibold">{m.label}</div>
                          <div className="text-lg font-bold">{m.value}</div>
                          <div className="text-[10px] text-muted-foreground">{m.trend}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Signals</div>
                      {[
                        { signal: "Payment velocity slowing — 38→42 days avg", severity: "warning" },
                        { signal: "3 open invoices totaling $124,500", severity: "info" },
                        { signal: "Last email opened but no response (5 days)", severity: "warning" },
                      ].map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${s.severity === 'warning' ? 'text-orange-500' : 'text-primary'}`} />
                          <span className="text-muted-foreground">{s.signal}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-primary">AI Recommendation</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Escalate to James persona. Consider offering 5% early-pay discount to accelerate resolution on the $84K outstanding.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Components */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="space-y-6"
            >
              <h3 className="text-xl font-bold">How Risk Scores Are Calculated</h3>
              {[
                { icon: DollarSign, title: "Payment Behavior Score", desc: "Analyzes historical payment patterns — average days to pay, consistency, and trend direction across all invoices." },
                { icon: Activity, title: "Engagement Level", desc: "Tracks email opens, responses, portal visits, and communication frequency to gauge debtor responsiveness." },
                { icon: TrendingUp, title: "AI Sentiment Analysis", desc: "Processes inbound email tone and content to detect disputes, stalling, or willingness to pay." },
                { icon: ShieldAlert, title: "Probability of Default", desc: "Combines payment score, engagement, and aging data into an overall ECL (Expected Credit Loss) estimate." },
                { icon: Clock, title: "Historical Trend", desc: "Risk history snapshots capture score changes over time, enabling trend analysis and early warning detection." },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  className="flex gap-4"
                >
                  <div className="bg-primary/10 p-2.5 rounded-lg h-fit shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-0.5">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Expansion Risk Assessment */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Expansion Risk Assessment
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Before extending more credit, know the risk. AI evaluates existing payment behavior to advise on upsells and contract expansions.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <Card className="shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-sm text-muted-foreground">Expansion Advisor</div>
                      <div className="text-lg font-bold">Acme Corp — Contract Renewal</div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                      Moderate Risk
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Current Exposure</div>
                      <div className="text-lg font-bold">$124,500</div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Proposed Expansion</div>
                      <div className="text-lg font-bold text-primary">+$45,000</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {[
                      { label: "Payment History", score: 72, color: "bg-yellow-500" },
                      { label: "Credit Utilization", score: 85, color: "bg-green-500" },
                      { label: "Aging Trend", score: 58, color: "bg-orange-500" },
                    ].map((bar) => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{bar.label}</span>
                          <span className="font-semibold">{bar.score}/100</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${bar.score}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className={`h-full rounded-full ${bar.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">AI Advisory</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommend reducing net terms from NET60 to NET30 for the expansion. Consider bundling 
                      $42K overdue settlement into the new contract to improve overall position.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="space-y-6"
            >
              <h3 className="text-xl font-bold">Why Expansion Scoring Matters</h3>
              <div className="space-y-4">
                {[
                  { icon: ShieldAlert, title: "Prevent Revenue Leakage", desc: "35% reduction in credit losses when expansion decisions are informed by real payment behavior data." },
                  { icon: Target, title: "Data-Driven Credit Decisions", desc: "Replace gut-feel credit approvals with AI-scored risk profiles that combine payment history, aging trends, and engagement." },
                  { icon: CreditCard, title: "Smarter Contract Terms", desc: "AI recommends optimal payment terms, deposit requirements, and credit limits based on each customer's risk profile." },
                  { icon: TrendingUp, title: "Bundled Recovery", desc: "2.4x higher recovery when overdue balances are bundled with new contract negotiations, leveraging expansion leverage." },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                    className="flex gap-3"
                  >
                    <div className="bg-primary/10 p-2 rounded-lg h-fit shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-0.5">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AR Dashboards */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Real-Time AR Dashboards
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From aging summaries to daily digests, every metric updates in real time.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              { title: "AR Aging Summary", icon: PieChart, metrics: ["Current, 1-30, 31-60, 61-90, 91-120, 120+", "Per-debtor and portfolio-wide breakdowns", "Upload batch tracking for reconciliation"] },
              { title: "Daily Performance Digest", icon: BarChart3, metrics: ["Total AR outstanding & payments collected", "Portfolio health score with trend indicators", "Subscription usage & invoice allowance tracking"] },
              { title: "Collection Campaign Analytics", icon: Target, metrics: ["Accounts contacted vs. collected", "Amount recovered per campaign", "AI confidence scoring on strategy effectiveness"] },
            ].map((dash, i) => (
              <motion.div
                key={dash.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                      <dash.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold mb-3">{dash.title}</h3>
                    <ul className="space-y-2">
                      {dash.metrics.map((m, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Mock Dashboard Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <Card className="border-primary/20">
              <CardContent className="p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: "Total AR Outstanding", value: "$2.4M", change: "+12%", icon: DollarSign },
                    { label: "Avg Days Past Due", value: "34 days", change: "-8%", icon: Clock, positive: true },
                    { label: "Collection Rate", value: "87.3%", change: "+4.2%", icon: TrendingUp, positive: true },
                    { label: "High Risk Accounts", value: "12", change: "-3", icon: ShieldAlert, positive: true },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                      className="text-center"
                    >
                      <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <stat.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                      <div className={`text-xs font-semibold ${stat.positive ? 'text-green-600' : 'text-orange-500'}`}>
                        {stat.change}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Invoice Template Integration */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="order-2 md:order-1"
            >
              <Card className="shadow-xl border-0 overflow-hidden">
                <CardContent className="p-6">
                  <div className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Invoice Template Preview
                  </div>
                  <div className="border rounded-lg p-4 bg-white text-black text-xs space-y-3">
                    <div className="flex justify-between">
                      <div>
                        <div className="w-20 h-5 bg-primary/20 rounded mb-1" />
                        <div className="text-[10px] text-gray-500">Your Company Address</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-light text-primary">Invoice</div>
                        <div className="text-[10px] font-semibold">#INV-00665</div>
                      </div>
                    </div>
                    <div className="bg-primary text-white text-[8px] font-bold uppercase px-2 py-1 rounded-t grid grid-cols-3">
                      <span>Description</span><span className="text-center">Date</span><span className="text-right">Amount</span>
                    </div>
                    <div className="border-x border-b rounded-b px-2 py-1.5 grid grid-cols-3 text-[10px]">
                      <span>Annual Service Fee</span><span className="text-center">04/10/26</span><span className="text-right">$730,260.92</span>
                    </div>
                    <div className="flex justify-end text-[10px]">
                      <div className="space-y-0.5">
                        <div className="flex justify-between gap-6"><span>Subtotal</span><span>$730,260.92</span></div>
                        <div className="flex justify-between gap-6 font-bold text-primary border-t pt-0.5"><span>Total</span><span>$730,260.92</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <FileText className="h-3 w-3" /> PDF Download
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Layers className="h-3 w-3" /> Public Link
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Zap className="h-3 w-3" /> QR Payments
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="order-1 md:order-2"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <FileText className="h-3.5 w-3.5" />
                ANALYTICS + INVOICING
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                From Data to Collection
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Analytics insights feed directly into your collection workflows. Risk scores inform 
                template tone selection, and branded invoices with payment links close the loop 
                from identification to resolution.
              </p>
              <div className="space-y-3">
                {[
                  "Risk scores auto-assign appropriate AI agent personas",
                  "Branded templates populate with real invoice data",
                  "Public links with PDF download for customer self-service",
                  "QR code payments for instant mobile collection",
                  "Full audit trail from risk detection to payment receipt",
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                    className="flex items-start gap-2"
                  >
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Turn AR Data Into Cash Flow
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              See risk in real time. Act on it automatically. Collect faster.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8 gap-2">
                Start Free Trial <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="text-lg px-8">
                View Pricing
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default AnalyticsPage;
