import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Clock, DollarSign } from "lucide-react";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";

export const DemoEmailGate = () => {
  const { setDemoEmail, nextStep } = useDemoContext();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setDemoEmail(email);
    nextStep();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full space-y-8"
      >
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="flex justify-center"
          >
            <RecouplyLogo size="xl" animated />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            AI-Agentic Revenue Recovery
          </h1>
          <p className="text-muted-foreground text-lg">
            See how six intelligent AI agents eliminate manual follow-ups — delivering consistent revenue procurement and healthy cash flow, on autopilot.
          </p>
        </div>

        <Card className="border-primary/20">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className="h-12 text-base"
                />
                {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full h-12 text-base">
                Start Interactive Demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Clock, label: "Always-on AI agents" },
            { icon: Shield, label: "Zero manual follow-ups" },
            { icon: DollarSign, label: "Predictable cash flow" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="text-center">
              <Icon className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Share a direct demo link: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">recouply.ai/demo?token=BASE64_EMAIL</code>
        </p>
      </motion.div>
    </div>
  );
};
