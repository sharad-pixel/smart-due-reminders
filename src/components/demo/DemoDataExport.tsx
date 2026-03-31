import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Download, FileSpreadsheet, BarChart3, FileText, Table, CheckCircle2 } from "lucide-react";
import { DemoTutorialCallout, FeatureScreenshot } from "./DemoTutorialCallout";
import exportImg from "@/assets/demo/data-export-entry.jpg";

const EXPORT_OPTIONS = [
  { icon: FileSpreadsheet, label: "Invoice Aging Report", desc: "Full AR aging with Recouply IDs, aging buckets, and risk scores", format: "XLSX", rows: 75 },
  { icon: Table, label: "Account Summary", desc: "Customer accounts with balance, open invoices, and risk tier", format: "CSV", rows: 25 },
  { icon: BarChart3, label: "Outreach Performance", desc: "Email engagement metrics — sent, opened, replied, converted", format: "XLSX", rows: 45 },
  { icon: FileText, label: "Collection Activity Log", desc: "Complete timeline of all collection actions and outcomes", format: "CSV", rows: 128 },
];

export const DemoDataExport = () => {
  const { nextStep } = useDemoContext();
  const [downloaded, setDownloaded] = useState<string[]>([]);

  const handleDownload = (label: string) => {
    setDownloaded(prev => [...prev, label]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 13: Data Export</h1>
        <p className="text-muted-foreground">Export enriched reports with Recouply intelligence — risk scores, aging, and activity</p>
      </div>

      <DemoTutorialCallout
        title="Exporting Your Data"
        description="All reports include Recouply-enriched data: risk scores, aging calculations, outreach history, and source system references for seamless reconciliation."
        platformPath="Data Center → Export"
        steps={[
          { title: "Choose a report type", description: "Select from Invoice Aging, Account Summary, Outreach Performance, or Collection Activity Log." },
          { title: "Configure filters", description: "Filter by date range, aging bucket, risk tier, or specific accounts before exporting." },
          { title: "Download or schedule", description: "Download immediately as CSV/XLSX, or schedule recurring exports (daily/weekly) to email or cloud storage.", action: "Click Export on any report" },
          { title: "API access", description: "For programmatic access, use the Data Center API to pull reports into your BI tools or data warehouse." },
        ]}
        proTip="The Invoice Aging Report includes dynamically calculated aging buckets and RAID references — perfect for your monthly AR review with stakeholders."
      />

      <FeatureScreenshot
        src={exportImg}
        alt="Data export and reports interface"
        caption="The Data Export page — download enriched reports with risk scores and outreach metrics"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXPORT_OPTIONS.map((opt, i) => {
          const isDownloaded = downloaded.includes(opt.label);
          return (
            <motion.div key={opt.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={`hover:border-primary/20 transition-colors ${isDownloaded ? "border-accent/30" : ""}`}>
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
                        <Button variant={isDownloaded ? "ghost" : "outline"} size="sm" className="text-xs h-7" onClick={() => handleDownload(opt.label)}>
                          {isDownloaded ? <><CheckCircle2 className="h-3 w-3 mr-1 text-accent" /> Downloaded</> : <><Download className="h-3 w-3 mr-1" /> Export</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <DemoTutorialCallout
        title="Pro Tip"
        description="All exports include dynamically calculated aging buckets, Recouply Account IDs (RAID), and source system references for seamless reconciliation."
        variant="tip"
      />

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>Next: See Your ROI <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};
