import MarketingLayout from "@/components/MarketingLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  MapPin,
  Building2,
  Users,
  Code2,
  Zap,
  Target,
  CheckCircle,
  Mail,
  Rocket,
  TrendingUp,
  Shield,
  Brain
} from "lucide-react";
import SEO from "@/components/SEO";
import COMPANY_INFO from "@/lib/companyConfig";

const Careers = () => {
  return (
    <MarketingLayout>
      <SEO
        title="Careers at Recouply.ai | Join Our Team"
        description="Join the Recouply.ai team and help build the future of Collection Intelligence. View open positions and apply today."
        canonical="https://recouply.ai/careers"
        keywords="Recouply careers, collection intelligence jobs, fintech jobs, startup jobs, founding engineer"
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-20 lg:py-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm">
              <Briefcase className="w-4 h-4 mr-2 inline" />
              Join Our Team
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Build the Future of{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Collection Intelligence
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed max-w-3xl mx-auto">
              We're looking for exceptional people who want to transform how businesses manage 
              accounts receivable and collections.
            </p>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Open Positions</h2>
              <p className="text-lg text-muted-foreground">
                Explore opportunities to make an impact at Recouply.ai
              </p>
            </div>

            {/* Founding Engineer Role */}
            <Card className="border-primary/20 hover:shadow-xl transition-all duration-300" id="founding-engineer">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Badge variant="default" className="bg-primary">
                    <Rocket className="w-3 h-3 mr-1" />
                    Founding Role
                  </Badge>
                  <Badge variant="outline">Equity Only</Badge>
                  <Badge variant="secondary">Remote</Badge>
                </div>
                <CardTitle className="text-2xl md:text-3xl">Founding Engineer (Equity Only)</CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Recouply.ai
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Remote (US-preferred)
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Reports to Founder / CEO
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-8">
                {/* About Recouply.ai */}
                <div>
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    About Recouply.ai
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    Recouply.ai is a Collection Intelligence Platform helping businesses automate, 
                    centralize, and optimize accounts receivable and collections.
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    <strong className="text-foreground">Cash flow isn't a back-office problem — it's a growth strategy.</strong>
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    We bring AI-driven workflows, real-time insights, and professional customer engagement 
                    to a function that has historically been manual, fragmented, and reactive.
                  </p>
                </div>

                <Separator />

                {/* The Role */}
                <div>
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-primary" />
                    The Role
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    We are looking for a <strong className="text-foreground">Founding Engineer</strong> to 
                    join Recouply.ai as an early technical partner. This is an equity-only role for someone 
                    who believes in the long-term vision and wants meaningful ownership in what we're building.
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    You will work directly with the founder to design, build, and scale the core platform — 
                    shaping both the product architecture and engineering culture from day one.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    This role is not a contract position and not a short-term engagement. It is for someone 
                    who wants to build a company, take real ownership, and grow with the business.
                  </p>
                </div>

                <Separator />

                {/* What You'll Work On */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    What You'll Work On
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Build and evolve core platform features across frontend, backend, and integrations",
                      "Own key integrations (e.g., Stripe, QuickBooks, billing and payment systems)",
                      "Design scalable data models for invoices, payments, customers, and risk signals",
                      "Develop AI-assisted workflows for collections, outreach, and insights",
                      "Improve system reliability, performance, and security",
                      "Partner closely with the founder on architecture, roadmap, and product decisions",
                      "Help establish engineering standards and technical direction as the company grows"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* Must-Have Qualifications */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Must-Have Qualifications
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Strong full-stack engineering experience (senior-level or equivalent)",
                      "Proven ability to build and ship production SaaS products",
                      "Experience with modern web stacks (e.g., React, TypeScript, Node.js)",
                      "Experience building APIs, integrations, and data pipelines",
                      "Comfortable operating in ambiguity and early-stage environments",
                      "Founder mentality: ownership, accountability, and bias toward action",
                      "Strong product intuition and systems thinking"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Nice-to-Have */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Nice-to-Have Qualifications</h3>
                  <ul className="space-y-2">
                    {[
                      "Experience in fintech, payments, invoicing, or accounting systems",
                      "Familiarity with Supabase, Postgres, or serverless architectures",
                      "Experience building AI-powered or workflow-driven products",
                      "Prior startup, founding, or early-employee experience",
                      "Experience designing systems with auditability and compliance in mind"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                        <span className="text-muted-foreground text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* What Success Looks Like */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    What Success Looks Like
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Core workflows are scalable, reliable, and extensible",
                      "Integrations are stable and observable",
                      "Technical decisions support long-term scale, not short-term hacks",
                      "Product velocity increases without sacrificing quality",
                      "You operate as a true technical partner to the founder"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* Why Join */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Why Join Recouply.ai
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Meaningful equity ownership from the earliest stage",
                      "Real influence over product, architecture, and company direction",
                      "Opportunity to build foundational infrastructure in a large, underserved market",
                      "Long-term upside aligned with company success",
                      "Flexible, remote-first collaboration"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                {/* Compensation */}
                <div>
                  <h3 className="text-xl font-semibold mb-3">Compensation</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="text-muted-foreground">
                        Equity only (no salary or cash compensation at this stage)
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="text-muted-foreground">
                        Equity structure commensurate with founding-level contribution and ownership
                      </span>
                    </li>
                  </ul>
                </div>

                <Separator />

                {/* How to Apply */}
                <div className="bg-muted/30 rounded-lg p-6 border border-border">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    How to Apply
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Interested candidates should submit:
                  </p>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">Their resume</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        A short note explaining why they are interested in an equity-only founding role at Recouply.ai
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        (Optional) Links to GitHub, LinkedIn, or relevant projects
                      </span>
                    </li>
                  </ul>
                  <p className="text-muted-foreground">
                    All applications should be sent to:{" "}
                    <a 
                      href="mailto:legal@recouply.ai" 
                      className="text-primary font-semibold hover:underline"
                    >
                      legal@recouply.ai
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Don't see your role?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're always looking for talented people who share our vision. Send us your resume at{" "}
            <a 
              href={`mailto:${COMPANY_INFO.emails.support}`}
              className="text-primary font-semibold hover:underline"
            >
              {COMPANY_INFO.emails.support}
            </a>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Careers;
