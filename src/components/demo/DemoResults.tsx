import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Zap, ArrowRight, TrendingDown, DollarSign, ShieldAlert, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, Link as RouterLink } from "react-router-dom";

export const DemoResults = () => {
  const { stats, recoveredAmount, sentCount, drafts, exitDemo } = useDemoContext();
  const navigate = useNavigate();

  const remainingOverdue = stats.totalOverdue - recoveredAmount;
  const doNothingProjection = Math.round(stats.totalOverdue * 0.3); // 30% expected write-off

  const handleConnectStripe = () => {
    exitDemo();
    navigate("/integrations");
  };

  const handleSignup = () => {
    exitDemo();
    navigate("/signup");
  };

  return (
    <div className="space-y-8">
      {/* Celebration */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
        >
          <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-accent" />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-4xl md:text-5xl font-bold text-foreground"
        >
          You just recovered{" "}
          <span className="text-accent">${recoveredAmount.toLocaleString()}</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-lg text-muted-foreground"
        >
          Automatically. With zero manual follow-ups.
        </motion.p>
      </div>

      {/* Summary cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto"
      >
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="p-5 text-center">
            <DollarSign className="h-7 w-7 text-accent mx-auto mb-2" />
            <p className="text-2xl font-bold text-accent">${recoveredAmount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Cash Recovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Zap className="h-7 w-7 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{sentCount}</p>
            <p className="text-sm text-muted-foreground">Emails Sent Automatically</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <TrendingDown className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">${remainingOverdue.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Still Recoverable</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* What if you do nothing */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="max-w-2xl mx-auto"
      >
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">What happens if you do nothing?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on industry data, you could lose up to{" "}
                  <span className="font-bold text-destructive">${doNothingProjection.toLocaleString()}</span>{" "}
                  in write-offs. Invoices older than 90 days have a 50%+ chance of going uncollected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="text-center space-y-4 pt-4"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={handleConnectStripe}
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          >
            Connect Stripe to Recover Real Cash
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleSignup}
            className="text-lg px-8 py-6"
          >
            Run Free Cash Audit
          </Button>
        </div>
        <div className="pt-2">
          <RouterLink to="/onboarding?step=training">
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
              <PlayCircle className="h-4 w-4" />
              Watch Training Videos First
            </Button>
          </RouterLink>
        </div>
        <p className="text-sm text-muted-foreground">
          No credit card required. Set up in under 2 minutes.
        </p>
      </motion.div>
    </div>
  );
};
