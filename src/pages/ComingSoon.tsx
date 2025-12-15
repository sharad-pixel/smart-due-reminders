import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Brain, 
  CheckCircle, 
  Users, 
  Lightbulb, 
  Lock, 
  ArrowRight,
  Building2,
  Target,
  Zap,
  Clock,
  XCircle,
  Sparkles,
  BadgeCheck,
  Calendar,
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import { founderConfig, notableCompanies } from "@/lib/founderConfig";
import founderPhoto from "@/assets/founder-sharad-cartoon.png";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MarketingLayout from "@/components/MarketingLayout";

const ComingSoon = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    monthlyInvoices: "",
    biggestChallenge: "",
    whyInterested: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.company.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('contact_requests')
        .insert([{ 
          name: formData.name.trim(),
          email: formData.email.trim(),
          company: formData.company.trim(),
          team_size: formData.role,
          monthly_invoices: formData.monthlyInvoices,
          message: `Biggest Challenge: ${formData.biggestChallenge}\n\nWhy Interested: ${formData.whyInterested}`
        }]);
      
      if (error) throw error;

      // Send admin alert
      try {
        await supabase.functions.invoke('send-admin-alert', {
          body: { 
            type: 'design_partner_application', 
            email: formData.email,
            name: formData.name.trim(),
            company: formData.company.trim()
          }
        });
      } catch (alertErr) {
        console.error('Failed to send admin alert:', alertErr);
      }
      
      toast.success("Application received!", {
        description: "We'll review your application and be in touch within 48 hours."
      });
      setFormData({
        name: "",
        email: "",
        company: "",
        role: "",
        monthlyInvoices: "",
        biggestChallenge: "",
        whyInterested: ""
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <RecouplyLogo size="xl" animated className="justify-center text-4xl" />
              <p className="text-lg text-muted-foreground flex items-center justify-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Collection Intelligence Platform
              </p>
            </div>
            
            <div className="space-y-6 pt-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                We're Building <span className="text-primary">Collection Intelligence</span> with Continuous Risk Assessment for Your Receivables
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                And we're looking for a small group of forward-thinking finance leaders to build it with us.
              </p>
            </div>

            <Button 
              size="lg" 
              className="text-lg px-8 py-6 gap-2"
              onClick={() => document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Apply to Become a Design Partner
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Why Design Partners Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Why Become a Design Partner?
              </h2>
              <p className="text-lg text-muted-foreground">
                This isn't a beta test. It's a partnership.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Early Access</h3>
                  <p className="text-muted-foreground">
                    Be the first to use features before anyone else. Get a head start on AI-powered collections.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Shape the Roadmap</h3>
                  <p className="text-muted-foreground">
                    Direct input on features and priorities. Your feedback drives what we build next.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">Locked Pricing</h3>
                  <p className="text-muted-foreground">
                    Lock in founding member pricing for life. As we grow, your rate stays the same.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                The Collections Problem
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Problem Side */}
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    Today's Reality
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    "Manual follow-ups that eat hours every week",
                    "Spreadsheets to track who owes what",
                    "Generic email templates that get ignored",
                    "No visibility into collection effectiveness",
                    "Inconsistent tone across team members",
                    "Important customers falling through cracks"
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Solution Side */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <CheckCircle className="h-5 w-5" />
                    What We're Building
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    "AI agents that handle outreach automatically",
                    "Intelligent prioritization based on risk",
                    "Personalized messages that sound human",
                    "Real-time dashboards and analytics",
                    "Consistent tone with escalating urgency",
                    "Every invoice tracked, nothing missed"
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Preview Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground flex items-center justify-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                Collection Intelligence
              </h2>
              <p className="text-lg text-muted-foreground">
                A glimpse of what's coming
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {[
                {
                  icon: Users,
                  title: "AI Agent Team",
                  description: "Six specialized AI agents, each trained for different aging buckets and communication styles."
                },
                {
                  icon: Target,
                  title: "Risk Scoring",
                  description: "Automatically prioritize accounts based on payment behavior, history, and collection likelihood."
                },
                {
                  icon: Clock,
                  title: "Automated Workflows",
                  description: "Set it and forget it. AI handles the cadence while you focus on strategic accounts."
                },
                {
                  icon: Sparkles,
                  title: "Smart Drafting",
                  description: "AI-composed messages that adapt tone based on relationship history and invoice age."
                }
              ].map((feature, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="pt-6 space-y-3">
                    <feature.icon className="h-8 w-8 text-primary" />
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ideal Partner Profile Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Who We're Looking For
              </h2>
              <p className="text-lg text-muted-foreground">
                Design Partners who will get the most value from this partnership
              </p>
            </div>

            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    "SaaS or B2B services company",
                    "100+ invoices per month",
                    "Dedicated AR/Finance person",
                    "Open to trying new approaches",
                    "Willing to share honest feedback",
                    "Available for monthly check-ins"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground text-center">
                    Not every company is a fit, and that's okay. We're selective because we want to build deep relationships with partners who will truly benefit.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-primary/20 overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-5 gap-0">
                  {/* Photo Column */}
                  <div className="md:col-span-2 bg-gradient-to-br from-primary/10 to-accent/10 p-8 flex items-center justify-center">
                    <div className="space-y-4 text-center">
                      <div className="w-32 h-32 mx-auto rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-4 border-background shadow-xl">
                        <img 
                          src={founderPhoto} 
                          alt={founderConfig.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{founderConfig.name}</h3>
                        <p className="text-sm text-muted-foreground">{founderConfig.title}</p>
                      </div>
                      <a 
                        href={founderConfig.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        View LinkedIn Profile
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  {/* Bio Column */}
                  <div className="md:col-span-3 p-8 space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold">From the Founder</h2>
                      <p className="text-sm text-muted-foreground">{founderConfig.yearsExperience} years in Revenue Operations</p>
                    </div>
                    
                    <blockquote className="text-muted-foreground leading-relaxed border-l-2 border-primary pl-4 italic">
                      "I've spent my career building and operating CPQ, Billing, Revenue Recognition, and Order-to-Cash systems at Workday, Contentful, and Leanplum (now CleverTap). Across companies and growth stages, the same gaps kept appearing: fragmented data, manual prioritization, and no continuous way to apply Collection Intelligence and real-time risk assessments to receivables. Recouply.ai was built to close that gap—bringing intelligence, automation, and visibility into how cash is actually collected."
                    </blockquote>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Previous experience includes:</p>
                      <div className="flex flex-wrap gap-2">
                        {['ServiceTitan', 'Workday', 'Contentful', 'Maxio', 'Chegg'].map((company) => (
                          <span 
                            key={company}
                            className="text-xs px-3 py-1 bg-muted rounded-full text-muted-foreground"
                          >
                            {company}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(founderConfig.calendly, '_blank')}
                        className="gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Book a Call
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Application Form Section */}
      <section id="apply-form" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Apply to Become a Design Partner
              </h2>
              <p className="text-lg text-muted-foreground">
                Tell us about your company and collection challenges
              </p>
            </div>

            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Jane Smith"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Work Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="jane@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company Name *</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Acme Inc"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Your Role</Label>
                      <Input
                        id="role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        placeholder="VP Finance, AR Manager, etc."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyInvoices">Monthly Invoice Volume</Label>
                    <Select 
                      value={formData.monthlyInvoices} 
                      onValueChange={(value) => setFormData({ ...formData, monthlyInvoices: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under-100">Under 100</SelectItem>
                        <SelectItem value="100-500">100 - 500</SelectItem>
                        <SelectItem value="500-1000">500 - 1,000</SelectItem>
                        <SelectItem value="1000-5000">1,000 - 5,000</SelectItem>
                        <SelectItem value="5000+">5,000+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="challenge">What's your biggest collections challenge?</Label>
                    <Textarea
                      id="challenge"
                      value={formData.biggestChallenge}
                      onChange={(e) => setFormData({ ...formData, biggestChallenge: e.target.value })}
                      placeholder="e.g., Too much manual follow-up, inconsistent processes, no visibility into aging..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interest">Why are you interested in being a Design Partner?</Label>
                    <Textarea
                      id="interest"
                      value={formData.whyInterested}
                      onChange={(e) => setFormData({ ...formData, whyInterested: e.target.value })}
                      placeholder="Tell us what you hope to get out of this partnership..."
                      rows={3}
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                    {loading ? (
                      "Submitting..."
                    ) : (
                      <>
                        Submit Application
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    We review every application personally. Expect to hear back within 48 hours.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

    </MarketingLayout>
  );
};

export default ComingSoon;
