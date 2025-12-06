import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Rocket,
  Brain,
  Target,
  Zap,
  Shield,
  CheckCircle,
  ArrowRight,
  Briefcase,
  Award,
  Users,
  TrendingUp,
  Bot
} from "lucide-react";
import founderPhoto from "@/assets/founder-sharad.jpg";
import {
  founderConfig,
  companyTimeline,
  companyValues,
  enterpriseFeatures,
  startupFeatures,
  notableCompanies
} from "@/lib/founderConfig";

const About = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "About Recouply.ai — Founder Story & Company Mission";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Enterprise Functionality with Startup Mentality. Founded by RevOps leader Sharad Chanana with 15+ years modernizing RevOps, Q2C, Collections, and Billing at scale."
      );
    }
  }, []);

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-20 lg:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm">
              <Briefcase className="w-4 h-4 mr-2 inline" />
              Founded by Operators, Built for Revenue Teams
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Recouply.ai:
              </span>{" "}
              Enterprise Functionality with Startup Mentality
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Built by operators who have transformed Revenue Operations, Billing, and Collections 
              for the world's leading SaaS, AI, and enterprise companies.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm border rounded-full px-6 py-3 animate-float" style={{ animationDelay: '0.5s' }}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/30 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img 
                    src={founderPhoto} 
                    alt={founderConfig.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 transition-transform group-hover:scale-110"
                  />
                </div>
                <div className="text-left">
                  <p className="font-semibold">{founderConfig.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {founderConfig.yearsExperience} years modernizing RevOps, Q2C, Collections & Billing
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {notableCompanies.slice(0, 5).map((company) => (
                <Badge key={company} variant="outline" className="px-3 py-1">
                  {company}
                </Badge>
              ))}
              <Badge variant="outline" className="px-3 py-1">
                +{notableCompanies.length - 5} more
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Introduction */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-12 items-start">
              <div className="lg:col-span-2">
                <div className="sticky top-24">
                  <div className="relative group">
                    {/* Animated glow effect behind image */}
                    <div className="absolute inset-0 max-w-sm mx-auto rounded-2xl bg-gradient-to-br from-primary/30 via-primary/20 to-accent/30 blur-xl opacity-50 group-hover:opacity-80 transition-opacity animate-pulse-slow"></div>
                    
                    <div className="relative w-full aspect-square max-w-sm mx-auto rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 overflow-hidden border-2 border-primary/20 animate-float" style={{ animationDelay: '0.2s' }}>
                      <img 
                        src={founderPhoto} 
                        alt={founderConfig.name}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Overlay with info */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/60 to-transparent p-6">
                        <h3 className="text-2xl font-bold mb-1">{founderConfig.name}</h3>
                        <p className="text-muted-foreground">{founderConfig.title}, {founderConfig.company}</p>
                      </div>
                    </div>
                    
                    <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.6s' }}>
                      <p className="italic text-muted-foreground text-sm border-l-2 border-primary pl-4 text-left">
                        "Building the future of CashOps — where enterprise-grade reliability meets startup agility."
                      </p>
                      <p className="mt-3 font-signature text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        — {founderConfig.name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-3 space-y-6">
                <Badge variant="secondary" className="mb-4">
                  <Award className="w-4 h-4 mr-2" />
                  Meet the Founder
                </Badge>
                
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  A Leader Trusted by CROs, CFOs, and CEOs
                </h2>
                
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {founderConfig.bio}
                </p>
                
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Sharad is trusted by CROs, CFOs, and CEOs as a systems thinker and hands-on operator, 
                  known for delivering measurable outcomes in the most complex revenue environments.
                </p>
                
                <div className="pt-6">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Core Expertise
                  </h4>
                  <ul className="space-y-3">
                    {founderConfig.expertise.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Brain className="w-4 h-4 mr-2" />
              Our Mission
            </Badge>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              AI-Powered Cash Operations Designed by Real Operators
            </h2>
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              Recouply.ai was created to solve a real problem: companies struggle with late payments, 
              messy AR workflows, inaccurate billing, broken aging reports, and manual collections processes. 
              Built from real enterprise RevOps experience, Recouply.ai delivers a smarter, automated 
              approach to CashOps — turning AR chaos into clarity.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <CardContent className="pt-8 pb-8 relative">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Enterprise Functionality</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Robust billing logic, aging accuracy, compliance readiness, real data governance. 
                  Built for the complexity of modern revenue operations.
                </p>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
              <CardContent className="pt-8 pb-8 relative">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Rocket className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-3">Startup Mentality</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Fast iterations, intuitive UX, no red tape, and automation-first thinking. 
                  We move fast and ship features that matter.
                </p>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <CardContent className="pt-8 pb-8 relative">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI Where It Matters</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Intelligent matching, automated outreach, predictive risk scoring, and an 
                  agent-powered workforce that never sleeps.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Why "Enterprise Functionality + Startup Mentality" Matters
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Enterprise-Grade Reliability</h3>
                </div>
                <ul className="space-y-3">
                  {enterpriseFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold">Startup Agility</h3>
                </div>
                <ul className="space-y-3">
                  {startupFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Built by Experts</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  {founderConfig.yearsExperience} years of RevOps, Q2C, Billing, and Collections 
                  experience powering every workflow.
                </p>
                <p className="text-muted-foreground text-sm">
                  Designed with the realities of enterprise systems in mind — from ServiceTitan to 
                  Workday, Contentful to Maxio, and beyond.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <TrendingUp className="w-4 h-4 mr-2" />
              Journey
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              The Founder's Career Timeline
            </h2>
            <p className="text-lg text-muted-foreground">
              From enterprise revenue operations to building the future of CashOps
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 md:left-1/2 transform md:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-accent" />
              
              {companyTimeline.map((item, index) => (
                <div 
                  key={index} 
                  className={`relative flex items-start gap-8 mb-8 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-4 border-background z-10" />
                  
                  {/* Content */}
                  <div className={`flex-1 ml-12 md:ml-0 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                    <Card className="inline-block text-left">
                      <CardContent className="p-6">
                        <Badge variant="outline" className="mb-2">{item.year}</Badge>
                        <h4 className="font-bold text-lg mb-2">{item.company}</h4>
                        <p className="text-muted-foreground text-sm">{item.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Spacer for opposite side */}
                  <div className="hidden md:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Target className="w-4 h-4 mr-2" />
              Principles
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Values & Guiding Principles
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            {companyValues.map((value, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-8 pb-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">{index + 1}</span>
                  </div>
                  <h4 className="font-bold mb-2">{value.title}</h4>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Nicolas Callout */}
      <section className="py-12 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold">Meet Nicolas</h3>
            </div>
            <p className="text-muted-foreground">
              Our Knowledge Base Agent Nicolas is here to guide you across every page. 
              Have questions? Just click the chat icon in the corner!
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Transform Your Cash Operations?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join the companies already using Recouply.ai to accelerate collections and improve cash flow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="min-w-[220px]"
                onClick={() => navigate("/features")}
              >
                See How Recouply.ai Works
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="min-w-[220px]"
                onClick={() => navigate("/signup")}
              >
                Start Improving Cash Flow Today
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default About;
