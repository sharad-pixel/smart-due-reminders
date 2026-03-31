import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Upload, CheckCircle2, Database, Users, FileText, CreditCard } from "lucide-react";
import { DemoTutorialCallout, TryItPrompt } from "./DemoTutorialCallout";

export const DemoDataImport = () => {
  const { nextStep, stats } = useDemoContext();
  const [simulated, setSimulated] = useState(false);

  const importTypes = [
    { icon: Users, label: "Accounts", count: 25, desc: "Customer records with contact info" },
    { icon: FileText, label: "Invoices", count: stats.totalInvoices, desc: "Open & overdue invoices with aging" },
    { icon: CreditCard, label: "Payments", count: 18, desc: "Payment history for reconciliation" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 4: Data Import</h1>
        <p className="text-muted-foreground">Import data via CSV, Excel, or direct API sync</p>
      </div>

      <DemoTutorialCallout
        title="Importing Your AR Data"
        description="The Data Center is your hub for importing and managing all accounts receivable data. Support for CSV, Excel, and direct API integrations."
        platformPath="Data Center → Import"
        steps={[
          { title: "Upload your file", description: "Drag and drop a CSV or Excel file, or click to browse. Supported formats: .csv, .xlsx, .xls.", action: "Drag file into upload zone" },
          { title: "Smart column mapping", description: "Recouply auto-detects columns like Invoice Number, Amount, Due Date, Customer Name, and Email. Review and confirm mappings." },
          { title: "Validation & deduplication", description: "The system checks for duplicate invoices, invalid emails, and missing required fields before importing." },
          { title: "RAID assignment", description: "Each imported record gets a unique Recouply Account ID (RAID) for cross-system tracking and reconciliation." },
        ]}
        proTip="Use the Data Center template (downloadable from the import page) to ensure your CSV columns match perfectly on the first try."
      />


      {/* Upload zone */}
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-8 text-center">
          <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Drag & drop your files here</p>
          <p className="text-xs text-muted-foreground mb-4">Supports CSV, XLSX, XLS files</p>
          <TryItPrompt
            label="Simulate a data import"
            description="Click to simulate importing 25 accounts, 75 invoices, and 18 payment records"
            completed={simulated}
            onAction={() => setSimulated(true)}
            actionLabel="Run Import"
          />
        </CardContent>
      </Card>

      {/* Import categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {importTypes.map(({ icon: Icon, label, count, desc }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: simulated ? 1 : 0.6, y: 0 }} transition={{ delay: simulated ? i * 0.2 : 0 }}>
            <Card className={simulated ? "border-accent/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">{label}</span>
                  {simulated && (
                    <Badge variant="default" className="ml-auto text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {count} imported
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {simulated && (
                  <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: i * 0.2, duration: 0.5 }} className="h-1 bg-accent rounded-full mt-3" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {simulated && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Database className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-foreground">Import Complete</p>
                <p className="text-xs text-muted-foreground">All data has been mapped, validated, and assigned Recouply IDs (RAID)</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>Next: Revenue Risk Analysis <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};
