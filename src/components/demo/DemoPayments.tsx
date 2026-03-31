import { useEffect } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, CheckCircle2, ArrowDown, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { DemoTutorialCallout } from "./DemoTutorialCallout";

export const DemoPayments = () => {
  const { simulatePayments, paidInvoiceIds, recoveredAmount, invoices, isAnimating, nextStep } = useDemoContext();

  useEffect(() => {
    if (paidInvoiceIds.length === 0) {
      const timer = setTimeout(() => simulatePayments(), 600);
      return () => clearTimeout(timer);
    }
  }, [simulatePayments, paidInvoiceIds.length]);

  const paidInvoices = invoices.filter(i => paidInvoiceIds.includes(i.id));
  const done = !isAnimating && paidInvoices.length >= 3;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <DollarSign className="h-12 w-12 text-accent mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground">Step 12: Payments Coming In!</h1>
        <p className="text-muted-foreground">Customers are responding to AI outreach</p>
      </div>

      <DemoTutorialCallout
        title="How Payment Recovery Works"
        description="When customers pay after receiving AI outreach, Recouply detects the payment via your connected billing system and automatically updates the invoice status."
        variant="action"
        steps={[
          { title: "Payment detection", description: "Stripe/QuickBooks webhooks notify Recouply instantly when a payment is received. Invoice status updates to 'Paid' automatically." },
          { title: "Attribution tracking", description: "Recouply attributes each payment to the specific outreach message that triggered it — giving you clear ROI data." },
          { title: "Workflow adjustment", description: "Once paid, remaining scheduled outreach for that invoice is automatically cancelled. No embarrassing follow-ups after payment." },
          { title: "Recovery dashboard", description: "Track total recovered cash, recovery rate, and time-to-payment across your entire portfolio." },
        ]}
      />

      <div className="text-center">
        <motion.p key={recoveredAmount} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-5xl font-bold text-accent">${recoveredAmount.toLocaleString()}</motion.p>
        <p className="text-muted-foreground mt-1">Recovered So Far</p>
      </div>

      <div className="max-w-lg mx-auto space-y-3">
        {paidInvoices.map((inv, i) => (
          <motion.div key={inv.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.3, type: "spring", stiffness: 200 }}>
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="p-4 flex items-center gap-4">
                <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{inv.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{inv.invoice_number}</p>
                </div>
                <p className="text-lg font-bold text-accent">+${inv.amount.toLocaleString()}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {isAnimating && paidInvoices.length < 3 && (
          <div className="text-center py-4">
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1 }}>
              <ArrowDown className="h-6 w-6 text-muted-foreground mx-auto" />
            </motion.div>
            <p className="text-sm text-muted-foreground mt-1">Waiting for payments...</p>
          </div>
        )}
      </div>

      {done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-4">
          <Button size="lg" onClick={nextStep}>Next: Export Data <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </motion.div>
      )}
    </div>
  );
};
