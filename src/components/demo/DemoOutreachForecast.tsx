import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, CalendarRange, Mail, AlertTriangle, Clock } from "lucide-react";

export const DemoOutreachForecast = () => {
  const { invoices, nextStep } = useDemoContext();
  const overdue = invoices.filter(i => i.status === "overdue");

  // Simulated forecast entries for next 7 days
  const forecastDays = [
    { day: "Today", emails: 12, escalations: 2, bucketChanges: 1 },
    { day: "Tomorrow", emails: 8, escalations: 1, bucketChanges: 0 },
    { day: "Day 3", emails: 15, escalations: 3, bucketChanges: 2 },
    { day: "Day 4", emails: 5, escalations: 0, bucketChanges: 0 },
    { day: "Day 5", emails: 10, escalations: 1, bucketChanges: 1 },
    { day: "Day 6", emails: 7, escalations: 2, bucketChanges: 0 },
    { day: "Day 7", emails: 14, escalations: 4, bucketChanges: 3 },
  ];

  const totalForecast = forecastDays.reduce((sum, d) => sum + d.emails, 0);

  // Sample upcoming outreach
  const upcomingOutreach = overdue.slice(0, 6).map((inv, i) => ({
    invoice: inv,
    scheduledDay: i < 2 ? "Today" : i < 4 ? "Tomorrow" : "Day 3",
    stepLabel: i < 2 ? "Email 1 — Friendly Reminder" : i < 4 ? "Email 2 — Follow-Up" : "Email 3 — Escalation",
    agent: inv.days_past_due <= 30 ? "Sam" : inv.days_past_due <= 60 ? "James" : "Katy",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outreach Forecast</h1>
        <p className="text-muted-foreground">
          Predict and visualize upcoming communications over the next 7 days
        </p>
      </div>

      {/* 7-day forecast */}
      <div className="grid grid-cols-7 gap-2">
        {forecastDays.map((day, i) => (
          <motion.div
            key={day.day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className={i === 0 ? "border-primary/30 bg-primary/5" : ""}>
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">{day.day}</p>
                <p className="text-lg font-bold text-foreground mt-1">{day.emails}</p>
                <p className="text-[10px] text-muted-foreground">emails</p>
                {day.escalations > 0 && (
                  <Badge variant="destructive" className="text-[9px] mt-1">{day.escalations} esc</Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <CalendarRange className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{totalForecast} emails scheduled over 7 days</p>
            <p className="text-xs text-muted-foreground">
              Based on active workflows and cadence configurations
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming outreach detail */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-3">Upcoming Outreach</h3>
          <div className="space-y-2">
            {upcomingOutreach.map((item, i) => (
              <motion.div
                key={item.invoice.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {item.agent[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.invoice.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{item.stepLabel}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  <Clock className="h-3 w-3 mr-1" /> {item.scheduledDay}
                </Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Watch Sending <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
