import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Shield, Lock, Server, Eye, Activity, RefreshCw, Brain,
  CheckCircle2, ArrowRight, ShieldCheck, FileText, Users,
  Workflow, ClipboardCheck, Database, Code, Fingerprint, KeyRound
} from "lucide-react";

const securityCards = [
  { icon: Database, title: "Data Security", description: "AES-256 encryption at rest. TLS 1.2+ in transit. Logical tenant isolation. Data minimization by design." },
  { icon: KeyRound, title: "Access Controls", description: "RBAC with least-privilege enforcement. MFA for privileged access. Automated onboarding and offboarding workflows." },
  { icon: Server, title: "Infrastructure", description: "Enterprise-grade cloud hosting. Network isolation, automated patching, and multi-AZ redundancy across production systems." },
  { icon: Code, title: "Application Security", description: "Mandatory code review. Dependency scanning. Environment separation. Structured change management with rollback capability." },
  { icon: Eye, title: "Audit & Monitoring", description: "Every user action, workflow change, and data access event is logged. Retained for compliance, investigation, and operational review." },
  { icon: RefreshCw, title: "Business Continuity", description: "Automated backups with geo-redundancy. Defined RPO/RTO. Regular restoration testing and continuity scenario planning." },
];

const trustReasons = [
  { icon: Workflow, title: "Centralized handoffs", text: "Every account transition between team members is logged with full context and audit visibility." },
  { icon: ClipboardCheck, title: "Approval-gated outreach", text: "No message reaches a customer without passing through configured approval workflows." },
  { icon: Eye, title: "Complete audit trails", text: "Every draft, edit, send, and escalation is recorded — searchable and exportable." },
  { icon: Fingerprint, title: "Role-based accountability", text: "Permissions map to job functions. Who did what, when, and why is always answerable." },
  { icon: Shield, title: "Structured workflows", text: "Repeatable, template-driven processes replace ad-hoc manual actions and reduce operational risk." },
  { icon: Brain, title: "Human-in-the-loop AI", text: "AI generates drafts. Humans approve them. Every suggestion is traceable and reversible." },
];

const faqItems = [
  { q: "How is customer data protected?", a: "Encryption in transit (TLS 1.2+) and at rest (AES-256), role-based access controls, logical tenant isolation, continuous monitoring, and data minimization by design." },
  { q: "Does Recouply.ai support role-based permissions?", a: "Yes. RBAC governs access to data, workflows, outreach tools, and admin settings. Roles follow least-privilege principles and can be managed directly by customer admins." },
  { q: "Is data encrypted?", a: "All data is encrypted in transit and at rest. This covers invoices, communications, workflow records, uploaded documents, and all customer-submitted content." },
  { q: "Does Recouply.ai maintain audit logs?", a: "Yes. Comprehensive logs capture every user action, workflow change, outreach event, and data access. Logs are retained for compliance and are available for customer review." },
  { q: "How does Recouply.ai handle backups?", a: "Automated backups run on defined schedules with geo-redundant storage. We regularly test restoration procedures and maintain documented RPO/RTO targets." },
  { q: "Can customer data be deleted upon request?", a: "Yes. We process deletion requests in accordance with applicable privacy regulations within documented timeframes." },
  { q: "How does Recouply.ai support security reviews?", a: "We provide architecture summaries, control descriptions, and policy documentation. Our team responds to security questionnaires and can join review calls." },
  { q: "Does Recouply.ai use secure third-party providers?", a: "Yes. We use established infrastructure partners with strong security programs. All critical vendors are evaluated before engagement and reviewed periodically." },
  { q: "How are application changes managed?", a: "All changes go through peer review, automated testing, and structured deployment pipelines. Environment separation prevents untested code from reaching production." },
  { q: "How are integrations secured?", a: "Integrations with Stripe, QuickBooks, and other platforms use authenticated API connections with scoped permissions. No integration credentials are stored in application code." },
];

const policyLinks = [
  { title: "Security Overview", desc: "Commitment, safeguards, and controls", path: "/trust/security-overview", icon: Shield },
  { title: "Access Control", desc: "RBAC, MFA, and credential management", path: "/trust/access-control", icon: KeyRound },
  { title: "Data Protection", desc: "Encryption, segregation, and retention", path: "/trust/data-protection", icon: Database },
  { title: "Incident Response", desc: "Detection, triage, and notification", path: "/trust/incident-response", icon: Activity },
  { title: "Business Continuity", desc: "Backups, recovery, and redundancy", path: "/trust/business-continuity", icon: RefreshCw },
  { title: "Application Security", desc: "Secure SDLC and change management", path: "/trust/application-security", icon: Code },
  { title: "Vendor Security", desc: "Third-party review and oversight", path: "/trust/vendor-security", icon: Users },
  { title: "Privacy & Data Handling", desc: "Data use, retention, and deletion", path: "/trust/privacy-data-handling", icon: FileText },
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
      <section className="py-24 px-4 bg-gradient-to-br from-primary/8 via-primary/3 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.06),transparent_70%)]" />
        <div className="container mx-auto max-w-6xl relative">
          <div className="grid lg:grid-cols-5 gap-16 items-center">
            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold tracking-wide uppercase text-primary">Trust Center</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.15] mb-5">
                Security and trust,{" "}
                <span className="text-primary">built into every workflow</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl leading-relaxed">
                Recouply.ai gives finance teams secure, auditable, approval-gated collections workflows — with the controls mid-market and enterprise buyers expect.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/trust/security-review-resources")}>
                  Request Security Pack
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
                  Contact Sales
                </Button>
              </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              {[
                { icon: Lock, label: "Encryption", sub: "TLS 1.2+ / AES-256" },
                { icon: KeyRound, label: "Access Controls", sub: "RBAC + MFA" },
                { icon: Eye, label: "Audit Logs", sub: "Full traceability" },
                { icon: Server, label: "Infrastructure", sub: "Multi-AZ, geo-redundant" },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl border bg-card/90 backdrop-blur-sm hover:border-primary/30 transition-colors">
                  <item.icon className="h-5 w-5 text-primary mb-3" />
                  <p className="text-sm font-semibold mb-0.5">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Overview Grid */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="max-w-2xl mb-14">
            <h2 className="text-3xl font-bold mb-3">Platform security controls</h2>
            <p className="text-muted-foreground">Layered protections across data, infrastructure, application, and operations.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {securityCards.map((card) => (
              <Card key={card.title} className="border-border/60 hover:border-primary/20 hover:shadow-lg transition-all duration-200 group">
                <CardContent className="p-6">
                  <div className="p-2.5 rounded-lg bg-primary/8 w-fit mb-4 group-hover:bg-primary/12 transition-colors">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Customers Trust Us */}
      <section className="py-24 px-4 bg-muted/40 border-y">
        <div className="container mx-auto max-w-6xl">
          <div className="max-w-2xl mb-14">
            <h2 className="text-3xl font-bold mb-3">Built for finance-team accountability</h2>
            <p className="text-muted-foreground">Every feature in Recouply.ai is designed around auditability, controlled operations, and operational trust.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trustReasons.map((reason) => (
              <div key={reason.title} className="p-5 rounded-xl bg-card border hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/8">
                    <reason.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{reason.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Governance */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold tracking-wide uppercase text-primary">AI Governance</span>
              </div>
              <h2 className="text-3xl font-bold mb-4">Controlled automation,<br />not autonomous AI</h2>
              <p className="text-muted-foreground leading-relaxed">
                AI in Recouply.ai operates within pre-defined guardrails. Every generated draft, suggested action, and automated step is traceable, reviewable, and subject to human approval.
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Workflow steps define exactly when and how AI generates content",
                "Every draft requires human approval before it can be sent",
                "Sensitive communications always route through manual review",
                "All AI-generated content is logged with full audit context",
                "Template-driven workflows reduce manual error and improve consistency",
                "Any AI suggestion can be edited, rejected, or escalated",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Policies */}
      <section className="py-24 px-4 bg-muted/40 border-y">
        <div className="container mx-auto max-w-6xl">
          <div className="max-w-2xl mb-14">
            <h2 className="text-3xl font-bold mb-3">Security policies & documentation</h2>
            <p className="text-muted-foreground">Detailed documentation covering every aspect of our security program.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {policyLinks.map((policy) => (
              <button
                key={policy.path}
                onClick={() => navigate(policy.path)}
                className="flex flex-col gap-3 p-5 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md transition-all text-left group"
              >
                <policy.icon className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors block mb-0.5">{policy.title}</span>
                  <span className="text-xs text-muted-foreground">{policy.desc}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-auto" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="max-w-xl mb-14">
            <h2 className="text-3xl font-bold mb-3">Security FAQ</h2>
            <p className="text-muted-foreground">Quick answers to common questions from security and procurement teams.</p>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-5 data-[state=open]:bg-muted/30 transition-colors">
                <AccordionTrigger className="text-left text-sm font-semibold py-4 hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 px-4 bg-gradient-to-br from-primary/8 via-primary/4 to-background border-t">
        <div className="container mx-auto max-w-2xl text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Need help with a security review?</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            We support procurement and security teams with architecture documentation, control summaries, and responsive diligence support.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/trust/security-review-resources")}>
              Request Security Pack
              <ArrowRight className="ml-2 h-4 w-4" />
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
