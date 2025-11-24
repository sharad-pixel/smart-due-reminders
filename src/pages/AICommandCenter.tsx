import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { 
  Brain, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle2, 
  Bot,
  Clock,
  ListChecks,
  BarChart3,
  Zap,
  Shield,
  Users,
  FileText,
  AlertCircle,
  Target,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const AICommandCenter = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "AI Collections Command Center | Recouply.ai";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "A complete intelligent control room for every overdue invoice — powered by smart AI personas, automated workflows, response analytics, and real-time task extraction."
      );
    }
  }, []);

  const valueProps = [
    {
      icon: Brain,
      title: "Unified Collections Hub",
      description: "See every message, response, promise-to-pay, dispute, and invoice action in one centralized dashboard."
    },
    {
      icon: Bot,
      title: "AI Personas by Aging Bucket",
      description: "Sam, James, Katy, Troy & Gotti each handle messages in your preferred tone based on invoice age."
    },
    {
      icon: MessageSquare,
      title: "Automated Response Parsing",
      description: "AI scans inbound replies to extract tasks like W9 requests, PO disputes, or payment plan needs."
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Track open rates, responses, payment traction, dispute patterns, and persona performance in real-time."
    },
    {
      icon: Shield,
      title: "White-Labeled Outreach",
      description: "All communication comes from your business, not us. Maintain your brand and customer relationships."
    }
  ];

  const features = [
    {
      icon: Clock,
      title: "Multi-Channel Activity Timeline",
      description: "Every email, SMS, reply, dispute, and promise-to-pay automatically logged and organized in chronological order.",
      details: ["Email tracking", "SMS conversations", "Response timestamps", "Activity feed"]
    },
    {
      icon: Sparkles,
      title: "AI Persona Messaging Engine",
      description: "Friendly to firm messages automatically drafted by bucket-specific personas that adapt to your customers.",
      details: ["Tone adaptation", "Context-aware drafts", "Multi-language support", "Brand voice consistency"]
    },
    {
      icon: Brain,
      title: "AI Response Understanding",
      description: "Automatically detect and categorize customer responses for immediate action.",
      details: [
        "W9 requests",
        "PO disputes",
        "Incorrect charges",
        "Invoice copy requests",
        "Payment plan needs",
        "Prior payment claims",
        "Billing updates",
        "Service disputes",
        "Follow-up requirements"
      ]
    },
    {
      icon: ListChecks,
      title: "Actionable Task Queue",
      description: "A smart task system powered by AI with Kanban boards, priority tagging, due dates, and approval workflows.",
      details: ["Auto-generated tasks", "Priority scoring", "Team assignment", "Due date tracking"]
    },
    {
      icon: TrendingUp,
      title: "Analytics & Traction Insights",
      description: "Comprehensive metrics to optimize your collections strategy and measure performance.",
      details: [
        "Response rate tracking",
        "Agent performance",
        "Payment traction",
        "Dispute analysis",
        "Customer behaviors",
        "Cycle time improvements",
        "DSO reduction"
      ]
    },
    {
      icon: Zap,
      title: "Automated Workflows by Aging Bucket",
      description: "Each overdue stage triggers the right AI agent with the right tone and timing automatically.",
      details: ["Bucket-based routing", "Smart escalation", "Cadence optimization", "Auto-send scheduling"]
    }
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-6xl text-center">
          <Badge className="mb-4 text-sm px-4 py-1">AI-Powered Collections Intelligence</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            The AI Collections Command Center
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            A complete, intelligent control room for every overdue invoice — powered by smart AI personas, automated workflows, response analytics, and real-time task extraction.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/contact-us")} className="text-lg px-8">
              See a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Value Props Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {valueProps.map((prop, index) => (
              <Card key={index} className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg">
                <CardHeader>
                  <prop.icon className="h-12 w-12 text-primary mb-4" />
                  <CardTitle className="text-xl">{prop.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{prop.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Personas Showcase */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Meet Your AI Collections Team</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Five specialized AI agents that automatically adapt messaging tone and urgency based on how overdue each invoice is.
            </p>
          </div>
          
          <TooltipProvider>
            <div className="flex gap-8 overflow-x-auto pb-4 justify-center">
              {Object.entries(personaConfig).map(([key, persona]) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Card className="hover:scale-105 transition-all cursor-pointer border-2 hover:border-primary/40 flex-shrink-0">
                      <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
                        <PersonaAvatar persona={persona} size="xl" />
                        <div>
                          <p className="font-bold text-lg">{persona.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-semibold">{persona.description}</p>
                    <p className="text-sm mt-1">{persona.tone}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <div className="mt-12 text-center">
            <Button size="lg" onClick={() => navigate("/personas")} variant="outline">
              Learn More About AI Personas
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Breakdown */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              What's Inside the AI Collections Command Center?
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to automate, track, and optimize your collections process
            </p>
          </div>

          <div className="space-y-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <feature.icon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-base">{feature.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="ml-16 flex flex-wrap gap-2">
                    {feature.details.map((detail, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {detail}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Panel */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-2 border-primary/20 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-6 w-6" />
                Command Center in Action
              </CardTitle>
              <CardDescription className="text-base">
                See how the AI Command Center transforms your collections process
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-500/10 rounded">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">AI sends personalized message</p>
                      <p className="text-sm text-muted-foreground">
                        Sam drafts a friendly 15-day reminder
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded">
                      <Brain className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Customer responds with question</p>
                      <p className="text-sm text-muted-foreground">
                        "Can you send me a copy of the W9?"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-500/10 rounded">
                      <ListChecks className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold">AI auto-creates task</p>
                      <p className="text-sm text-muted-foreground">
                        "Send W9 to customer - Priority: High"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/10 rounded">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Analytics updated in real-time</p>
                      <p className="text-sm text-muted-foreground">
                        Response rate, engagement, and task metrics
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-6 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Users className="h-24 w-24 text-primary mx-auto" />
                    <p className="text-lg font-semibold">Interactive Demo</p>
                    <p className="text-sm text-muted-foreground">
                      See the full workflow in your trial account
                    </p>
                    <Button onClick={() => navigate("/signup")}>
                      Start Your Free Trial
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2 border-primary">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">
                Designed for High-Volume Billing Operations
              </CardTitle>
              <CardDescription className="text-lg">
                Whether you process 100 or 50,000 invoices a month, the AI Collections Command Center gives your finance & operations teams total visibility, automated follow-ups, and dispute resolution workflows — all without hiring more staff.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-6">
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 bg-primary/5 rounded-lg">
                  <FileText className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="font-bold text-2xl mb-1">50K+</p>
                  <p className="text-sm text-muted-foreground">Invoices Processed</p>
                </div>
                <div className="p-6 bg-primary/5 rounded-lg">
                  <Zap className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="font-bold text-2xl mb-1">85%</p>
                  <p className="text-sm text-muted-foreground">Automation Rate</p>
                </div>
                <div className="p-6 bg-primary/5 rounded-lg">
                  <TrendingUp className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="font-bold text-2xl mb-1">40%</p>
                  <p className="text-sm text-muted-foreground">Faster Collections</p>
                </div>
              </div>
              <Button size="lg" onClick={() => navigate("/contact-us")}>
                Schedule Enterprise Demo
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Collections?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join businesses automating their AR with intelligent AI agents
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/signup")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/contact-us")}
              className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default AICommandCenter;
