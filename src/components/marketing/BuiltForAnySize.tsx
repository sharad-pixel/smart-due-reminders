import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, HeartHandshake, DollarSign, ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * BuiltForAnySize
 * Homepage section that frames Recouply as accessible to businesses of every size —
 * leading with small businesses & early-stage SaaS, blending three angles:
 *   - Affordability & accessibility
 *   - Founder/operator empathy
 *   - Speed to value
 */

const pillars = [
  {
    icon: DollarSign,
    eyebrow: "Affordable",
    title: "AI agents at a price any business can afford",
    body: "No enterprise contract. No collections team to hire. Plans that fit a small business cash flow — with the same AI agents that power global RevOps teams.",
  },
  {
    icon: HeartHandshake,
    eyebrow: "Founder-Built",
    title: "Built by founders for founders chasing cash",
    body: "We know what it feels like to stare at an overdue invoice while shipping the next release. Recouply chases the cash so you can stay focused on your customers and product.",
  },
  {
    icon: Zap,
    eyebrow: "Fast",
    title: "Live in minutes, recovering cash today",
    body: "Connect Stripe, QuickBooks, or a Google Sheet. Six AI agents take over follow-ups, replies, and risk scoring before your next stand-up.",
  },
];

const audiences = [
  {
    label: "Small Businesses",
    line: "Your first AR hire — for less than a phone bill.",
  },
  {
    label: "Early-Stage SaaS",
    line: "Recover ARR leakage without burning out your CSMs.",
  },
  {
    label: "Scaling Teams",
    line: "Grow into enterprise governance — no replatforming.",
  },
];

const BuiltForAnySize = () => {
  const navigate = useNavigate();

  return (
    <section className="relative py-24 px-4 overflow-hidden bg-gradient-to-b from-background via-primary/[0.03] to-background">
      {/* Ambient backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-3xl rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            For Businesses of Every Size
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 tracking-tight">
            Your business — at any size — can now have{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI collections agents
            </span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Recouply was built for the small business owner, the early-stage SaaS founder, and the RevOps leader at scale. Same six AI agents. Same customer-safe tone. Live in minutes, no collections team required.
          </p>
        </motion.div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative rounded-2xl border border-border/60 bg-card p-7 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-5 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-mono mb-2">
                  {p.eyebrow}
                </div>
                <h3 className="text-lg font-semibold mb-2.5 leading-snug">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Audience strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-accent/[0.04] p-8 md:p-10"
        >
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {audiences.map((a) => (
              <div key={a.label} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm mb-1">{a.label}</div>
                  <div className="text-sm text-muted-foreground">{a.line}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-6 border-t border-border/40">
            <p className="text-sm text-muted-foreground mr-2">
              7-day free trial · No collections team required
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/smb")} variant="outline" className="gap-2">
                For Small Business
              </Button>
              <Button onClick={() => navigate("/startups")} className="gap-2">
                For Early-Stage SaaS
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BuiltForAnySize;
