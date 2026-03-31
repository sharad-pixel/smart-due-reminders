import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { DemoTutorialCallout } from "./DemoTutorialCallout";

export const DemoSending = () => {
  const { drafts, sentCount, isAnimating, nextStep } = useDemoContext();
  const total = drafts.length;
  const recentlySent = drafts.filter(d => d.status === "sent").slice(-8);
  const done = !isAnimating && sentCount >= total && total > 0;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <Send className="h-10 w-10 text-primary mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground">Step 10: Sending Outreach...</h1>
        <p className="text-muted-foreground">AI agents are delivering personalized emails</p>
      </div>

      <DemoTutorialCallout
        title="What's Happening During Sending"
        description="Each email is sent through Recouply's delivery infrastructure with tracking pixels for open/click detection. Delivery is staggered to avoid spam filters."
        variant="action"
        steps={[
          { title: "Staggered delivery", description: "Emails are sent in small batches (5-10 per minute) to maintain high deliverability and avoid spam filters." },
          { title: "Tracking enabled", description: "Each email includes invisible tracking for open detection, click tracking on payment links, and reply monitoring." },
          { title: "Bounce handling", description: "If an email bounces, Recouply marks the contact as invalid and creates a task to update the email address." },
        ]}
      />

      <div className="max-w-lg mx-auto">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Sent</span>
          <span className="font-bold text-primary">{sentCount} / {total}</span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${total > 0 ? (sentCount / total) * 100 : 0}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">Live Activity</h3>
        {recentlySent.map((draft, i) => (
          <motion.div key={draft.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-accent/20">
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground"><span className="font-medium">{draft.persona}</span> sent to <span className="font-medium">{draft.customer_name}</span></p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">Just now</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-4">
          <Button size="lg" onClick={nextStep}>View Outreach History <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </motion.div>
      )}
    </div>
  );
};
