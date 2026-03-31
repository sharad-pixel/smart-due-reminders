import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Download, FileSpreadsheet, BarChart3, FileText, Table } from "lucide-react";

const EXPORT_OPTIONS = [
  {
    icon: FileSpreadsheet,
    label: "Invoice Aging Report",
    desc: "Full AR aging with Recouply IDs, aging buckets, and risk scores",
    format: "XLSX",
    rows: 75,
  },
  {
    icon: Table,
    label: "Account Summary",
    desc: "Customer accounts with balance, open invoices, and risk tier",
    format: "CSV",
    rows: 25,
  },
  {
    icon: BarChart3,
    label: "Outreach Performance",
    desc: "Email engagement metrics — sent, opened, replied, converted",
    format: "XLSX",
    rows: 45,
  },
  {
    icon: FileText,
    label: "Collection Activity Log",
    desc: "Complete timeline of all collection actions and outcomes",
    format: "CSV",
    rows: 128,
  },
];

export const DemoDataExport = () => {
  const { nextStep } = useDemoContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data Export</h1>
        <p className="text-muted-foreground">
          Export enriched reports with Recouply intelligence — risk scores, aging, and activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXPORT_OPTIONS.map((opt, i) => (
          <motion.div
            key={opt.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <opt.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground">{opt.label}</p>
                      <Badge variant="outline" className="text-[10px]">{opt.format}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{opt.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{opt.rows} rows</span>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Download className="h-3 w-3 mr-1" /> Export
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Pro Tip:</span>{" "}
              All exports include dynamically calculated aging buckets, Recouply Account IDs (RAID), and source system references for seamless reconciliation.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: See Your ROI <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
