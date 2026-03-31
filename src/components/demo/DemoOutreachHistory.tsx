import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, Eye, Clock, MessageSquare, Send, MousePointerClick, ExternalLink, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { DemoTutorialCallout } from "./DemoTutorialCallout";
import { useState } from "react";

interface TrackingEvent {
  type: "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced";
  timestamp: string;
  details?: string;
}

interface OutreachItem {
  id: string;
  customerName: string;
  persona: string;
  subject: string;
  agingBucket: string;
  channel: string;
  tracking: TrackingEvent[];
  clickedLinks: { label: string; url: string; clicks: number }[];
  openCount: number;
  deviceInfo?: string;
  location?: string;
}

const generateTracking = (index: number): Omit<OutreachItem, "id" | "customerName" | "persona" | "subject" | "agingBucket" | "channel"> => {
  const now = Date.now();
  const minutesAgo = (m: number) => {
    const d = new Date(now - m * 60000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Simulate different engagement levels
  if (index < 2) {
    // Full funnel: sent → delivered → opened → clicked → replied
    return {
      tracking: [
        { type: "sent", timestamp: minutesAgo(120), details: "Queued via Recouply" },
        { type: "delivered", timestamp: minutesAgo(119), details: "Accepted by mail server" },
        { type: "opened", timestamp: minutesAgo(85), details: "First open" },
        { type: "opened", timestamp: minutesAgo(42), details: "Re-opened" },
        { type: "clicked", timestamp: minutesAgo(84), details: "Clicked payment link" },
        { type: "replied", timestamp: minutesAgo(30), details: "Customer replied" },
      ],
      clickedLinks: [
        { label: "Payment Link", url: "pay.recouply.ai/inv/...", clicks: 2 },
        { label: "Invoice PDF", url: "docs.recouply.ai/inv/...", clicks: 1 },
      ],
      openCount: 3,
      deviceInfo: "Chrome · macOS",
      location: "New York, US",
    };
  }
  if (index < 5) {
    // Opened & clicked but no reply
    return {
      tracking: [
        { type: "sent", timestamp: minutesAgo(180 + index * 20) },
        { type: "delivered", timestamp: minutesAgo(179 + index * 20) },
        { type: "opened", timestamp: minutesAgo(90 + index * 10) },
        { type: "clicked", timestamp: minutesAgo(88 + index * 10), details: "Clicked payment link" },
      ],
      clickedLinks: [
        { label: "Payment Link", url: "pay.recouply.ai/inv/...", clicks: 1 },
      ],
      openCount: index < 3 ? 2 : 1,
      deviceInfo: index % 2 === 0 ? "Safari · iOS" : "Gmail · Android",
      location: index % 2 === 0 ? "Chicago, US" : "Austin, US",
    };
  }
  if (index < 8) {
    // Opened only
    return {
      tracking: [
        { type: "sent", timestamp: minutesAgo(240 + index * 15) },
        { type: "delivered", timestamp: minutesAgo(239 + index * 15) },
        { type: "opened", timestamp: minutesAgo(120 + index * 10) },
      ],
      clickedLinks: [],
      openCount: 1,
      deviceInfo: "Outlook · Windows",
      location: "Denver, US",
    };
  }
  // Sent/delivered only
  return {
    tracking: [
      { type: "sent", timestamp: minutesAgo(300 + index * 10) },
      { type: "delivered", timestamp: minutesAgo(299 + index * 10) },
    ],
    clickedLinks: [],
    openCount: 0,
  };
};

const eventConfig: Record<string, { color: string; icon: typeof Send; label: string }> = {
  sent: { color: "text-muted-foreground", icon: Send, label: "Sent" },
  delivered: { color: "text-primary", icon: CheckCircle2, label: "Delivered" },
  opened: { color: "text-blue-500", icon: Eye, label: "Opened" },
  clicked: { color: "text-amber-500", icon: MousePointerClick, label: "Clicked" },
  replied: { color: "text-accent", icon: MessageSquare, label: "Replied" },
  bounced: { color: "text-destructive", icon: ExternalLink, label: "Bounced" },
};

export const DemoOutreachHistory = () => {
  const { drafts, sentCount, nextStep } = useDemoContext();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sentDrafts = drafts.filter(d => d.status === "sent");

  const outreachItems: OutreachItem[] = sentDrafts.slice(0, 10).map((draft, i) => {
    const tracking = generateTracking(i);
    return {
      id: draft.id,
      customerName: draft.customer_name,
      persona: draft.persona,
      subject: draft.subject,
      agingBucket: draft.aging_bucket,
      channel: "email",
      ...tracking,
    };
  });

  const totalOpens = outreachItems.reduce((a, b) => a + b.openCount, 0);
  const totalClicks = outreachItems.reduce((a, b) => a + b.clickedLinks.reduce((c, d) => c + d.clicks, 0), 0);
  const openRate = Math.round((outreachItems.filter(t => t.openCount > 0).length / Math.max(outreachItems.length, 1)) * 100);
  const clickRate = Math.round((outreachItems.filter(t => t.clickedLinks.length > 0).length / Math.max(outreachItems.length, 1)) * 100);
  const replyRate = Math.round((outreachItems.filter(t => t.tracking.some(e => e.type === "replied")).length / Math.max(outreachItems.length, 1)) * 100);

  const getLatestEvent = (item: OutreachItem) => item.tracking[item.tracking.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 11: Outreach History</h1>
        <p className="text-muted-foreground">Full activity timeline with open, click, and reply tracking on every message</p>
      </div>

      <DemoTutorialCallout
        title="End-to-End Message Tracking"
        description="Every outreach email includes invisible tracking pixels and link wrapping. See exactly when a customer opens your email, which links they click, and when they reply — all in real time."
        platformPath="Outreach → History"
        steps={[
          { title: "Open tracking", description: "A tracking pixel records every time the email is opened, including device type, email client, and approximate location." },
          { title: "Click tracking", description: "All links (payment, invoice PDF, portal) are wrapped to track clicks. See which links drive the most engagement." },
          { title: "Reply detection", description: "Inbound replies are matched to the original outreach and create an Inbound AI task for smart response drafting." },
          { title: "Engagement scoring", description: "Each account gets an engagement score based on open/click/reply patterns, feeding into the Collection Intelligence model.", action: "View in Collection Intel" },
        ]}
        proTip="Accounts that open but don't click may need a stronger CTA or payment link. Accounts that click but don't pay may benefit from a payment plan offer."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Send, label: "Total Sent", value: sentCount, color: "text-primary" },
          { icon: Eye, label: "Open Rate", value: `${openRate}%`, color: "text-blue-500" },
          { icon: MousePointerClick, label: "Click Rate", value: `${clickRate}%`, color: "text-amber-500" },
          { icon: MessageSquare, label: "Reply Rate", value: `${replyRate}%`, color: "text-accent" },
          { icon: BarChart3, label: "Total Opens", value: totalOpens, color: "text-violet-500" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <CardContent className="p-3 text-center">
                <Icon className={`h-4 w-4 ${color} mx-auto mb-1`} />
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Activity feed with tracking details */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Message Tracking Timeline</h3>
          <div className="space-y-2">
            {outreachItems.map((item, i) => {
              const latest = getLatestEvent(item);
              const latestConfig = eventConfig[latest.type];
              const isExpanded = expandedId === item.id;
              const hasClicks = item.clickedLinks.length > 0;
              const hasReplied = item.tracking.some(e => e.type === "replied");

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                >
                  <div
                    className={`rounded-lg border transition-all cursor-pointer ${
                      isExpanded ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/30"
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {/* Summary row */}
                    <div className="flex items-center gap-3 p-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        hasReplied ? "bg-accent/10 text-accent" : hasClicks ? "bg-amber-500/10 text-amber-500" : item.openCount > 0 ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
                      }`}>
                        {item.persona[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{item.customerName}</p>
                          <Badge variant={hasReplied ? "default" : "outline"} className="text-[10px] shrink-0">
                            {latestConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.subject}</p>
                      </div>

                      {/* Tracking indicators */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.openCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                            <Eye className="h-3 w-3" /> {item.openCount}
                          </span>
                        )}
                        {totalClicks > 0 && hasClicks && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                            <MousePointerClick className="h-3 w-3" /> {item.clickedLinks.reduce((a, b) => a + b.clicks, 0)}
                          </span>
                        )}
                        {hasReplied && (
                          <span className="flex items-center gap-0.5 text-[10px] text-accent">
                            <MessageSquare className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {latest.timestamp}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>

                    {/* Expanded tracking detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-3">
                            {/* Tracking event timeline */}
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Event Timeline</p>
                              <div className="space-y-1.5">
                                {item.tracking.map((event, ei) => {
                                  const config = eventConfig[event.type];
                                  const EventIcon = config.icon;
                                  return (
                                    <div key={ei} className="flex items-center gap-2 text-xs">
                                      <EventIcon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
                                      <span className="font-medium text-foreground w-16 shrink-0">{config.label}</span>
                                      <span className="text-muted-foreground">{event.timestamp}</span>
                                      {event.details && (
                                        <span className="text-muted-foreground/70">— {event.details}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Click details */}
                            {item.clickedLinks.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Link Clicks</p>
                                <div className="space-y-1">
                                  {item.clickedLinks.map((link, li) => (
                                    <div key={li} className="flex items-center gap-2 text-xs p-1.5 rounded bg-amber-500/5 border border-amber-500/10">
                                      <MousePointerClick className="h-3 w-3 text-amber-500 shrink-0" />
                                      <span className="font-medium text-foreground">{link.label}</span>
                                      <span className="text-muted-foreground font-mono text-[10px] truncate">{link.url}</span>
                                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{link.clicks} click{link.clicks > 1 ? "s" : ""}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Device / location info */}
                            {(item.deviceInfo || item.location) && (
                              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                {item.deviceInfo && <span>📱 {item.deviceInfo}</span>}
                                {item.location && <span>📍 {item.location}</span>}
                                <span>📧 {item.openCount} open{item.openCount !== 1 ? "s" : ""}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>Next: Watch Payments <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};
