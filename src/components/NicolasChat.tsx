import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  AlertTriangle,
  ThumbsDown,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isEscalated?: boolean;
  confidence?: number;
}

// Knowledge base for Nicolas
const KNOWLEDGE_BASE = [
  {
    keywords: ["invoice", "create invoice", "add invoice"],
    answer: "To create an invoice, go to the Invoices page and click 'Create Invoice'. You can also import invoices in bulk via the Data Center.",
    confidence: 0.9
  },
  {
    keywords: ["account", "debtor", "customer", "add account"],
    answer: "Accounts (formerly called debtors) can be managed from the Accounts page. You can add individual accounts or import them in bulk through the Data Center.",
    confidence: 0.9
  },
  {
    keywords: ["workflow", "ai workflow", "collection workflow"],
    answer: "AI Workflows automatically generate collection drafts based on invoice aging buckets. Go to Settings → AI Workflows to configure your collection automation.",
    confidence: 0.85
  },
  {
    keywords: ["persona", "ai agent", "sam", "james", "katy", "troy", "gotti", "rocco"],
    answer: "Recouply.ai has 6 AI personas: Sam (0-30 days), James (31-60), Katy (61-90), Troy (91-120), Gotti (121-150), and Rocco (150+ days). Each has a unique tone suited for different aging stages.",
    confidence: 0.9
  },
  {
    keywords: ["data center", "import", "upload", "csv", "excel"],
    answer: "The Data Center is your hub for importing invoices, payments, and account data. Go to Data Center to upload files, map columns, and reconcile your data.",
    confidence: 0.85
  },
  {
    keywords: ["payment", "apply payment", "reconcile"],
    answer: "You can apply payments from invoice detail pages using the 'Apply Payment' button, or import payments in bulk via the Data Center and reconcile them automatically.",
    confidence: 0.85
  },
  {
    keywords: ["billing", "subscription", "plan", "pricing", "upgrade"],
    answer: "Manage your subscription from Settings → Billing. We offer Starter ($99/mo), Growth ($199/mo), and Professional ($499/mo) plans based on invoice volume.",
    confidence: 0.8
  },
  {
    keywords: ["email", "send email", "outreach", "draft"],
    answer: "AI-generated email drafts are created automatically based on your workflows. Review and approve drafts from the AI Workflows page before they're sent.",
    confidence: 0.85
  },
  {
    keywords: ["task", "collection task", "todo"],
    answer: "Collection tasks are created automatically from inbound emails and AI analysis. View and manage all tasks from the Collection Tasks page.",
    confidence: 0.85
  },
  {
    keywords: ["risk", "payment score", "risk engine"],
    answer: "The Risk Engine calculates Payment Scores (0-100) for each account based on payment history, aging mix, disputes, and engagement. Higher scores indicate lower risk.",
    confidence: 0.85
  },
  {
    keywords: ["logo", "branding", "customize"],
    answer: "Upload your company logo and customize branding from Settings → Branding & Logo. Your logo will appear in all outbound collection emails.",
    confidence: 0.8
  },
  {
    keywords: ["security", "password", "mfa", "two factor"],
    answer: "Enable two-factor authentication from Settings → Security. We support TOTP authenticator apps for enhanced account security.",
    confidence: 0.85
  },
  {
    keywords: ["team", "member", "invite", "user"],
    answer: "Add team members from Settings → Team Members. Team members can be assigned to tasks and receive email notifications about their assignments.",
    confidence: 0.8
  },
  {
    keywords: ["daily digest", "report", "summary"],
    answer: "The Daily Collections Health Digest provides AR summaries, payment trends, and task counts. View it from the Daily Digest page or receive it via email.",
    confidence: 0.8
  },
  {
    keywords: ["help", "support", "contact"],
    answer: "I'm Nicolas, your knowledge base assistant! If I can't answer your question, I can escalate it to our support team at support@recouply.ai.",
    confidence: 0.9
  }
];

// Escalation trigger keywords
const ESCALATION_TRIGGERS = [
  "contact support",
  "email support",
  "escalate",
  "human help",
  "speak to someone",
  "talk to support",
  "need help from a human",
  "bug",
  "error",
  "not working",
  "broken",
  "can't access",
  "account locked",
  "billing issue",
  "refund",
  "cancel subscription"
];

export default function NicolasChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm Nicolas, your Recouply.ai assistant. How can I help you today?",
      timestamp: new Date(),
      confidence: 1
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const findAnswer = (question: string): { answer: string; confidence: number } => {
    const lowerQuestion = question.toLowerCase();
    
    // Check for explicit escalation triggers
    for (const trigger of ESCALATION_TRIGGERS) {
      if (lowerQuestion.includes(trigger)) {
        return { answer: "__ESCALATE__", confidence: 0 };
      }
    }

    // Search knowledge base
    let bestMatch = { answer: "", confidence: 0 };
    
    for (const entry of KNOWLEDGE_BASE) {
      const matchCount = entry.keywords.filter(kw => 
        lowerQuestion.includes(kw.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        const score = (matchCount / entry.keywords.length) * entry.confidence;
        if (score > bestMatch.confidence) {
          bestMatch = { answer: entry.answer, confidence: score };
        }
      }
    }

    // If confidence is too low, escalate
    if (bestMatch.confidence < 0.3) {
      return { 
        answer: "I'm not confident I can answer that question accurately. Would you like me to escalate this to our support team?", 
        confidence: 0.2 
      };
    }

    return bestMatch;
  };

  const escalateToSupport = async (question: string, transcript?: string) => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.functions.invoke('nicolas-escalate-support', {
        body: {
          user_id: user?.id || null,
          organization_id: null, // Could be fetched from profile if needed
          page_route: location.pathname,
          question,
          confidence_score: 0.2,
          escalation_reason: "User requested human support or low confidence answer",
          transcript_excerpt: transcript,
          user_email: user?.email || null
        }
      });

      if (error) throw error;

      toast.success("Your question has been sent to Recouply.ai Support.");
      
      return "Thanks for your patience — I've emailed our support specialists at Recouply.ai. They'll take it from here and follow up with you shortly!";
    } catch (err) {
      console.error('Escalation error:', err);
      return "I'm having trouble processing this right now — but you can reach our support team directly at support@recouply.ai.";
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { answer, confidence } = findAnswer(userMessage.content);
      let responseContent: string;
      let isEscalated = false;

      if (answer === "__ESCALATE__") {
        // Build transcript
        const transcript = messages
          .slice(-6)
          .map(m => `${m.role === "user" ? "User" : "Nicolas"}: ${m.content}`)
          .join("\n");
        
        responseContent = await escalateToSupport(userMessage.content, transcript);
        isEscalated = true;
      } else {
        responseContent = answer;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
        confidence,
        isEscalated
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error:', err);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm having trouble right now. Please try again or contact support@recouply.ai.",
        timestamp: new Date(),
        confidence: 0
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    const transcript = messages
      .slice(-6)
      .map(m => `${m.role === "user" ? "User" : "Nicolas"}: ${m.content}`)
      .join("\n");

    const response = await escalateToSupport(
      lastUserMessage?.content || "User requested human help",
      transcript
    );

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response,
      timestamp: new Date(),
      isEscalated: true
    }]);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-background border rounded-xl shadow-2xl z-50 flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary/5 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Nicolas</h3>
            <p className="text-xs text-muted-foreground">Knowledge Base Agent</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[75%] ${message.role === "user" ? "order-first" : ""}`}>
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.content}
                </div>
                {message.isEscalated && (
                  <Badge variant="outline" className="mt-1 text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Escalated
                  </Badge>
                )}
              </div>
              {message.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={handleEscalate}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ThumbsDown className="h-3 w-3" />
            Need human help?
          </button>
          <a
            href="mailto:support@recouply.ai"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            support@recouply.ai
          </a>
        </div>
      </div>
    </div>
  );
}
