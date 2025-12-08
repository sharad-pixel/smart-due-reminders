import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  X, 
  Send, 
  User, 
  Loader2, 
  AlertTriangle,
  ThumbsDown,
  ExternalLink,
  Calendar,
  Mail
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import nicolasAvatar from "@/assets/personas/nicolas.png";
import { founderConfig } from "@/lib/founderConfig";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isEscalated?: boolean;
  confidence?: number;
  links?: { label: string; path: string }[];
}

// Knowledge base for Nicolas with links
const KNOWLEDGE_BASE = [
  // ===== DATA CENTER PROCESSES =====
  {
    keywords: ["data center", "import", "upload", "csv", "excel", "bulk import"],
    answer: "The Data Center is your central hub for importing Accounts, Invoices, and Payments. You can upload CSV or Excel files, map columns to our standard fields, and review matches before finalizing. Start by choosing what type of data you want to import.",
    confidence: 0.95,
    links: [
      { label: "Open Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["upload accounts", "import accounts", "accounts upload", "customer upload", "bulk accounts"],
    answer: "To upload accounts: 1) Go to Data Center and click 'Accounts', 2) Download our template or upload your own file, 3) Map your columns to our standard fields (Company Name, Email, Phone are key), 4) Review the preview and submit. Each account gets a Recouply Account ID (RID) for future invoice/payment mapping.",
    confidence: 0.95,
    links: [
      { label: "Upload Accounts", path: "/data-center" }
    ]
  },
  {
    keywords: ["upload invoices", "import invoices", "invoices upload", "bulk invoices"],
    answer: "To upload invoices: 1) Go to Data Center and click 'Invoices', 2) Download our template which includes required fields, 3) Include the Recouply Account ID to link invoices to accounts, 4) Map columns like Invoice Number, Amount, Due Date, 5) Review and submit. AI workflows auto-trigger for aging invoices.",
    confidence: 0.95,
    links: [
      { label: "Upload Invoices", path: "/data-center" }
    ]
  },
  {
    keywords: ["upload payments", "import payments", "payments upload", "bulk payments", "payment import"],
    answer: "To upload payments: 1) Go to Data Center and click 'Payments', 2) Download our template, 3) Include Recouply Account ID and Recouply Invoice ID to match payments to invoices, 4) Map Payment Amount, Payment Date, and Method, 5) Review matches and reconcile. Invoices auto-update to Paid or PartiallyPaid.",
    confidence: 0.95,
    links: [
      { label: "Upload Payments", path: "/data-center" },
      { label: "Reconciliation", path: "/reconciliation" }
    ]
  },
  {
    keywords: ["template", "download template", "csv template", "excel template", "sample file"],
    answer: "Download pre-formatted templates from the Data Center's 'Sources & Templates' tab. We have templates for Accounts (with RID, company info, address), Invoices (with invoice number, amounts, dates), and Payments (with payment matching fields). Templates include all required and optional fields.",
    confidence: 0.95,
    links: [
      { label: "Get Templates", path: "/data-center" }
    ]
  },
  {
    keywords: ["column mapping", "map columns", "field mapping", "how to map"],
    answer: "Column mapping connects your file columns to Recouply fields. After uploading, you'll see a mapping screen where you select which Recouply field each of your columns represents. Our AI suggests mappings automatically. Required fields are marked - you must map these before proceeding.",
    confidence: 0.9,
    links: [
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["recouply id", "rid", "account id", "recouply account id", "reference id"],
    answer: "The Recouply Account ID (RID) is auto-generated when you create accounts (format: RCPLY-ACCT-XXXX). Use this ID in invoice and payment uploads to correctly link data. You can export all accounts with their RIDs from the Accounts page for reference.",
    confidence: 0.95,
    links: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["recouply invoice id", "rinvd", "invoice reference", "invoice id"],
    answer: "The Recouply Invoice ID (RINVD) is auto-generated when invoices are created (format: RCPLY-INV-XXXX). Use this ID in payment uploads to match payments to specific invoices. It's the primary matching field for payment reconciliation.",
    confidence: 0.95,
    links: [
      { label: "View Invoices", path: "/invoices" }
    ]
  },
  {
    keywords: ["source", "data source", "accounting system", "quickbooks", "netsuite", "sap"],
    answer: "Data Sources represent your external accounting systems (QuickBooks, NetSuite, SAP, etc.). Create a source profile in the Data Center to save column mappings. Once saved, future uploads from that source automatically use your saved mappings.",
    confidence: 0.9,
    links: [
      { label: "Manage Sources", path: "/data-center" }
    ]
  },
  {
    keywords: ["review upload", "staging", "match status", "unmatched", "needs review"],
    answer: "After uploading, rows go to staging for review. You'll see match statuses: 'Matched' (linked to existing records), 'Pending' (needs review), or 'Unmatched' (no match found). You can manually assign matches, bulk-select rows, or delete incorrect entries before finalizing.",
    confidence: 0.9,
    links: [
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["required fields", "mandatory fields", "what fields"],
    answer: "Required fields vary by type: ACCOUNTS need Company Name, Email; INVOICES need Recouply Account ID, Invoice Number, Amount, Due Date; PAYMENTS need Recouply Account ID, Recouply Invoice ID, Payment Amount, Payment Date. Check our templates for the full list.",
    confidence: 0.9,
    links: [
      { label: "Get Templates", path: "/data-center" }
    ]
  },
  {
    keywords: ["export accounts", "download accounts", "get account list"],
    answer: "Export all your accounts with their Recouply IDs from the Accounts page. Click the dropdown menu and select 'Export All Accounts'. This gives you a file with RIDs you can use for invoice and payment imports.",
    confidence: 0.9,
    links: [
      { label: "Export Accounts", path: "/debtors" }
    ]
  },
  {
    keywords: ["custom fields", "add field", "extra fields"],
    answer: "You can create custom fields when editing source mappings in the Data Center. Custom fields are saved per data source and can be reused across multiple uploads. Define the field key, label, and data type when creating.",
    confidence: 0.85,
    links: [
      { label: "Manage Sources", path: "/data-center" }
    ]
  },
  {
    keywords: ["archive upload", "delete upload", "remove upload"],
    answer: "You can archive uploads from the Data Center to hide them from your active view. Archived uploads aren't deleted - toggle 'Show archived' to view them, and restore if needed. Individual staging rows can also be deleted during review.",
    confidence: 0.85,
    links: [
      { label: "Data Center", path: "/data-center" }
    ]
  },
  // ===== TASKS & INBOUND EMAIL PROCESSING =====
  {
    keywords: ["task", "tasks", "collection task", "task list", "todo", "action items"],
    answer: "Collection tasks are action items that need attention. Tasks are created automatically from inbound customer emails, or manually by your team. View all tasks from the Collection Tasks page where you can filter by status, priority, type, and assignee.",
    confidence: 0.95,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["task assignment", "assign task", "assign to", "who is assigned"],
    answer: "Tasks can be assigned to team members you've added in Settings. When a task is assigned, that team member receives an email with task details and a reply-to address. Their replies are captured and can generate follow-up tasks automatically.",
    confidence: 0.95,
    links: [
      { label: "View Tasks", path: "/tasks" },
      { label: "Team Members", path: "/team" }
    ]
  },
  {
    keywords: ["automatic task", "auto task", "task created automatically", "how tasks created"],
    answer: "Tasks are created automatically when: 1) Inbound emails are received from customers - AI analyzes the email and extracts actionable items, 2) AI detects requests like W9 forms, payment plans, disputes, or invoice copies, 3) Each extracted action becomes a separate task linked to the email and account.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" },
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["inbound email", "customer email", "email response", "received email"],
    answer: "When customers reply to collection emails, their responses are captured in the Inbound Command Center. Each email is automatically processed by AI to extract summaries, sentiment, priority, and actionable items. You can view the full email, AI analysis, and linked account/invoice.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["ai summary", "email summary", "summarize email", "ai analysis"],
    answer: "AI automatically summarizes every inbound email, extracting: 1) A brief summary of the customer's message, 2) Sentiment (positive/neutral/negative), 3) Priority level (high/medium/low), 4) Category (payment plan request, dispute, question, etc.), 5) Recommended actions to take.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["ai response", "generate response", "ai reply", "draft response", "auto response"],
    answer: "From any inbound email, click 'Generate AI Response' to create an intelligent reply. The AI uses the email context, linked invoice details, and appropriate persona tone. You can review, edit, send immediately, or save as draft. Unsent responses create pending tasks so nothing is missed.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["extracted action", "action type", "w9", "payment plan request", "dispute", "promise to pay"],
    answer: "AI extracts specific action types from emails: W9_REQUEST (tax form needed), PAYMENT_PLAN_REQUEST (wants to set up payments), DISPUTE_CHARGES (questioning charges), PROMISE_TO_PAY (commitment to pay by date), INVOICE_COPY_REQUEST (needs invoice copy), and more. Each becomes a trackable task.",
    confidence: 0.9,
    links: [
      { label: "View Tasks", path: "/tasks" },
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["task status", "open task", "close task", "complete task", "in progress"],
    answer: "Tasks have statuses: Open (new/needs attention), In Progress (being worked on), Done (completed). Update task status from the task detail modal. You can also add notes and see the full history of the task including source email and related communications.",
    confidence: 0.9,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["task priority", "high priority", "urgent task"],
    answer: "Tasks are assigned priority levels: High (urgent action needed), Medium (standard follow-up), Low (non-urgent). AI automatically sets priority based on email content, customer sentiment, and invoice aging. You can manually adjust priority in the task detail modal.",
    confidence: 0.9,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["internal task", "team communication", "internal email"],
    answer: "Emails from team members (defined in your Team Members settings) are flagged as internal communications. AI processes these differently and creates tasks with an [Internal] prefix. This distinguishes team discussions from customer communications.",
    confidence: 0.85,
    links: [
      { label: "Team Members", path: "/team" },
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["view source email", "email link", "task email"],
    answer: "Every task created from an inbound email has a 'View Source Email' link. Click it to navigate directly to that email in the Inbound Command Center. Similarly, from emails you can click linked tasks to open the task detail modal.",
    confidence: 0.85,
    links: [
      { label: "Inbound Command Center", path: "/inbound" },
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  // ===== ORIGINAL KNOWLEDGE BASE ENTRIES =====
  {
    keywords: ["invoice", "create invoice", "add invoice", "new invoice"],
    answer: "To create an invoice, go to the Invoices page and click 'Create Invoice'. You can also import invoices in bulk via the Data Center.",
    confidence: 0.9,
    links: [
      { label: "Go to Invoices", path: "/invoices" },
      { label: "Open Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["account", "debtor", "customer", "add account"],
    answer: "Accounts can be managed from the Accounts page. You can add individual accounts or import them in bulk through the Data Center.",
    confidence: 0.9,
    links: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Open Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["workflow", "ai workflow", "collection workflow"],
    answer: "AI Workflows automatically generate collection drafts based on invoice aging buckets. Configure your collection automation from the AI Workflows page.",
    confidence: 0.85,
    links: [
      { label: "Configure AI Workflows", path: "/settings/ai-workflows" }
    ]
  },
  {
    keywords: ["persona", "ai agent", "sam", "james", "katy", "troy", "gotti", "rocco"],
    answer: "Recouply.ai has 6 AI personas: Sam (0-30 days), James (31-60), Katy (61-90), Troy (91-120), Gotti (121-150), and Rocco (150+ days). Each has a unique tone suited for different aging stages.",
    confidence: 0.9,
    links: [
      { label: "View AI Agents", path: "/personas" },
      { label: "Configure Workflows", path: "/settings/ai-workflows" }
    ]
  },
  {
    keywords: ["payment", "apply payment", "reconcile payment"],
    answer: "You can apply payments from invoice detail pages using the 'Apply Payment' button, or import payments in bulk via the Data Center and reconcile them.",
    confidence: 0.85,
    links: [
      { label: "View Invoices", path: "/invoices" },
      { label: "Reconciliation", path: "/reconciliation" },
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["billing", "subscription", "plan", "pricing", "upgrade"],
    answer: "Manage your subscription from the Billing page. We offer Starter ($199/mo), Growth ($499/mo), and Professional ($799/mo) plans based on invoice volume.",
    confidence: 0.8,
    links: [
      { label: "Manage Billing", path: "/billing" },
      { label: "View Pricing", path: "/pricing" }
    ]
  },
  {
    keywords: ["email", "send email", "outreach", "draft"],
    answer: "AI-generated email drafts are created automatically based on your workflows. Review and approve drafts from the AI Workflows page before they're sent.",
    confidence: 0.85,
    links: [
      { label: "AI Workflows", path: "/settings/ai-workflows" }
    ]
  },
  {
    keywords: ["task", "collection task", "todo"],
    answer: "Collection tasks are created automatically from inbound emails and AI analysis. View and manage all tasks from the Collection Tasks page.",
    confidence: 0.85,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["risk", "payment score", "risk engine"],
    answer: "The Risk Engine calculates Payment Scores (0-100) for each account based on payment history, aging mix, disputes, and engagement. Higher scores indicate lower risk.",
    confidence: 0.85,
    links: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Dashboard", path: "/dashboard" }
    ]
  },
  {
    keywords: ["logo", "branding", "customize"],
    answer: "Upload your company logo and customize branding from the Settings page. Your logo will appear in all outbound collection emails.",
    confidence: 0.8,
    links: [
      { label: "Branding Settings", path: "/settings" }
    ]
  },
  {
    keywords: ["security", "password", "mfa", "two factor"],
    answer: "Enable two-factor authentication from the Security Settings page. We support TOTP authenticator apps for enhanced account security.",
    confidence: 0.85,
    links: [
      { label: "Security Settings", path: "/settings/security" }
    ]
  },
  {
    keywords: ["team", "member", "invite", "user"],
    answer: "Add team members from the Team Members settings. Team members can be assigned to tasks and receive email notifications about their assignments.",
    confidence: 0.8,
    links: [
      { label: "Team Members", path: "/team" }
    ]
  },
  {
    keywords: ["daily digest", "report", "summary"],
    answer: "The Daily Collections Health Digest provides AR summaries, payment trends, and task counts. View it from the Daily Digest page or receive it via email.",
    confidence: 0.8,
    links: [
      { label: "Daily Digest", path: "/daily-digest" }
    ]
  },
  {
    keywords: ["dashboard", "overview", "home"],
    answer: "Your Dashboard shows key metrics including AR aging, payment scores, tasks, and collectability reports at a glance.",
    confidence: 0.85,
    links: [
      { label: "Go to Dashboard", path: "/dashboard" }
    ]
  },
  {
    keywords: ["aging", "ar aging", "overdue"],
    answer: "View your AR Aging breakdown from the AR Aging page. See invoices grouped by days past due (Current, 1-30, 31-60, 61-90, 91-120, 121+ days).",
    confidence: 0.85,
    links: [
      { label: "AR Aging Report", path: "/ar-aging" }
    ]
  },
  {
    keywords: ["inbound", "email reply", "customer response"],
    answer: "Inbound emails from customers are captured and processed automatically. View and manage them from the Inbound Command Center.",
    confidence: 0.85,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["help", "support", "contact"],
    answer: "I'm Nicolas, your knowledge base assistant! If I can't answer your question, I can help you schedule a meeting with our founder or send a message to our support team.",
    confidence: 0.9,
    links: [
      { label: "Schedule Meeting", path: "__CALENDLY__" },
      { label: "Contact Us", path: "/contact" }
    ]
  },
  {
    keywords: ["meeting", "schedule", "call", "demo", "talk", "speak"],
    answer: "I'd be happy to help you schedule a meeting with Sharad, our founder! Click the link below to book a time that works for you.",
    confidence: 0.95,
    links: [
      { label: "Schedule Meeting", path: "__CALENDLY__" }
    ]
  },
  {
    keywords: ["calendly", "book", "appointment"],
    answer: "You can book a meeting directly with our founder using the link below. He'd love to chat about how Recouply.ai can help your business!",
    confidence: 0.95,
    links: [
      { label: "Book with Sharad", path: "__CALENDLY__" }
    ]
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
      confidence: 1,
      links: [
        { label: "Dashboard", path: "/dashboard" },
        { label: "Invoices", path: "/invoices" },
        { label: "Accounts", path: "/debtors" }
      ]
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

  const findAnswer = (question: string): { answer: string; confidence: number; links: { label: string; path: string }[] } => {
    const lowerQuestion = question.toLowerCase();
    
    // Check for explicit escalation triggers
    for (const trigger of ESCALATION_TRIGGERS) {
      if (lowerQuestion.includes(trigger)) {
        return { answer: "__ESCALATE__", confidence: 0, links: [] };
      }
    }

    // Search knowledge base
    let bestMatch = { answer: "", confidence: 0, links: [] as { label: string; path: string }[] };
    
    for (const entry of KNOWLEDGE_BASE) {
      const matchCount = entry.keywords.filter(kw => 
        lowerQuestion.includes(kw.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        const score = (matchCount / entry.keywords.length) * entry.confidence;
        if (score > bestMatch.confidence) {
          bestMatch = { answer: entry.answer, confidence: score, links: entry.links || [] };
        }
      }
    }

    // If confidence is too low, show friendly escalation with contact options
    if (bestMatch.confidence < 0.3) {
      return { 
        answer: `I'm still very new here and learning. Let me get you to the founder who can help. Sharad will get back to you as soon as possible once you fill out the form. Thanks — Nicolas`, 
        confidence: 0.2,
        links: [
          { label: "Schedule Meeting", path: "__CALENDLY__" },
          { label: "Contact Form", path: "/contact" }
        ]
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
          organization_id: null,
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
      
      return `I'm still very new here and learning. Let me get you to the founder who can help. Sharad will get back to you as soon as possible once you fill out the form. Thanks — Nicolas`;
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
      const { answer, confidence, links } = findAnswer(userMessage.content);
      let responseContent: string;
      let isEscalated = false;
      let responseLinks = links;

      if (answer === "__ESCALATE__") {
        const transcript = messages
          .slice(-6)
          .map(m => `${m.role === "user" ? "User" : "Nicolas"}: ${m.content}`)
          .join("\n");
        
        responseContent = await escalateToSupport(userMessage.content, transcript);
        isEscalated = true;
        // Provide contact options after escalation
        responseLinks = [
          { label: "Schedule Meeting", path: "__CALENDLY__" },
          { label: "Contact Form", path: "/contact" }
        ];
      } else {
        responseContent = answer;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
        confidence,
        isEscalated,
        links: responseLinks
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
      isEscalated: true,
      links: [
        { label: "Schedule Meeting", path: "__CALENDLY__" },
        { label: "Contact Form", path: "/contact" }
      ]
    }]);
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-float">
        <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          {/* Avatar container */}
          <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 hover:scale-110">
            <img 
              src={nicolasAvatar} 
              alt="Nicolas" 
              className="h-full w-full object-cover"
            />
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-accent rounded-full border-2 border-background animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-background border rounded-xl shadow-2xl z-50 flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary/5 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
            <img 
              src={nicolasAvatar} 
              alt="Nicolas" 
              className="h-full w-full object-cover"
            />
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
                <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                  <img 
                    src={nicolasAvatar} 
                    alt="Nicolas" 
                    className="h-full w-full object-cover"
                  />
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
                {/* Clickable Links */}
                {message.role === "assistant" && message.links && message.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {message.links.map((link, idx) => {
                      // Handle Calendly link specially
                      if (link.path === "__CALENDLY__") {
                        return (
                          <a
                            key={idx}
                            href={founderConfig.calendly}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-accent/20 text-accent-foreground hover:bg-accent/30 transition-colors"
                          >
                            <Calendar className="h-3 w-3" />
                            {link.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        );
                      }
                      return (
                        <Link
                          key={idx}
                          to={link.path}
                          onClick={handleLinkClick}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {link.label.includes("Contact") && <Mail className="h-3 w-3" />}
                          {link.label}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      );
                    })}
                  </div>
                )}
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
              <div className="h-8 w-8 rounded-full overflow-hidden">
                <img 
                  src={nicolasAvatar} 
                  alt="Nicolas" 
                  className="h-full w-full object-cover"
                />
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
