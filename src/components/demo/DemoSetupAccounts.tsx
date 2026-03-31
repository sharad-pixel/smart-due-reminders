import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Mail, Globe } from "lucide-react";
import { DemoTutorialCallout, FeatureScreenshot, TryItPrompt } from "./DemoTutorialCallout";
import accountsImg from "@/assets/demo/accounts-entry.jpg";

export const DemoSetupAccounts = () => {
  const { customers, nextStep } = useDemoContext();
  const [showAll, setShowAll] = useState(false);
  const visibleCustomers = showAll ? customers : customers.slice(0, 9);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Step 1: Account Setup</h1>
          <p className="text-muted-foreground">
            Import and manage your customer accounts — the foundation of your collection workflow
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">{customers.length} accounts</Badge>
      </div>

      <DemoTutorialCallout
        title="How Accounts Work in Recouply"
        description="Each account represents a customer with outstanding invoices. Accounts are automatically created when you connect a billing system or import data."
        platformPath="Dashboard → Accounts"
        steps={[
          { title: "Connect a billing source", description: "Link Stripe, QuickBooks, or upload a CSV to auto-create accounts with contact details, industry, and payment history.", action: "Go to Integrations" },
          { title: "Review account profiles", description: "Each account shows company name, primary contact email, industry classification, and total outstanding balance." },
          { title: "AI enrichment", description: "Recouply automatically scores each account's risk level and payment behavior using historical data.", action: "View Risk Scores" },
          { title: "Assign to workflows", description: "Accounts are automatically assigned to AI collection agents based on their aging bucket and risk profile." },
        ]}
        proTip="Accounts sync bi-directionally — payments recorded in Stripe or QuickBooks automatically update in Recouply."
      />

      <FeatureScreenshot
        src={accountsImg}
        alt="Recouply accounts management interface"
        caption="The Accounts view in Recouply — showing company details, contact info, outstanding balances, and risk scores"
      />

      <TryItPrompt
        label="Explore Demo Accounts"
        description={`${customers.length} realistic customer accounts are pre-loaded below. Click any card to see how account profiles work.`}
        completed={showAll}
        onAction={() => setShowAll(true)}
        actionLabel="Show All Accounts"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
        {visibleCustomers.map((c, i) => (
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

      <DemoTutorialCallout
        title="In the real platform"
        description="Accounts sync automatically from Stripe, QuickBooks, or CSV upload. Each account gets a unique Recouply Account ID (RAID) for cross-system tracking."
        variant="tip"
      />

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: View Invoices <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
