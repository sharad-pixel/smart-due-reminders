import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, AlertTriangle, TrendingUp, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";

export const DemoOverview = () => {
  const { stats, agingBuckets, activateCollections, nextStep } = useDemoContext();

  const bucketColors: Record<string, string> = {
    current: "bg-accent/10 text-accent border-accent/20",
    "1-30": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    "31-60": "bg-orange-500/10 text-orange-600 border-orange-500/20",
    "61-90": "bg-red-500/10 text-red-600 border-red-500/20",
    "91-120": "bg-red-600/10 text-red-700 border-red-600/20",
    "120+": "bg-destructive/10 text-destructive border-destructive/20",
  };

  const personaMap: Record<string, string> = {
    current: "Sam", "1-30": "Sam", "31-60": "James",
    "61-90": "Katy", "91-120": "Troy", "120+": "Rocco",
  };

  const handleActivate = () => {
    activateCollections();
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-sm font-medium text-primary uppercase tracking-wider">
          Your AR at a Glance
        </motion.p>
        <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="text-4xl md:text-5xl font-bold text-foreground">
          ${stats.totalOverdue.toLocaleString()}{" "}<span className="text-destructive">Overdue</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-muted-foreground text-lg">
          This is money currently at risk across {stats.overdueCount} invoices
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-5 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold text-destructive">${stats.totalOverdue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Overdue</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="p-5 text-center">
              <TrendingUp className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold text-accent">
                ${stats.estimatedRecoverableRange.low.toLocaleString()} – ${stats.estimatedRecoverableRange.high.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Estimated Recoverable</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">{stats.overdueCount}</p>
              <p className="text-sm text-muted-foreground">Invoices Needing Outreach</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Aging Buckets — Each Handled by an AI Agent
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(agingBuckets).map(([bucket, data], i) => (
            <motion.div key={bucket} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.08 }}>
              <Card className={`border ${bucketColors[bucket] || ""}`}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1">
                    {bucket === "current" ? "Current" : `${bucket} DPD`}
                  </p>
                  <p className="text-xl font-bold">{data.count}</p>
                  <p className="text-xs text-muted-foreground">${Math.round(data.total).toLocaleString()}</p>
                  <p className="text-[10px] mt-1 font-medium opacity-70">Agent: {personaMap[bucket]}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }} className="text-center pt-4">
        <Button size="lg" onClick={handleActivate}
          className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all">
          <Zap className="h-5 w-5 mr-2" /> Activate AI Collections
        </Button>
        <p className="text-sm text-muted-foreground mt-3">
          Watch your overdue invoices get automated outreach instantly
        </p>
      </motion.div>
    </div>
  );
};
