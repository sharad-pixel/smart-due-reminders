import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Target, ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5 },
  }),
};

export default function RevenueRiskTeaser() {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">
              <Shield className="h-3 w-3 mr-1" /> Revenue Risk Intelligence
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Predict Credit Losses{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Before They Happen
              </span>
            </h2>
            <p className="text-muted-foreground mb-6 text-lg">
              Our AI-powered ECL engine scores every invoice for collectability,
              calculates expected credit loss aligned to ASC 326 &amp; IFRS 9,
              and dynamically adjusts risk based on debtor engagement signals.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Collectability Score (0–100) per invoice",
                "Engagement-adjusted Probability of Default",
                "Auto-generated reserve reports for auditors",
                "Real-time risk recalculation on every event",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild>
              <Link to="/features/revenue-risk">
                Learn More <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          {/* Right — mini dashboard preview */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
            <div className="bg-card border rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">Revenue Risk Overview</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Total AR", value: "$847K", icon: "💰", color: "text-foreground" },
                  { label: "Overdue", value: "$312K", icon: "⏰", color: "text-orange-600" },
                  { label: "ECL", value: "$48.2K", icon: "⚠️", color: "text-red-600" },
                  { label: "Adj. ECL", value: "$31.7K", icon: "🤝", color: "text-amber-600" },
                ].map((m) => (
                  <div key={m.label} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{m.icon} {m.label}</p>
                    <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              {/* Risk distribution bar */}
              <p className="text-xs text-muted-foreground mb-1">Risk Distribution</p>
              <div className="flex h-3 rounded-full overflow-hidden mb-2">
                <div className="bg-green-500 w-[45%]" />
                <div className="bg-yellow-500 w-[25%]" />
                <div className="bg-orange-500 w-[18%]" />
                <div className="bg-red-500 w-[12%]" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Low 45%</span>
                <span>Moderate 25%</span>
                <span>At Risk 18%</span>
                <span>High 12%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
