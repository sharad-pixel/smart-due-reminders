import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Link2,
  Zap,
  CreditCard,
  Gauge,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface RiskAndPayLinksSectionProps {
  /** Industry-specific lead-in line shown under the section title */
  audienceLabel?: string;
  /** Where the primary CTA should send the user */
  ctaHref?: string;
  ctaLabel?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45 },
  }),
};

export default function RiskAndPayLinksSection({
  audienceLabel = "For every account, every invoice, every customer",
  ctaHref = "/signup",
  ctaLabel = "Start Free Trial",
}: RiskAndPayLinksSectionProps) {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            <Sparkles className="h-3 w-3 mr-1" /> New in Recouply.ai
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Score Every Account. Get Paid in{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              One Click.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {audienceLabel}. Recouply now combines AI-powered Revenue Risk
            Assessments with on-demand payment links — so you know who's at
            risk before they slip, and customers can settle invoices instantly
            with the payment method of their choice.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Risk Assessment Card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
          >
            <Card className="h-full border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  AI Revenue Risk Assessments
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Every account and invoice is scored 0–100 for collectability,
                  with an Expected Credit Loss estimate aligned to ASC 326 &
                  IFRS 9. Risk recalculates in real time as customers engage
                  (or don't) with your outreach.
                </p>
                <ul className="space-y-2 text-sm">
                  {[
                    "Per-invoice Collectability Score",
                    "Engagement-adjusted Probability of Default",
                    "ECL & reserve reports your CFO can stand behind",
                    "Auto-flag high-risk accounts before they go delinquent",
                  ].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Links Card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
          >
            <Card className="h-full border-primary/20 bg-gradient-to-br from-accent/5 to-transparent">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Link2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  One-Click Payment Links on Every Invoice
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Generate a secure payment link for any invoice in seconds.
                  Embed it in outreach emails, share it directly, or let
                  customers pay from your branded portal — using the method
                  they prefer.
                </p>
                <ul className="space-y-2 text-sm">
                  {[
                    "Card, ACH, Stripe, PayPal, Venmo & QR code support",
                    "Auto-embedded in every AI-generated reminder",
                    "Branded payment portal — no logins, no friction",
                    "Payments auto-reconcile to the original invoice",
                  ].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Outcome strip */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={3}
        >
          <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                {[
                  {
                    icon: Gauge,
                    title: "Predict",
                    body: "AI scores every account so you know which invoices need a nudge — and which need a serious conversation.",
                  },
                  {
                    icon: Zap,
                    title: "Reach Out",
                    body: "Six AI agents send risk-aware reminders 24/7, each one carrying a one-click payment link.",
                  },
                  {
                    icon: CreditCard,
                    title: "Get Paid",
                    body: "Customers pay in seconds with the method they prefer — and the payment auto-clears the invoice.",
                  },
                ].map((step) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <step.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg">
                  <Link to={ctaHref}>
                    {ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/features/revenue-risk">
                    See Risk Intelligence
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
