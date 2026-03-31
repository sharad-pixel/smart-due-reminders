import { useDemoContext } from "@/contexts/DemoContext";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Mail, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export const DemoSending = () => {
  const { drafts, sentCount } = useDemoContext();
  const total = drafts.length;
  const recentlySent = drafts.filter(d => d.status === "sent").slice(-8);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <Send className="h-10 w-10 text-primary mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground">Sending Outreach...</h1>
        <p className="text-muted-foreground">AI agents are delivering personalized emails</p>
      </div>

      {/* Progress */}
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Sent</span>
          <span className="font-bold text-primary">{sentCount} / {total}</span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${total > 0 ? (sentCount / total) * 100 : 0}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Activity feed */}
      <div className="max-w-2xl mx-auto space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Live Activity
        </h3>
        {recentlySent.map((draft, i) => (
          <motion.div
            key={draft.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-accent/20">
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{draft.persona}</span> sent to{" "}
                    <span className="font-medium">{draft.customer_name}</span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">Just now</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
