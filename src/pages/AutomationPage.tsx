import { Button } from "@/components/ui/button";
import SEOHead from "@/components/seo/SEOHead";
import { useNavigate } from "react-router-dom";
import { Zap, ArrowRight, Mail, Clock, Bot, FileText, Shield, CheckCircle, BarChart3, Settings, Workflow, RefreshCw, Send, Eye, Layers, Target } from "lucide-react";
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

const AutomationPage = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEOHead
        title="AR Automation | AI Workflow & Outreach Engine | Recouply"
        description="Automate accounts receivable workflows with AI-powered outreach, smart escalation cadences, branded invoice templates, and autonomous collection agents."
        keywords="AR automation, accounts receivable automation, collection workflow automation, AI outreach engine, invoice template builder"
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
            <Zap className="h-5 w-5" />
            <span>Workflow & Outreach Automation</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
          >
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Automate Collections
            </span>
            <br />
            <span className="text-foreground">From First Reminder to Resolution</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto"
          >
            Build aging-bucket workflows with AI agents that craft personalized outreach, 
            escalate intelligently, and send branded invoices — all without manual intervention.
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

      {/* Workflow Engine */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Aging-Bucket Workflow Engine
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Configure multi-step outreach cadences per aging bucket. Each step maps to an AI agent persona with escalating tone.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-6 gap-3 mb-12"
          >
            {[
              { label: "1–30 Days", agent: "Sam", tone: "Friendly", color: "bg-green-500" },
              { label: "31–60 Days", agent: "James", tone: "Professional", color: "bg-yellow-500" },
              { label: "61–90 Days", agent: "Katy", tone: "Firm", color: "bg-orange-500" },
              { label: "91–120 Days", agent: "Jimmy", tone: "Serious", color: "bg-red-500" },
              { label: "121–150 Days", agent: "Troy", tone: "Final Warning", color: "bg-red-700" },
              { label: "150+ Days", agent: "Rocco", tone: "Collections", color: "bg-red-900" },
            ].map((bucket, i) => (
              <motion.div key={bucket.label} variants={fadeUp} custom={i}>
                <Card className="relative overflow-hidden h-full">
                  <div className={`h-1.5 ${bucket.color}`} />
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{bucket.label}</div>
                    <div className="text-lg font-bold">{bucket.agent}</div>
                    <div className="text-xs text-muted-foreground">{bucket.tone}</div>
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-primary">
                      <Bot className="h-3 w-3" />
                      <span>3 Steps</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Workflow Step Detail */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <Card className="border-primary/20">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Workflow className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">How Each Step Works</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-8">
                  {[
                    { icon: Clock, title: "Cadence Scheduling", desc: "Day offsets (0, 7, 14) trigger steps relative to when an invoice enters the bucket — not total days past due." },
                    { icon: Bot, title: "AI Draft Generation", desc: "Each step generates a personalized draft using the assigned persona, debtor context, and invoice details. Templates support {{variables}}." },
                    { icon: Send, title: "Auto-Send or Review", desc: "Approved drafts send automatically within 24 hours. Flag steps as 'requires review' for human-in-the-loop control." },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="bg-muted p-2 rounded-lg h-fit">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Three-Phase Engine */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Three-Phase Outreach Engine
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every automated run executes three phases to ensure precision and reliability.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                phase: "Phase 1",
                title: "Cancellation",
                icon: Shield,
                desc: "Scans for paid, canceled, or voided invoices and automatically cancels any pending drafts. Prevents embarrassing follow-ups on resolved accounts.",
                color: "text-red-500",
                bg: "bg-red-500/10",
              },
              {
                phase: "Phase 2",
                title: "Generation",
                icon: RefreshCw,
                desc: "Scans a 7-day forward window to pre-generate drafts for upcoming cadence milestones. Includes batch catch-up for any missed steps.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                phase: "Phase 3",
                title: "Transmission",
                icon: Send,
                desc: "Executes sending for all outreach scheduled within the next 24 hours, including overdue items. Every run is logged with metrics.",
                color: "text-green-500",
                bg: "bg-green-500/10",
              },
            ].map((phase, i) => (
              <motion.div
                key={phase.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
              >
                <Card className="h-full border-2 hover:border-primary/30 transition-colors">
                  <CardContent className="p-8">
                    <div className={`${phase.bg} w-14 h-14 rounded-xl flex items-center justify-center mb-4`}>
                      <phase.icon className={`h-7 w-7 ${phase.color}`} />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{phase.phase}</div>
                    <h3 className="text-xl font-bold mb-3">{phase.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{phase.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Invoice Template Builder */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <FileText className="h-3.5 w-3.5" />
                NEW FEATURE
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Branded Invoice Templates
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Design professional invoices with your brand colors, logo, and payment instructions. 
                Generate shareable public links with QR codes for Venmo, PayPal, CashApp, and Stripe. 
                Every template is live-previewable and auto-populates with real invoice data.
              </p>
              <div className="space-y-3">
                {[
                  "Custom header colors, fonts (Modern / Classic / Minimal)",
                  "Scan-to-Pay QR codes with official brand logos",
                  "Wire/ACH and check payment instructions",
                  "Public shareable links with one-click PDF download",
                  "Live preview with actual invoice data from your account",
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
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

            {/* Mock Invoice Preview */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <Card className="shadow-xl border-0 overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="w-24 h-6 bg-primary/20 rounded mb-2" />
                      <div className="text-xs text-muted-foreground">123 Business Ave</div>
                      <div className="text-xs text-muted-foreground">(555) 123-4567</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-light text-primary">Invoice</div>
                      <div className="text-sm font-semibold">#INV-2024-0042</div>
                    </div>
                  </div>
                  <div className="bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-t grid grid-cols-3">
                    <span>Description</span>
                    <span className="text-center">Date</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="border-x border-b rounded-b px-3 py-2 text-xs grid grid-cols-3">
                    <span>Annual Service Fee</span>
                    <span className="text-center">04/10/2026</span>
                    <span className="text-right font-semibold">$12,500.00</span>
                  </div>
                  <div className="flex justify-end mt-3">
                    <div className="text-right text-xs space-y-1">
                      <div className="flex justify-between gap-8">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>$12,500.00</span>
                      </div>
                      <div className="flex justify-between gap-8 font-bold text-primary border-t pt-1">
                        <span>Total</span>
                        <span>$12,500.00</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 pt-3 border-t">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center text-[8px] text-muted-foreground">QR</div>
                      <span className="text-[9px] text-muted-foreground">Venmo</span>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center text-[8px] text-muted-foreground">QR</div>
                      <span className="text-[9px] text-muted-foreground">PayPal</span>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center text-[8px] text-muted-foreground">QR</div>
                      <span className="text-[9px] text-muted-foreground">Stripe</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="inline-block px-6 py-2 rounded-lg bg-primary text-white text-xs font-semibold">
                      Pay Now
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Smart Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Built-In Intelligence at Every Step
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Mail, title: "Inbound Email AI", desc: "Reads customer replies, creates tasks, and routes responses to the right workflow step automatically." },
              { icon: Eye, title: "Draft Preview & Approval", desc: "Review AI-generated drafts before sending. Edit tone, swap personas, or approve in bulk." },
              { icon: Settings, title: "Workflow Health Monitoring", desc: "Proactive alerts flag templates with short text, missing subjects, or incomplete drafts." },
              { icon: Layers, title: "Multi-Channel Outreach", desc: "Email, SMS, and letter channels per workflow step. Each channel has its own template." },
              { icon: Target, title: "Bounce & Engagement Tracking", desc: "Tracks delivery, opens, and bounces. Auto-pauses outreach on hard bounces and resumes when emails update." },
              { icon: BarChart3, title: "Batch Run History", desc: "Every automated run is logged with metrics: drafts generated, sent, failed. Full audit trail in the outreach dashboard." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
              Stop Chasing. Start Collecting.
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Set up your first automated workflow in under 5 minutes. No collection agency needed.
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

export default AutomationPage;
