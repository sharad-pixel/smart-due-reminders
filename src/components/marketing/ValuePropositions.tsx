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
      title: "For Startups",
      subtitle: "AI Agents That Recover Revenue From Day One",
      items: [
        "Deploy agents to automate 100% of invoice follow-up",
        "Eliminate missed payments and cash flow gaps",
        "AI handles all outreach — zero headcount needed",
        "Purpose-built for teams with <10 employees",
      ],
      route: "/startups",
      popular: false,
    },
    {
      icon: Building2,
      title: "For SMBs",
      subtitle: "Agentic Revenue Recovery, Human-Approved",
      items: [
        "24/7 autonomous follow-up, reminders, and escalations",
        "AI agents read and respond to debtor emails",
        "Revenue risk scoring reduces DSO by 35–50%",
        "No more overdue balances slipping through the cracks",
      ],
      route: "/smb",
      popular: true,
    },
    {
      icon: Building,
      title: "For Enterprise",
      subtitle: "Agentic AI That Scales Across Finance, Sales & RevOps",
      items: [
        "Agents trained on Salesforce RCA, CS Cases, NetSuite data",
        "Full invoice-volume automation with risk-aware routing",
        "Predictive early-warning revenue risk intelligence",
        "Enterprise governance, audit trails, and compliance",
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
            Agentic Revenue Recovery
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            AI Agents Built for Your Revenue Scale
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Autonomous AI agents that handle the repetitive work of revenue recovery — so your team focuses on strategy, not follow-ups
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Consistent execution, strengthened cash flow, and zero manual effort on repeatable tasks
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
