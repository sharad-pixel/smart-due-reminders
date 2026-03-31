import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Mail, MessageSquare, CheckCircle2, AlertTriangle, Clock, Zap } from "lucide-react";
import { DemoTutorialCallout, TryItPrompt } from "./DemoTutorialCallout";
import { useState } from "react";

const INBOUND_EMAILS = [
  {
    id: 1,
    from: "lisa.chen@meridianlogistics.com",
    subject: "RE: Invoice #INV-2024-0892 — Payment Dispute",
    snippet: "We received the invoice but the amount doesn't match our PO. Can you send a corrected version?",
    aiCategory: "Dispute",
    aiSentiment: "Neutral",
    aiAction: "Generate corrected invoice and reply with PO reconciliation",
    aiConfidence: 94,
    urgency: "high",
    receivedAt: "12 min ago",
  },
  {
    id: 2,
    from: "accounts@brightwavedesign.co",
    subject: "Payment coming Friday",
    snippet: "Hi, just wanted to let you know we'll be sending payment for the outstanding balance this Friday via ACH.",
    aiCategory: "Promise to Pay",
    aiSentiment: "Positive",
    aiAction: "Log promise-to-pay for Friday, set follow-up reminder for Monday if not received",
    aiConfidence: 98,
    urgency: "low",
    receivedAt: "34 min ago",
  },
  {
    id: 3,
    from: "john.park@greenfieldconstruction.com",
    subject: "Need W-9 and updated invoice",
    snippet: "Before we can process payment, we need your current W-9 and an invoice with our new billing address.",
    aiCategory: "Information Request",
    aiSentiment: "Neutral",
    aiAction: "Auto-attach W-9 from vault, generate updated invoice with new address, send reply",
    aiConfidence: 91,
    urgency: "medium",
    receivedAt: "1 hr ago",
  },
  {
    id: 4,
    from: "ap@summitretailgroup.com",
    subject: "RE: Past Due Notice — INV-2024-1105",
    snippet: "We never received this invoice. Please resend to our AP portal at invoices@summitretailgroup.com.",
    aiCategory: "Delivery Issue",
    aiSentiment: "Neutral",
    aiAction: "Resend invoice to AP portal email, update contact record, confirm delivery",
    aiConfidence: 96,
    urgency: "medium",
    receivedAt: "2 hrs ago",
  },
  {
    id: 5,
    from: "maria.santos@coastalfoods.com",
    subject: "Can we set up a payment plan?",
    snippet: "Cash flow is tight this quarter. Could we split the $18,400 balance into 3 monthly payments?",
    aiCategory: "Settlement / Payment Plan",
    aiSentiment: "Cooperative",
    aiAction: "Generate 3-month payment plan proposal, route to approval queue",
    aiConfidence: 89,
    urgency: "high",
    receivedAt: "3 hrs ago",
  },
];

const urgencyStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-accent/10 text-accent border-accent/20",
};

export const DemoInboundAI = () => {
  const { nextStep } = useDemoContext();
  const [processedIds, setProcessedIds] = useState<number[]>([]);

  const handleProcess = (id: number) => {
    setProcessedIds(prev => [...prev, id]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-foreground flex items-center justify-center gap-2"
        >
          <BrainCircuit className="h-7 w-7 text-primary" />
          Inbound AI
        </motion.h2>
        <p className="text-muted-foreground">
          AI reads, categorizes, and drafts responses to every inbound email — disputes, payment promises, info requests, and more.
        </p>
      </div>

      <DemoTutorialCallout
        title="How Inbound AI Works"
        description="Every email that hits your collections inbox is automatically analyzed by AI. It classifies the intent, gauges sentiment, and drafts a context-aware response — all before you open it."
        variant="action"
        platformPath="Dashboard → Inbox → Inbound AI"
        steps={[
          { title: "Email ingestion", description: "Inbound emails are captured via your connected inbox or forwarding rules. Each message is parsed and matched to existing accounts." },
          { title: "AI classification", description: "The AI categorizes the email (dispute, promise-to-pay, info request, payment plan, etc.) and assesses sentiment and urgency." },
          { title: "Smart response drafting", description: "Based on the category, account history, and your brand voice, a response is auto-drafted with relevant attachments (invoices, W-9s, payment links)." },
          { title: "Review & send", description: "Review the AI-drafted response, make edits if needed, and send — or enable auto-send for low-risk categories." },
        ]}
        proTip="Enable auto-responses for 'Promise to Pay' and 'Information Request' categories to save 80% of manual inbox time. Keep disputes and payment plans in review mode."
      />

      <TryItPrompt
        label="Process all inbound emails with AI"
        description="Click to simulate AI analyzing and categorizing all 5 inbound emails instantly."
        onAction={() => setProcessedIds(INBOUND_EMAILS.map(e => e.id))}
        actionLabel="Run Inbound AI"
        completed={processedIds.length === INBOUND_EMAILS.length}
      />

      {/* Inbound email queue */}
      <div className="space-y-3">
        {INBOUND_EMAILS.map((email, i) => {
          const isProcessed = processedIds.includes(email.id);
          return (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className={`transition-all ${isProcessed ? "border-accent/30 bg-accent/5" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{email.from}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{email.receivedAt}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{email.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{email.snippet}</p>
                    </div>
                    <Badge className={`shrink-0 text-[10px] ${urgencyStyles[email.urgency]}`}>
                      {email.urgency === "high" ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                      {email.urgency}
                    </Badge>
                  </div>

                  {/* AI Analysis (shown after processing) */}
                  {isProcessed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="border-t border-border pt-3 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold text-foreground">AI Analysis</span>
                        <Badge variant="outline" className="text-[10px]">{email.aiConfidence}% confidence</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Category:</span>{" "}
                          <span className="font-medium text-foreground">{email.aiCategory}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sentiment:</span>{" "}
                          <span className="font-medium text-foreground">{email.aiSentiment}</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-md bg-primary/5 border border-primary/10">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">Recommended Action</p>
                            <p className="text-xs text-foreground mt-0.5">{email.aiAction}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-accent">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Response drafted & ready for review</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Process button */}
                  {!isProcessed && (
                    <button
                      onClick={() => handleProcess(email.id)}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <BrainCircuit className="h-3.5 w-3.5" />
                      Analyze with AI
                    </button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Summary stats */}
      {processedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            { label: "Processed", value: processedIds.length, icon: CheckCircle2 },
            { label: "Avg Confidence", value: `${Math.round(INBOUND_EMAILS.filter(e => processedIds.includes(e.id)).reduce((a, b) => a + b.aiConfidence, 0) / processedIds.length)}%`, icon: BrainCircuit },
            { label: "High Urgency", value: INBOUND_EMAILS.filter(e => processedIds.includes(e.id) && e.urgency === "high").length, icon: AlertTriangle },
            { label: "Auto-Draftable", value: INBOUND_EMAILS.filter(e => processedIds.includes(e.id) && e.aiConfidence >= 90).length, icon: Zap },
          ].map((stat, i) => (
            <Card key={i}>
              <CardContent className="p-3 text-center">
                <stat.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={nextStep} className="gap-2">
          Continue to AI Activation <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
