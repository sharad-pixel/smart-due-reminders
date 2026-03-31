import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export const DemoActivation = () => {
  const { drafts, stats } = useDemoContext();

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block"
        >
          <Sparkles className="h-10 w-10 text-primary mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground">AI Agents Activating...</h1>
        <p className="text-muted-foreground">
          Generating personalized outreach for {stats.overdueCount} overdue invoices
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Drafts Generated</span>
          <span className="text-sm font-bold text-primary">{drafts.length} / {stats.overdueCount}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(drafts.length / stats.overdueCount) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
        {drafts.slice(-6).map((draft, i) => (
          <motion.div
            key={draft.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-primary/10">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {draft.persona[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{draft.customer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{draft.subject}</p>
                </div>
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0 ml-auto" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
