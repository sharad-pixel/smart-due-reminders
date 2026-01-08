import { useState, useEffect, useRef } from "react";
import { Mail, Bot, Sparkles, Send } from "lucide-react";

const customerEmail = "Hi, can you resend the invoice? We need to review it before paying.";
const aiResponse = "Absolutely — here is your invoice and a summary of what's due. Invoice #INV-2024-0847 for $12,500 is attached. Payment due by December 15th. Let me know if you have any questions!";

const EmailDemo = () => {
  const [customerText, setCustomerText] = useState("");
  const [aiText, setAiText] = useState("");
  const [phase, setPhase] = useState<"idle" | "typing-customer" | "thinking" | "typing-ai" | "complete">("idle");
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.4 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    // Start animation sequence
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
          setTimeout(() => setPhase("thinking"), 500);
        }
      }, 30);
      return () => clearInterval(interval);
    }

    if (phase === "thinking") {
      setTimeout(() => setPhase("typing-ai"), 1500);
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
      }, 20);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const resetDemo = () => {
    setCustomerText("");
    setAiText("");
    setPhase("idle");
    setTimeout(() => setPhase("typing-customer"), 300);
  };

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            Live AI Demo
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Watch AI Understand & Respond
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            See how our AI agents read, classify, and respond to customer emails in real-time
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Designed to reduce reliance on email-based collection processes — every interaction logged automatically
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Customer Email Side */}
          <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
            <div className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border/50 flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Customer Email</span>
                <span className="ml-auto text-xs text-muted-foreground">from: customer@acme.com</span>
              </div>
              <div className="p-6 min-h-[200px]">
                <p className="text-foreground leading-relaxed">
                  {customerText}
                  {phase === "typing-customer" && (
                    <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 animate-blink"></span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* AI Response Side */}
          <div className={`transition-all duration-700 delay-300 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <div className="bg-card rounded-2xl border border-primary/20 shadow-xl overflow-hidden relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
              
              <div className="bg-primary/10 px-4 py-3 border-b border-primary/20 flex items-center gap-3 relative">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">AI Agent Response</span>
                {phase === "thinking" && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-primary">
                    <Sparkles className="h-3 w-3 animate-spin" />
                    Analyzing...
                  </span>
                )}
                {phase === "complete" && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-accent">
                    <Send className="h-3 w-3" />
                    Ready to send
                  </span>
                )}
              </div>
              
              <div className="p-6 min-h-[200px] relative">
                {phase === "thinking" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <span>Reading email content...</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-primary/70 animate-pulse" style={{ animationDelay: "0.2s" }}>
                      <div className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <span>Identifying request type...</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-primary/50 animate-pulse" style={{ animationDelay: "0.4s" }}>
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                      <span>Generating response...</span>
                    </div>
                  </div>
                )}
                
                {(phase === "typing-ai" || phase === "complete") && (
                  <p className="text-foreground leading-relaxed">
                    {aiText}
                    {phase === "typing-ai" && (
                      <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 animate-blink"></span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Replay button */}
        {phase === "complete" && (
          <div className="text-center mt-8">
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
