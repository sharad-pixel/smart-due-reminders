import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  Clock,
  Brain,
  Zap,
  BarChart3,
  Mail,
  CheckCircle,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MarketingLayout from "@/components/MarketingLayout";

const headlines = [
  "Collection Intelligence Is Coming",
  "Shape Your Cash Flow With AI",
  "Predict. Act. Recover.",
  "The Future of Receivables",
  "Smarter Collections, Faster Cash",
];

const ComingSoon = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);

  // Rotate headlines
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % headlines.length);
      setDisplayText("");
      setIsTypingComplete(false);
    }, 4000);

    return () => clearInterval(rotationInterval);
  }, []);

  // Typewriter effect
  useEffect(() => {
    const currentHeadline = headlines[headlineIndex];
    let currentIndex = 0;
    
    const typingInterval = setInterval(() => {
      if (currentIndex <= currentHeadline.length) {
        setDisplayText(currentHeadline.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [headlineIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('waitlist_signups')
        .insert([{ email: email.trim().toLowerCase() }]);
      
      if (error) {
        if (error.code === '23505') {
          toast.info("You're already on the list!", {
            description: "We'll notify you when we launch."
          });
          setSubmitted(true);
        } else {
          throw error;
        }
      } else {
        toast.success("You're on the list!", {
          description: "We'll notify you when Collection Intelligence launches."
        });
        setSubmitted(true);
      }
      
      setEmail("");
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filter out Nicolas for the public display
  const publicPersonas = Object.entries(personaConfig).filter(([key]) => key !== 'nicolas');

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/5">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
          
          {/* Animated gradient orbs */}
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] animate-spin-slow"></div>
        </div>

        {/* Floating invoice cards */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float-up opacity-20"
              style={{
                left: `${10 + i * 15}%`,
                animationDelay: `${i * 0.8}s`,
                animationDuration: `${8 + i * 2}s`,
              }}
            >
              <div className="w-24 h-32 bg-card/50 backdrop-blur-sm rounded-lg border border-border/30 shadow-lg p-3">
                <div className="w-full h-2 bg-primary/30 rounded mb-2"></div>
                <div className="w-3/4 h-2 bg-muted-foreground/20 rounded mb-2"></div>
                <div className="w-1/2 h-2 bg-muted-foreground/20 rounded"></div>
                <div className="mt-4 text-xs text-primary/50 font-mono">$1,250</div>
              </div>
            </div>
          ))}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-5xl mx-auto">
            {/* Logo */}
            <div className="mb-8 animate-fade-in">
              <RecouplyLogo size="xl" animated className="justify-center text-4xl" />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8 animate-fade-in">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
              Launching Soon
            </div>

            {/* Typewriter Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 leading-tight min-h-[1.2em]">
              <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                {displayText}
              </span>
              <span className={`inline-block w-1 h-[1em] bg-primary ml-1 ${isTypingComplete ? 'animate-blink' : 'animate-pulse'}`}></span>
            </h1>

            {/* Glow effect behind headline */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/20 blur-[80px] -z-10"></div>

            {/* Subheadline */}
            <p className={`text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto transition-all duration-700 ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              AI-powered collection intelligence that transforms how you manage receivables. 
              Predict payment behavior, automate outreach, and accelerate cash flow.
            </p>

            {/* Early Access Signup */}
            <div className={`max-w-md mx-auto mb-12 transition-all duration-700 delay-200 ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {submitted ? (
                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <CheckCircle className="h-6 w-6 text-accent" />
                  <span className="text-accent font-semibold">You're on the early access list!</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your email for early access"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-12 bg-background/80 backdrop-blur-sm border-2 focus:border-primary"
                  />
                  <Button type="submit" size="lg" disabled={loading} className="h-12 px-6">
                    {loading ? "..." : "Get Early Access"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Join 500+ finance leaders waiting for launch. No spam, ever.
              </p>
            </div>

            {/* AI Agent Avatars */}
            <TooltipProvider delayDuration={100}>
              <div className={`flex justify-center items-center gap-3 md:gap-5 flex-wrap my-10 transition-all duration-700 delay-300 ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {publicPersonas.map(([key, persona], index) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div 
                        className="relative group cursor-pointer"
                        style={{ animationDelay: `${index * 150}ms` }}
                      >
                        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative p-3 rounded-2xl bg-card/80 backdrop-blur-sm border-2 border-transparent hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:scale-110 animate-float" style={{ animationDelay: `${index * 0.5}s` }}>
                          <PersonaAvatar persona={persona} size="lg" />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs p-4 bg-card/95 backdrop-blur-sm border-2 border-primary/20">
                      <div className="space-y-2">
                        <h4 className="font-bold text-lg">{persona.name}</h4>
                        <p className="text-sm font-medium" style={{ color: persona.color }}>{persona.description}</p>
                        <p className="text-xs text-muted-foreground italic">"{persona.tone}"</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>

            {/* 24/7 Badge */}
            <p className={`text-sm text-muted-foreground transition-all duration-700 delay-500 ${isTypingComplete ? 'opacity-100' : 'opacity-0'}`}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
                6 AI agents working 24/7 so you don't have to
              </span>
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-3 bg-muted-foreground/50 rounded-full animate-scroll-down"></div>
          </div>
        </div>
      </section>

      {/* How Collection Intelligence Shapes Cash Flow */}
      <section className="py-24 px-4 bg-gradient-to-b from-muted/10 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              <Brain className="h-4 w-4" />
              Collection Intelligence
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              How AI Shapes Your Cash Flow
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Transform unpredictable receivables into predictable revenue with intelligent automation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: "Predict Payment Behavior",
                description: "AI analyzes historical patterns to forecast which invoices need attention before they become overdue.",
                stat: "45%",
                statLabel: "faster identification of at-risk accounts"
              },
              {
                icon: Zap,
                title: "Automate Smart Outreach",
                description: "Each agent adapts tone and timing based on customer relationship, invoice age, and payment history.",
                stat: "3x",
                statLabel: "more effective than generic reminders"
              },
              {
                icon: Clock,
                title: "Accelerate Collections",
                description: "Reduce DSO with intelligent prioritization that focuses your energy on high-impact accounts.",
                stat: "23%",
                statLabel: "average reduction in days sales outstanding"
              },
              {
                icon: Shield,
                title: "Preserve Relationships",
                description: "Professional, brand-consistent communications that maintain customer trust while recovering revenue.",
                stat: "98%",
                statLabel: "customer relationship retention"
              },
              {
                icon: BarChart3,
                title: "Real-Time Visibility",
                description: "Comprehensive dashboards show collection performance, risk distribution, and cash flow projections.",
                stat: "100%",
                statLabel: "visibility into AR health"
              },
              {
                icon: DollarSign,
                title: "Maximize Recovery",
                description: "Intelligent escalation paths and settlement suggestions optimize recovery rates across aging buckets.",
                stat: "35%",
                statLabel: "improvement in recovery rates"
              }
            ].map((feature, i) => (
              <Card 
                key={i} 
                className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{feature.description}</p>
                  <div className="pt-4 border-t border-border/50">
                    <span className="text-2xl font-bold text-primary">{feature.stat}</span>
                    <p className="text-xs text-muted-foreground">{feature.statLabel}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the AI Agents */}
      <section className="py-24 px-4 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
              <Sparkles className="h-4 w-4" />
              Your AI Collection Team
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              6 Specialized Agents, One Mission
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Each agent is trained for specific aging buckets, adapting tone and strategy as invoices progress
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicPersonas.map(([key, persona], index) => (
              <Card 
                key={key}
                className="bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group border-border/50 hover:border-primary/30 animate-float"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <PersonaAvatar persona={persona} size="md" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{persona.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {persona.bucketMin}-{persona.bucketMax || "150+"} Days
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{persona.description}</p>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs italic text-muted-foreground">"{persona.tone}"</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 24/7 Banner */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-3 bg-accent/10 text-accent px-8 py-4 rounded-full">
              <span className="w-3 h-3 bg-accent rounded-full animate-pulse"></span>
              <span className="font-semibold text-lg">Working 24/7 to protect your cash flow</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent animate-pulse-slow"></div>
        </div>

        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-primary/30 rounded-full animate-float-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-primary/20 p-8 md:p-16 shadow-2xl shadow-primary/10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <Mail className="h-4 w-4 animate-pulse" />
                Be First in Line
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Ready to Transform Your Collections?
              </h2>
              
              <p className="text-xl md:text-2xl text-primary font-semibold mb-4">
                Join the Collection Intelligence Revolution
              </p>
              
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                Get early access to AI-powered collection intelligence. Shape the product, lock in founding member pricing, and be among the first to experience the future of receivables.
              </p>

              {/* Early Access Form */}
              <div className="max-w-md mx-auto">
                {submitted ? (
                  <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20">
                    <CheckCircle className="h-6 w-6 text-accent" />
                    <span className="text-accent font-semibold">You're on the early access list!</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 h-12 bg-background/80 backdrop-blur-sm border-2 focus:border-primary"
                    />
                    <Button type="submit" size="lg" disabled={loading} className="h-12 px-8">
                      {loading ? "..." : "Get Early Access"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                )}
              </div>

              <p className="mt-8 text-sm text-muted-foreground">
                No credit card required • Founding member pricing • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ComingSoon;
