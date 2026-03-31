import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Mail, CheckCircle2, Eye, Clock, MessageSquare, Send } from "lucide-react";

export const DemoOutreachHistory = () => {
  const { drafts, sentCount, nextStep } = useDemoContext();
  const sentDrafts = drafts.filter(d => d.status === "sent");

  // Simulated timeline events
  const timeline = sentDrafts.slice(0, 10).map((draft, i) => {
    const events = ["sent", "delivered", "opened", "replied"];
    const eventIdx = i < 3 ? 3 : i < 6 ? 2 : i < 8 ? 1 : 0;
    return {
      draft,
      latestEvent: events[eventIdx],
      timestamp: `${Math.floor(Math.random() * 55) + 1}m ago`,
      opened: eventIdx >= 2,
      replied: eventIdx >= 3,
    };
  });

  const openRate = Math.round((timeline.filter(t => t.opened).length / Math.max(timeline.length, 1)) * 100);
  const replyRate = Math.round((timeline.filter(t => t.replied).length / Math.max(timeline.length, 1)) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outreach History</h1>
        <p className="text-muted-foreground">
          Full activity timeline — track every email sent, opened, and replied to
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Send, label: "Total Sent", value: sentCount, color: "text-primary" },
          { icon: CheckCircle2, label: "Delivered", value: sentCount, color: "text-accent" },
          { icon: Eye, label: "Open Rate", value: `${openRate}%`, color: "text-blue-500" },
          { icon: MessageSquare, label: "Reply Rate", value: `${replyRate}%`, color: "text-violet-500" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card>
              <CardContent className="p-4 text-center">
                <Icon className={`h-5 w-5 ${color} mx-auto mb-1`} />
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Activity feed */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Activity Timeline</h3>
          <div className="space-y-3">
            {timeline.map((item, i) => (
              <motion.div
                key={item.draft.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.replied ? "bg-accent/10 text-accent" :
                    item.opened ? "bg-blue-500/10 text-blue-500" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {item.draft.persona[0]}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{item.draft.customer_name}</p>
                    <Badge variant={
                      item.replied ? "default" :
                      item.opened ? "secondary" : "outline"
                    } className="text-[10px] shrink-0">
                      {item.replied ? "Replied" : item.opened ? "Opened" : "Sent"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.draft.subject}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {item.timestamp}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Watch Payments <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
