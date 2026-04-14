import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Lock, Server, Eye, Activity, RefreshCw, Brain, CheckCircle2, ArrowRight, ShieldCheck, FileText, Users, Workflow, ClipboardCheck } from "lucide-react";

const securityCards = [
  { icon: Lock, title: "Data Security", description: "All customer data is encrypted in transit using TLS 1.2+ and at rest using AES-256. We apply data minimization principles and controlled retention policies." },
  { icon: Users, title: "Access Controls", description: "Role-based access controls enforce least-privilege principles. Privileged access requires multi-factor authentication and is subject to regular review." },
  { icon: Server, title: "Infrastructure Security", description: "Our platform runs on enterprise-grade cloud infrastructure with automated patching, network isolation, and continuous monitoring across all environments." },
  { icon: Shield, title: "Application Security", description: "We follow secure development practices including code review, dependency scanning, environment separation, and structured change management." },
  { icon: Activity, title: "Monitoring & Logging", description: "Comprehensive audit logs track user actions, system events, and data access. Logs are retained for compliance and incident investigation purposes." },
  { icon: RefreshCw, title: "Business Continuity", description: "Routine backups, recovery planning, and infrastructure redundancy ensure minimal disruption. We continuously evaluate our continuity posture." },
];

const trustReasons = [
  { icon: Workflow, text: "Centralized handoffs between team members with full audit visibility" },
  { icon: ClipboardCheck, text: "Approval-based outreach ensures every message is reviewed before sending" },
  { icon: Eye, text: "Complete audit trails for every action, draft, and communication" },
  { icon: Users, text: "Operational accountability through role-based permissions and task assignment" },
  { icon: Shield, text: "Reduced manual risk with structured, repeatable workflows" },
  { icon: Brain, text: "Controlled AI-assisted workflows with human oversight at every step" },
];

const faqItems = [
  { q: "How is customer data protected?", a: "Customer data is protected through encryption in transit and at rest, role-based access controls, logical data segregation, and continuous monitoring. We apply data minimization principles and maintain controlled retention and deletion processes." },
  { q: "Does Recouply.ai support role-based permissions?", a: "Yes. Recouply.ai enforces role-based access controls across the platform. Users are assigned roles that govern their access to data, workflows, and administrative functions. Access follows least-privilege principles." },
  { q: "Is data encrypted?", a: "All data is encrypted in transit using TLS 1.2+ and at rest using AES-256 encryption. This applies to all customer data including invoices, communications, workflow records, and uploaded documents." },
  { q: "Does Recouply.ai maintain audit logs?", a: "Yes. Comprehensive audit logs capture user actions, system events, workflow changes, and data access. These logs support compliance requirements, internal reviews, and incident investigation." },
  { q: "How does Recouply.ai handle backups?", a: "We perform routine automated backups with defined recovery objectives. Our backup strategy includes geographic redundancy and regular restoration testing to ensure data availability." },
  { q: "Can customer data be deleted upon request?", a: "Yes. We support data deletion requests in accordance with applicable privacy regulations. Customers can request deletion of their data, and we process these requests within documented timeframes." },
  { q: "How does Recouply.ai support security reviews?", a: "We provide security documentation, architecture summaries, and control descriptions to support customer due diligence. Our team can respond to security questionnaires and participate in review calls as needed." },
  { q: "Does Recouply.ai use secure third-party providers?", a: "Yes. We rely on established, enterprise-grade infrastructure and service providers. All critical vendors are evaluated for security posture and are subject to periodic review." },
  { q: "How are application changes monitored?", a: "All code changes go through structured review processes. We maintain environment separation, automated testing, and change management procedures to ensure stability and security." },
  { q: "How does Recouply.ai support secure integrations?", a: "Integrations with platforms like Stripe and QuickBooks use secure, authenticated API connections with scoped permissions. We do not store integration credentials in application code." },
];

const TrustCenter = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEOHead
        title="Trust Center | Recouply.ai"
        description="Explore Recouply.ai's approach to security, access controls, auditability, data protection, and customer trust for finance and collections workflows."
        canonical="/trust"
      />

      {/* Hero */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Trust Center</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Security and trust, built into every workflow
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Recouply.ai helps finance teams centralize collections operations with secure workflows, role-based access, audit-ready visibility, and controlled automation.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/trust/security-review-resources")}>
                  Request Security Information
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
                  Contact Sales
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Lock, label: "Encryption in transit and at rest" },
                { icon: Users, label: "Role-based access controls" },
                { icon: Eye, label: "Audit logs and workflow traceability" },
                { icon: Server, label: "Secure infrastructure and backups" },
              ].map((item) => (
                <Card key={item.label} className="border-primary/10 bg-card/80">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Overview Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Security overview</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Our security controls are designed to protect customer data and support enterprise expectations across every layer of the platform.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityCards.map((card) => (
              <Card key={card.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Customers Trust Us */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why customers trust Recouply.ai</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Recouply.ai is purpose-built for finance and collections workflows where accountability, auditability, and controlled operations are essential.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trustReasons.map((reason) => (
              <div key={reason.text} className="flex items-start gap-4 p-4">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <reason.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Governance */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI Governance</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Controlled automation, not autonomous AI</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">AI-assisted features in Recouply.ai are designed with guardrails, oversight, and traceability at every step.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Pre-approved workflow steps define when and how AI generates content",
              "Approval-based messaging ensures human review before outreach is sent",
              "Human oversight is maintained for all sensitive communications",
              "Every draft, edit, and outreach action is logged and traceable",
              "Reduced manual errors through consistent, template-driven workflows",
              "AI suggestions can be accepted, edited, or rejected at any point",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-3">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Policies Quick Links */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Security policies</h2>
            <p className="text-muted-foreground">Review our security practices and policies in detail.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Security Overview", path: "/trust/security-overview", icon: Shield },
              { title: "Access Control", path: "/trust/access-control", icon: Lock },
              { title: "Data Protection", path: "/trust/data-protection", icon: Server },
              { title: "Incident Response", path: "/trust/incident-response", icon: Activity },
              { title: "Business Continuity", path: "/trust/business-continuity", icon: RefreshCw },
              { title: "Application Security", path: "/trust/application-security", icon: Shield },
              { title: "Vendor Security", path: "/trust/vendor-security", icon: Users },
              { title: "Privacy & Data Handling", path: "/trust/privacy-data-handling", icon: FileText },
            ].map((policy) => (
              <button
                key={policy.path}
                onClick={() => navigate(policy.path)}
                className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left group"
              >
                <policy.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">{policy.title}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                <AccordionTrigger className="text-left text-sm font-medium">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Need help with a security review?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Our team can help you navigate security questionnaires, architecture questions, and procurement diligence.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/trust/security-review-resources")}>
              Request Security Information
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default TrustCenter;
