import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export const DemoDrafts = () => {
  const { drafts, startSending, nextStep } = useDemoContext();

  const pending = drafts.filter(d => d.status === "pending_approval");
  const bucketGroups = pending.reduce((acc, d) => {
    acc[d.aging_bucket] = acc[d.aging_bucket] || [];
    acc[d.aging_bucket].push(d);
    return acc;
  }, {} as Record<string, typeof pending>);

  const handleSend = () => {
    startSending();
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <CheckCircle2 className="h-10 w-10 text-accent mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground">{drafts.length} Drafts Ready</h1>
        <p className="text-muted-foreground">Personalized outreach generated for all overdue invoices</p>
      </div>

      <div className="space-y-4 max-w-4xl mx-auto">
        {Object.entries(bucketGroups).slice(0, 4).map(([bucket, items]) => (
          <motion.div key={bucket} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {bucket === "current" ? "Current" : `${bucket} Days Past Due`}
                  <Badge variant="secondary" className="ml-auto">{items.length} drafts</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.slice(0, 2).map(draft => (
                  <div key={draft.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary">Agent {draft.persona}</span>
                      <span className="text-xs text-muted-foreground">→ {draft.customer_name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">Pending</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{draft.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{draft.body.split("\n")[0]}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center pt-4">
        <Button size="lg" onClick={handleSend} className="text-lg px-8 py-6 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg">
          <Send className="h-5 w-5 mr-2" /> Approve & Send All
        </Button>
        <p className="text-sm text-muted-foreground mt-2">Watch automated outreach in action</p>
      </motion.div>
    </div>
  );
};
