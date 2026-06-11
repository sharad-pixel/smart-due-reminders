import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, Building2, Building, CheckCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" },
  }),
};

const ValuePropositions = () => {
  const navigate = useNavigate();

  const tiers = [
    {
      icon: Rocket,
      title: "Small Businesses",
      subtitle: "Your first AR hire — at a fraction of the cost",
      items: [
        "Live in minutes — connect Stripe, QuickBooks, or a spreadsheet",
        "AI agents send polite, on-brand reminders 24/7",
        "No collections team required — one founder, six AI agents",
        "Affordable monthly plans built for small business cash flow",
      ],
      route: "/smb",
      popular: false,
    },
    {
      icon: Rocket,
      title: "Early-Stage SaaS",
      subtitle: "Built by founders for founders chasing cash",
      items: [
        "Stop CSMs and AEs from chasing payments — let AI do it",
        "Customer-safe tone protects NRR and reduces churn risk",
        "Stripe & Chargebee payment links embedded in every email",
        "Recover ARR leakage before it shows up in your board deck",
      ],
      route: "/startups",
      popular: true,
    },
    {
      icon: Building,
      title: "Scale & Enterprise",
      subtitle: "The same AI agents — with enterprise governance",
      items: [
        "Agents trained on Salesforce, NetSuite, and CS case data",
        "Predictive revenue risk intelligence and early warnings",
        "Risk-aware routing, audit trails, and SOC-ready controls",
        "Grows with you — no replatforming when you scale",
      ],
      route: "/enterprise",
      popular: false,
    },
  ];

  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Built for any size
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            AI Collections Agents — Now Within Reach for Every Business
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            From a one-person shop to an early-stage SaaS team to a global RevOps org — deploy the same AI agents that recover cash, protect customer relationships, and go live in minutes.
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Founder-friendly pricing · Customer-safe tone · No collections team required
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier, idx) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={idx}
                custom={idx}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={cardVariants}
              >
                <Card
                  className={`bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group h-full hover:-translate-y-2 ${
                    tier.popular
                      ? "border-primary/30 shadow-lg relative"
                      : "border-border/50 hover:border-primary/30"
                  }`}
                  onClick={() => navigate(tier.route)}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">Most Popular</span>
                    </div>
                  )}
                  <CardContent className="p-8">
                    <motion.div
                      className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Icon className="h-7 w-7 text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{tier.title}</h3>
                    <p className="text-lg text-muted-foreground mb-6">{tier.subtitle}</p>
                    <ul className="space-y-3 text-sm text-muted-foreground mb-6">
                      {tier.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Button variant="ghost" className="group-hover:text-primary p-0">
                      Learn More <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ValuePropositions;
