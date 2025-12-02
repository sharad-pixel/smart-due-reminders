import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DollarSign, Zap, Shield, Users, BarChart3, CheckCircle, Brain, Clock, TrendingUp } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import SaaSBenefits from "@/components/SaaSBenefits";
import PersonaBenefits from "@/components/PersonaBenefits";
import AIAgentRoles from "@/components/AIAgentRoles";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { personaConfig } from "@/lib/personaConfig";

const Home = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            AI-Powered CashOps Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Six AI Agents Recover Your Revenue 24/7 <br />
            <span className="text-primary">Smart. Automated. Always Improving.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
            Recouply.ai brings modern CashOps automation to your AR workflow—recovering more revenue at a fraction of the cost.
          </p>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            "Six AI agents recovering your revenue 24/7—getting smarter with every invoice."
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")} className="text-lg px-8">
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Six AI Agents Working 24/7</h3>
              <p className="text-muted-foreground">
                Our AI agents handle outreach, reminders, sentiment analysis, payment behavior tracking, and follow-up sequencing continuously—so you never miss an opportunity to recover revenue.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Agents That Get Smarter Over Time</h3>
              <p className="text-muted-foreground">
                Each agent learns from customer responses, payment outcomes, and message effectiveness—automatically adapting tone, frequency, and sequencing for higher recovery rates.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Intelligence That Compounds</h3>
              <p className="text-muted-foreground">
                AI-powered CashOps means predictable payments, automated follow-up, and intelligence that compounds over time. Stop paying for expensive headcount—our agents work nonstop.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How Recouply.ai Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold mb-2 text-lg">Import Invoices & Customers</h4>
              <p className="text-muted-foreground">
                Upload your overdue invoices and customer data. Optionally sync with your CRM for richer context.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold mb-2 text-lg">AI Agents Generate Smart Drafts</h4>
              <p className="text-muted-foreground">
                Six specialized AI agents create personalized messages based on customer value, payment history, and relationship health—learning and improving with every interaction.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold mb-2 text-lg">Review, Approve & Collect</h4>
              <p className="text-muted-foreground">
                You review every message before it goes out. Approve with one click and track payments through your own channels.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-b from-muted/10 to-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-4">
            <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              AI-Powered CashOps
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Meet Your Six AI Agents
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Six specialized AI agents work around the clock, automatically adjusting their tone and approach based on invoice age—and getting smarter with every interaction
          </p>
          <TooltipProvider delayDuration={100}>
            <div className="flex justify-center items-center gap-8 flex-wrap mb-8">
              {Object.values(personaConfig).map((persona, index) => (
                <Tooltip key={persona.name}>
                  <TooltipTrigger asChild>
                    <div 
                      className="hover-scale cursor-pointer animate-fade-in transition-all duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="p-4 rounded-2xl bg-card border-2 border-transparent hover:border-primary/20 hover:shadow-xl transition-all duration-300">
                        <PersonaAvatar persona={persona} size="xl" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    className="max-w-xs p-4 animate-scale-in bg-card border-2"
                    sideOffset={10}
                  >
                    <div className="space-y-2">
                      <h4 className="font-bold text-lg">{persona.name}</h4>
                      <p className="text-sm font-medium" style={{ color: persona.color }}>
                        {persona.description}
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        "{persona.tone}"
                      </p>
                      <div className="pt-2 border-t mt-2">
                        <p className="text-xs font-semibold mb-1">Coverage:</p>
                        <p className="text-xs text-muted-foreground">
                          {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Hover over each agent to learn their specialty
              </p>
            </div>
          </TooltipProvider>
        </div>
      </section>

      {/* AI Agent Roles Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-4">
            <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              Specialized Intelligence
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Six Specialized Agent Roles
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Each agent uses machine learning to improve tone, timing, routing, and sequences—evolving based on engagement, past payments, and customer sentiment
          </p>
          <AIAgentRoles />
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground italic">
              "Every interaction improves the system. Your agents get smarter every day."
            </p>
          </div>
        </div>
      </section>

      {/* Persona Benefits Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Built for Your Role
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Whether you're a CFO, AR Manager, Business Owner, or RevOps Leader—Recouply.ai delivers value tailored to your priorities
          </p>
          <PersonaBenefits />
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Businesses Choose Recouply.ai
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Continuous Learning AI</h4>
                <p className="text-muted-foreground">
                  Our agents improve recovery rates with every interaction, learning from customer responses and payment outcomes to optimize messaging automatically.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Users className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Preserve Customer Relationships</h4>
                <p className="text-muted-foreground">
                  CRM-aware messaging ensures high-value customers get empathetic, relationship-preserving outreach that reduces churn risk.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <DollarSign className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Fraction of the Cost</h4>
                <p className="text-muted-foreground">
                  Get an entire CashOps department working 24/7 for less than the cost of a single full-time employee. Payments go directly to your account.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Shield className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Your Brand, Your Control</h4>
                <p className="text-muted-foreground">
                  All outreach comes from YOUR business, maintaining customer trust and compliance. You remain in complete control.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Human-in-the-Loop</h4>
                <p className="text-muted-foreground">
                  Every message is reviewed and approved by your team before sending. No surprises, full transparency.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <BarChart3 className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Full CashOps Dashboard</h4>
                <p className="text-muted-foreground">
                  Monitor DSO, outreach history, response rates, and payment status all in one place with real-time visibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Built for SaaS Companies
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Reduce ARR leakage with AI agents that work nonstop—at a fraction of the cost of one employee
          </p>
          <SaaSBenefits />
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Who Uses Recouply.ai?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Businesses across industries trust Recouply.ai's six AI agents to recover revenue while strengthening customer relationships.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div 
              className="bg-card p-6 rounded-lg border hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate("/solutions/home-services")}
            >
              <div className="text-4xl mb-3">🔧</div>
              <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">Home Services</h4>
              <p className="text-sm text-muted-foreground">
                Plumbing, HVAC, electrical, roofing, contractors
              </p>
            </div>

            <div 
              className="bg-card p-6 rounded-lg border hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate("/solutions/saas")}
            >
              <div className="text-4xl mb-3">💻</div>
              <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">SaaS Companies</h4>
              <p className="text-sm text-muted-foreground">
                Software companies, B2B service providers
              </p>
            </div>

            <div 
              className="bg-card p-6 rounded-lg border hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate("/solutions/home-services")}
            >
              <div className="text-4xl mb-3">🏪</div>
              <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">Local Retail</h4>
              <p className="text-sm text-muted-foreground">
                Retail shops, service providers, local businesses
              </p>
            </div>

            <div 
              className="bg-card p-6 rounded-lg border hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate("/solutions/professional-services")}
            >
              <div className="text-4xl mb-3">💼</div>
              <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">Professional Services</h4>
              <p className="text-sm text-muted-foreground">
                Agencies, consultants, accounting, legal
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Put Six AI Agents to Work?</h2>
          <p className="text-lg mb-8 opacity-90">
            Stop paying for expensive headcount. Our six AI agents work nonstop, recovering your revenue 24/7—getting smarter with every invoice.
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
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Home;