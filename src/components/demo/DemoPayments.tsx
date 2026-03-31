import { useEffect } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, CheckCircle2, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";

export const DemoPayments = () => {
  const { simulatePayments, paidInvoiceIds, recoveredAmount, invoices, isAnimating } = useDemoContext();

  useEffect(() => {
    const timer = setTimeout(() => simulatePayments(), 600);
    return () => clearTimeout(timer);
  }, [simulatePayments]);

  const paidInvoices = invoices.filter(i => paidInvoiceIds.includes(i.id));

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <DollarSign className="h-12 w-12 text-accent mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground">Payments Coming In!</h1>
        <p className="text-muted-foreground">Customers are responding to AI outreach</p>
      </div>

      {/* Recovered counter */}
      <div className="text-center">
        <motion.p
          key={recoveredAmount}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="text-5xl font-bold text-accent"
        >
          ${recoveredAmount.toLocaleString()}
        </motion.p>
        <p className="text-muted-foreground mt-1">Recovered So Far</p>
      </div>

      {/* Payment events */}
      <div className="max-w-lg mx-auto space-y-3">
        {paidInvoices.map((inv, i) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.3, type: "spring", stiffness: 200 }}
          >
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
    </div>
  );
};
