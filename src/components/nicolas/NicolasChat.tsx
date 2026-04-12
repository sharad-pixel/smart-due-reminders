import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { X, Send, User, Loader2, AlertTriangle, ThumbsDown, ExternalLink, Calendar, Mail, Settings2, Book } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import nicolasAvatar from "@/assets/personas/nicolas.png";
import { founderConfig } from "@/lib/founderConfig";
import { useNicolasPreferences } from "@/hooks/useNicolasPreferences";
import { getPageOnboardingContent } from "@/lib/onboardingContent";
import { KNOWLEDGE_BASE, ESCALATION_TRIGGERS } from "./nicolasKnowledge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isEscalated?: boolean;
  confidence?: number;
  links?: { label: string; path: string }[];
  quickReplies?: string[];
}

type EscalationStep = 'idle' | 'ask_category' | 'ask_description' | 'ask_contact' | 'confirming';

interface EscalationData {
  category: string;
  description: string;
  urgency: string;
  contactName: string;
  contactEmail: string;
}

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
  
  // Enhanced escalation flow state
  const [escalationStep, setEscalationStep] = useState<EscalationStep>('idle');
  const [escalationData, setEscalationData] = useState<EscalationData>({
    category: '',
    description: '',
    urgency: 'medium',
    contactName: '',
    contactEmail: ''
  });
  const [pendingEscalationQuestion, setPendingEscalationQuestion] = useState<string | null>(null);

  // Issue categories for smart collection
  const ISSUE_CATEGORIES = [
    "Billing or Payments",
    "Technical Issue / Bug",
    "Account Access",
    "Feature Question",
    "Integration Help",
    "Other"
  ];

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

  const escalateToSupport = async () => {
    setIsLoading(true);
    
    const questionToEscalate = pendingEscalationQuestion || "User requested human help";
    // Capture full conversation transcript (no limit)
    const transcript = messages
      .map(m => `${m.role === "user" ? "User" : "Nicolas"}: ${m.content}`)
      .join("\n");
    
    // Use collected contact info or fall back to logged-in user
    const escalationEmail = escalationData.contactEmail || user?.email || null;
    const escalationName = escalationData.contactName || null;
    
    try {
      const { error } = await supabase.functions.invoke('nicolas-escalate-support', {
        body: {
          user_id: user?.id || null,
          organization_id: null,
          page_route: location.pathname,
          question: questionToEscalate,
          confidence_score: 0.2,
          escalation_reason: escalationData.category || "User requested human support",
          transcript_excerpt: transcript,
          user_email: escalationEmail,
          user_name: escalationName,
          issue_category: escalationData.category,
          issue_description: escalationData.description,
          urgency: escalationData.urgency
        }
      });

      if (error) throw error;

      toast.success("Your request has been sent to Recouply.ai Support!");
      
      return `Thanks${escalationName ? ` ${escalationName.split(' ')[0]}` : ''}! I've sent your ${escalationData.category || 'question'} to our support team. ${escalationEmail ? `Sharad will reach out to you at ${escalationEmail}` : 'Someone will be in touch'} as soon as possible. In the meantime, feel free to schedule a call directly! — Nicolas`;
    } catch (err) {
      console.error('Escalation error:', err);
      return "I'm having trouble processing this right now — but you can reach our support team directly at support@recouply.ai.";
    } finally {
      setIsLoading(false);
    }
  };

  // Start the smart escalation flow
  const startEscalation = (question: string) => {
    setPendingEscalationQuestion(question);
    setEscalationStep('ask_category');
    
    // Add a message asking what kind of help they need
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "I'd love to help connect you with the right person! What type of issue can I help you with today?",
      timestamp: new Date(),
      confidence: 1,
      quickReplies: ISSUE_CATEGORIES
    }]);
  };

  // Handle quick reply selection (for categories)
  const handleQuickReply = (reply: string) => {
    // Add user's selection as a message
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "user",
      content: reply,
      timestamp: new Date()
    }]);

    if (escalationStep === 'ask_category') {
      setEscalationData(prev => ({ ...prev, category: reply }));
      setEscalationStep('ask_description');
      
      // Personalized follow-up based on category
      const followUpMessages: Record<string, string> = {
        "Billing or Payments": "Got it! Can you briefly describe the billing issue? For example: incorrect charge, refund request, subscription question, etc.",
        "Technical Issue / Bug": "Thanks for letting me know! Can you describe what's happening? Include any error messages you're seeing if possible.",
        "Account Access": "I understand account issues can be frustrating. What specifically is happening with your account access?",
        "Feature Question": "Great! What feature would you like to learn more about?",
        "Integration Help": "Happy to help with integrations! Which integration are you working with, and what's the challenge?",
        "Other": "No problem! Please describe what you need help with and I'll make sure the right person sees it."
      };

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: followUpMessages[reply] || "Can you tell me more about what you need help with?",
        timestamp: new Date(),
        confidence: 1
      }]);
    }
  };

  // Handle text responses during escalation flow
  const handleEscalationInput = async (userInput: string) => {
    // Add user's message
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "user",
      content: userInput,
      timestamp: new Date()
    }]);

    if (escalationStep === 'ask_description') {
      setEscalationData(prev => ({ ...prev, description: userInput }));
      
      // Determine urgency based on keywords
      const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'down', 'broken', 'not working'];
      const isUrgent = urgentKeywords.some(kw => userInput.toLowerCase().includes(kw));
      setEscalationData(prev => ({ ...prev, urgency: isUrgent ? 'high' : 'medium' }));

      // If user is logged in, skip contact collection
      if (user?.email) {
        setEscalationStep('confirming');
        const response = await escalateToSupport();
        
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
        
        resetEscalationState();
      } else {
        // Ask for contact info
        setEscalationStep('ask_contact');
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Perfect, I have all the details! To make sure our team can reach you, please provide your contact information below.",
          timestamp: new Date(),
          confidence: 1
        }]);
      }
    }
  };

  // Reset escalation state
  const resetEscalationState = () => {
    setEscalationStep('idle');
    setPendingEscalationQuestion(null);
    setEscalationData({
      category: '',
      description: '',
      urgency: 'medium',
      contactName: '',
      contactEmail: ''
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationData.contactEmail.trim()) {
      toast.error("Please provide your email address");
      return;
    }
    
    setEscalationStep('confirming');
    const response = await escalateToSupport();
    
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
    
    resetEscalationState();
  };

  const cancelEscalation = () => {
    resetEscalationState();
    
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "No problem! Let me know if there's anything else I can help you with.",
      timestamp: new Date(),
      confidence: 1
    }]);
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
        // Start escalation flow (will collect contact info if not logged in)
        setIsLoading(false);
        startEscalation(userMessage.content);
        return;
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

  const handleEscalate = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    startEscalation(lastUserMessage?.content || "User requested human help");
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const { preferences, isLoaded, toggleAssistant, resetOnboarding } = useNicolasPreferences();
  const [showSettings, setShowSettings] = useState(false);
  const pageContent = getPageOnboardingContent(location.pathname);

  // Don't render if assistant is disabled
  if (isLoaded && !preferences.assistantEnabled) {
    return null;
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] animate-float">
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
          {/* Close/dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAssistant(false);
            }}
            className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
            title="Hide assistant"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-background border rounded-xl shadow-2xl z-[60] flex flex-col max-h-[600px]">
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
            <p className="text-xs text-muted-foreground">
              {pageContent ? `Helping with ${pageContent.title}` : 'Knowledge Base Agent'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/knowledge-base"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            title="Knowledge Base"
          >
            <Book className="h-4 w-4" />
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 w-8"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="p-4 border-b bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Assistant Enabled</p>
              <p className="text-xs text-muted-foreground">Show Nicolas on all pages</p>
            </div>
            <Switch
              checked={preferences.assistantEnabled}
              onCheckedChange={(checked) => {
                toggleAssistant(checked);
                if (!checked) {
                  toast.info("Nicolas disabled. Re-enable in Settings → Profile.");
                }
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              resetOnboarding();
              toast.success("Onboarding reset! Refresh to see the welcome tour.");
            }}
          >
            Restart Onboarding Tour
          </Button>
        </div>
      )}

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
                {/* Quick Reply Buttons */}
                {message.role === "assistant" && message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {message.quickReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickReply(reply)}
                        disabled={escalationStep !== 'ask_category'}
                        className="text-xs px-2 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reply}
                      </button>
                    ))}
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
        {escalationStep === 'ask_contact' ? (
          // Contact info collection form for non-logged in users
          <form onSubmit={handleContactSubmit} className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Please provide your contact details:</p>
            <Input
              value={escalationData.contactName}
              onChange={(e) => setEscalationData(prev => ({ ...prev, contactName: e.target.value }))}
              placeholder="Your name (optional)"
              disabled={isLoading}
              className="text-sm"
            />
            <Input
              type="email"
              value={escalationData.contactEmail}
              onChange={(e) => setEscalationData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="Your email (required)"
              disabled={isLoading}
              required
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={cancelEscalation}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm" 
                disabled={isLoading || !escalationData.contactEmail.trim()}
                className="flex-1"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to Support"}
              </Button>
            </div>
          </form>
        ) : escalationStep === 'ask_description' ? (
          // Description input during escalation flow
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  handleEscalationInput(input.trim());
                  setInput("");
                }
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your issue..."
                disabled={isLoading}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <button
              onClick={cancelEscalation}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel and go back
            </button>
          </>
        ) : escalationStep === 'ask_category' ? (
          // Category selection - just show cancel option, quick replies are in messages
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Select an option above, or</p>
            <button
              onClick={cancelEscalation}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel and go back
            </button>
          </div>
        ) : (
          // Normal chat input
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
