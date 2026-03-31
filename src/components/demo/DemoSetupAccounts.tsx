import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Mail, Globe } from "lucide-react";

export const DemoSetupAccounts = () => {
  const { customers, nextStep } = useDemoContext();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Setup</h1>
          <p className="text-muted-foreground">
            {customers.length} customer accounts loaded — just like importing from your billing system
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">{customers.length} accounts</Badge>
      </div>

      <div className="bg-muted/30 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
          <Globe className="h-4 w-4" /> In production, accounts sync automatically from Stripe, QuickBooks, or CSV upload
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto pr-1">
        {customers.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.03, 0.5) }}
          >
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{c.company_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" /> {c.email}
                    </p>
                    <Badge variant="outline" className="text-[10px] mt-1">{c.industry}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: View Invoices <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
