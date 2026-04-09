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
      subtitle: "AI-Powered Collections CRM From Day One",
      items: [
        "Centralize every receivable in one system of record",
        "AI-powered collections workflows eliminate missed payments",
        "Risk-based prioritization — work the right accounts first",
        "Full audit trail of every outreach and outcome",
      ],
      route: "/startups",
      popular: false,
    },
    {
      icon: Building2,
      title: "For SMBs",
      subtitle: "Collections CRM With Risk-Based Prioritization",
      items: [
        "24/7 AI-powered collections workflows and follow-ups",
        "AI agents read and respond to customer emails",
        "Risk scoring reduces DSO by 35–50%",
        "Complete audit trail — no more gaps in collections history",
      ],
      route: "/smb",
      popular: true,
    },
    {
      icon: Building,
      title: "For Enterprise",
      subtitle: "Enterprise Collections CRM Across Finance, Sales & RevOps",
      items: [
        "Agents trained on Salesforce RCA, CS Cases, NetSuite data",
        "AI-powered collections workflows with risk-aware routing",
        "Predictive early-warning revenue risk intelligence",
        "Enterprise governance, full audit trails, and compliance",
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
            Collections & Risk CRM
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            AI-Powered Collections CRM Built for Your Scale
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Centralized receivables management with AI-powered collections workflows — so your team focuses on cash outcomes, not manual follow-ups
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Risk-based prioritization, full audit trail, and consistent execution at every scale
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
