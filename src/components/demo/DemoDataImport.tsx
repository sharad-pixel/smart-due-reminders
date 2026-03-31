import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Upload, FileSpreadsheet, CheckCircle2, Database, Users, FileText, CreditCard } from "lucide-react";

export const DemoDataImport = () => {
  const { nextStep, stats } = useDemoContext();
  const [simulated, setSimulated] = useState(false);

  const handleSimulateImport = () => {
    setSimulated(true);
  };

  const importTypes = [
    { icon: Users, label: "Accounts", count: 25, desc: "Customer records with contact info" },
    { icon: FileText, label: "Invoices", count: stats.totalInvoices, desc: "Open & overdue invoices with aging" },
    { icon: CreditCard, label: "Payments", count: 18, desc: "Payment history for reconciliation" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Import</h1>
        <p className="text-muted-foreground">
          Import data via CSV, Excel, or direct API sync
        </p>
      </div>

      {/* Upload zone */}
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-8 text-center">
          <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Drag & drop your files here</p>
          <p className="text-xs text-muted-foreground mb-4">Supports CSV, XLSX, XLS files</p>
          <Button variant="outline" size="sm" onClick={handleSimulateImport}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {simulated ? "Import Complete!" : "Simulate Import"}
          </Button>
        </CardContent>
      </Card>

      {/* Import categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {importTypes.map(({ icon: Icon, label, count, desc }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: simulated ? 1 : 0.6, y: 0 }}
            transition={{ delay: simulated ? i * 0.2 : 0 }}
          >
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
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: i * 0.2, duration: 0.5 }}
                    className="h-1 bg-accent rounded-full mt-3"
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {simulated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Database className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-foreground">Import Complete</p>
                <p className="text-xs text-muted-foreground">
                  All data has been mapped, validated, and assigned Recouply IDs (RAID)
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Revenue Risk Analysis <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
