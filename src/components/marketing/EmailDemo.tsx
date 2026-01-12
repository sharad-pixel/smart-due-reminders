import { useState, useEffect, useRef } from "react";
import { Mail, Bot, Sparkles, Send, Tag, UserCheck, ClipboardCheck, CheckCircle2, AlertTriangle } from "lucide-react";

const customerEmail = "Hi, can you resend the invoice? We need to review it before paying.";
const aiAssessment = {
  category: "Invoice Request",
  sentiment: "Positive",
  priority: "Medium",
  intent: "Customer needs invoice copy before payment",
};
const taskDetails = {
  title: "Resend Invoice #INV-2024-0847",
  type: "invoice_request",
  assignedTo: "Sam (AI Agent)",
  tags: ["Invoice Copy", "Payment Pending", "ACME Corp"],
  dueDate: "Today",
};
const aiResponse = "Absolutely — here is your invoice and a summary of what's due. Invoice #INV-2024-0847 for $12,500 is attached. Payment due by December 15th. Let me know if you have any questions!";

type Phase = "idle" | "typing-customer" | "analyzing" | "assessment" | "task-creation" | "typing-ai" | "complete";

const EmailDemo = () => {
  const [customerText, setCustomerText] = useState("");
  const [aiText, setAiText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [isVisible, setIsVisible] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    setTimeout(() => setPhase("typing-customer"), 500);
  }, [isVisible]);

  useEffect(() => {
    if (phase === "typing-customer") {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= customerEmail.length) {
          setCustomerText(customerEmail.slice(0, i));
          i++;
        } else {
          clearInterval(interval);
          setTimeout(() => setPhase("analyzing"), 400);
        }
      }, 30);
      return () => clearInterval(interval);
    }

    if (phase === "analyzing") {
      setTimeout(() => {
        setShowAssessment(true);
        setPhase("assessment");
      }, 1200);
    }

    if (phase === "assessment") {
      setTimeout(() => {
        setShowTask(true);
        setPhase("task-creation");
      }, 1500);
    }

    if (phase === "task-creation") {
      setTimeout(() => setPhase("typing-ai"), 1200);
    }

    if (phase === "typing-ai") {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= aiResponse.length) {
          setAiText(aiResponse.slice(0, i));
          i++;
        } else {
          clearInterval(interval);
          setPhase("complete");
        }
      }, 18);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const resetDemo = () => {
    setCustomerText("");
    setAiText("");
    setShowAssessment(false);
    setShowTask(false);
    setPhase("idle");
    setTimeout(() => setPhase("typing-customer"), 300);
  };

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            Live AI Demo
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Inbound AI Email Assessment
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Watch AI analyze emails, create tasks, and draft responses — all in real-time
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Every inbound email is automatically assessed, categorized, and routed to the right agent
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Customer Email Side */}
          <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden h-full">
              <div className="bg-muted/50 px-4 py-3 border-b border-border/50 flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Inbound Email</span>
              </div>
              <div className="p-5">
                <p className="text-xs text-muted-foreground mb-2">from: customer@acme.com</p>
                <p className="text-foreground leading-relaxed text-sm">
                  {customerText}
                  {phase === "typing-customer" && (
                    <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-blink"></span>
                  )}
                </p>
              </div>

              {/* AI Assessment Panel */}
              <div className={`border-t border-border/50 transition-all duration-500 ${showAssessment ? "opacity-100 max-h-[300px]" : "opacity-0 max-h-0 overflow-hidden"}`}>
                <div className="bg-primary/5 px-4 py-2 border-b border-primary/10 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary">AI Assessment</span>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium text-primary">{aiAssessment.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Sentiment</span>
                    <span className="font-medium text-green-600">{aiAssessment.sentiment}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Priority</span>
                    <span className="font-medium text-yellow-600">{aiAssessment.priority}</span>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground italic">"{aiAssessment.intent}"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Task Creation Panel */}
          <div className={`transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className={`bg-card rounded-2xl border shadow-xl overflow-hidden h-full transition-all duration-500 ${showTask ? "border-accent/40" : "border-border/50"}`}>
              <div className={`px-4 py-3 border-b flex items-center gap-3 transition-colors ${showTask ? "bg-accent/10 border-accent/20" : "bg-muted/50 border-border/50"}`}>
                <ClipboardCheck className={`h-5 w-5 ${showTask ? "text-accent" : "text-muted-foreground"}`} />
                <span className="font-medium">Task Created</span>
                {showTask && (
                  <span className="ml-auto">
                    <CheckCircle2 className="h-4 w-4 text-accent animate-in zoom-in" />
                  </span>
                )}
              </div>
              
              <div className="p-5">
                {!showTask && phase !== "idle" && phase !== "typing-customer" && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <div className="flex items-center gap-2 text-sm animate-pulse">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <span>Analyzing email...</span>
                    </div>
                  </div>
                )}
                
                {showTask && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Task Title */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Task</p>
                      <p className="font-medium text-sm">{taskDetails.title}</p>
                    </div>
                    
                    {/* Assignment */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Assigned to</p>
                        <p className="font-medium text-sm">{taskDetails.assignedTo}</p>
                      </div>
                      <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Due: {taskDetails.dueDate}
                      </span>
                    </div>

                    {/* Tags */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Tags</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {taskDetails.tags.map((tag, i) => (
                          <span 
                            key={tag}
                            className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground animate-in fade-in"
                            style={{ animationDelay: `${i * 100}ms` }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Response Side */}
          <div className={`transition-all duration-700 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="bg-card rounded-2xl border border-primary/20 shadow-xl overflow-hidden h-full relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
              
              <div className="bg-primary/10 px-4 py-3 border-b border-primary/20 flex items-center gap-3 relative">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">AI Draft Response</span>
                {(phase === "analyzing" || phase === "assessment" || phase === "task-creation") && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-primary">
                    <Sparkles className="h-3 w-3 animate-spin" />
                    Preparing...
                  </span>
                )}
                {phase === "complete" && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-accent">
                    <Send className="h-3 w-3" />
                    Ready to send
                  </span>
                )}
              </div>
              
              <div className="p-5 relative min-h-[180px]">
                {(phase === "analyzing" || phase === "assessment" || phase === "task-creation") && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <span>Reading email content...</span>
                    </div>
                    {(phase === "assessment" || phase === "task-creation") && (
                      <div className="flex items-center gap-2 text-sm text-primary/70 animate-pulse">
                        <div className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                        <span>Categorizing request...</span>
                      </div>
                    )}
                    {phase === "task-creation" && (
                      <div className="flex items-center gap-2 text-sm text-primary/50 animate-pulse">
                        <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        <span>Generating response...</span>
                      </div>
                    )}
                  </div>
                )}
                
                {(phase === "typing-ai" || phase === "complete") && (
                  <p className="text-foreground leading-relaxed text-sm">
                    {aiText}
                    {phase === "typing-ai" && (
                      <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-blink"></span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Replay button */}
        {phase === "complete" && (
          <div className="text-center mt-8 animate-in fade-in">
            <button
              onClick={resetDemo}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              <Sparkles className="h-4 w-4" />
              Watch Again
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default EmailDemo;