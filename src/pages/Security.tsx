import { useState } from "react";
import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Shield, 
  Lock, 
  Eye, 
  Server, 
  CheckCircle2, 
  FileText,
  Key,
  AlertTriangle,
  Globe,
  Brain,
  Download,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Security = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('contact_requests')
        .insert({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          message: `Security Inquiry: ${formData.message}`
        });

      if (error) throw error;

      toast.success("Message sent! We'll respond within 24 hours.");
      setFormData({ name: "", email: "", company: "", message: "" });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const securityPrinciples = [
    {
      icon: Lock,
      title: "Data Encryption",
      description: "All sensitive data encrypted at rest and in transit using TLS 1.2+. PII & financial data masking with secure secret storage & environment isolation."
    },
    {
      icon: Key,
      title: "Access Controls & Permissions",
      description: "Multi-tenant isolation with role-based access control (RBAC). Principle of least privilege enforced across all workspace-level permissions."
    },
    {
      icon: Eye,
      title: "Audit Logging & Monitoring",
      description: "System-wide audit logs for sensitive actions. Login attempts tracking, permission changes logged, suspicious behavior alerts, and exportable audit trails."
    },
    {
      icon: Server,
      title: "Secure Infrastructure",
      description: "Industry-standard cloud infrastructure with hardened environments. Regular vulnerability reviews, automated backups, and encrypted storage."
    }
  ];

  const complianceFrameworks = [
    { name: "SOC 2 Type II", status: "Aligned Controls" },
    { name: "ISO 27001", status: "Aligned Practices" },
    { name: "GDPR", status: "Data Subject Rights Workflow" },
    { name: "CCPA", status: "Transparency & Access Rights" },
    { name: "PCI-Aware", status: "Aligned Practices" }
  ];

  const privacyFeatures = [
    "Full customer ownership of data",
    "Export and portability tools",
    "Right-to-be-forgotten support",
    "Data retention controls",
    "Per-workspace data isolation",
    "No training AI models on customer data"
  ];

  const authFeatures = [
    "Multi-factor authentication (MFA) support",
    "Secure password hashing (bcrypt)",
    "Brute-force protection & rate limiting",
    "Session device tracking & management",
    "Automated suspicious login alerts",
    "Account lockout after failed attempts"
  ];

  const apiFeatures = [
    "Secure API token management",
    "Per-workspace API scoping",
    "Rate limiting & throttling",
    "Threat detection & monitoring",
    "TLS-only communication",
    "Automated secret rotation"
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Your Data. Fully Protected. Always Secure.
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Recouply.ai is built with enterprise-grade security, modern encryption standards, 
              strict access controls, and audit-ready infrastructure — ensuring your financial 
              and customer data is safe at all times.
            </p>
            <div className="flex justify-center pt-6">
              <Button size="lg" variant="outline" asChild>
                <a href="#contact">Contact Security Team</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Security Principles */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Core Security Principles</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built on a foundation of security-first architecture and best practices
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {securityPrinciples.map((principle, index) => {
              const Icon = principle.icon;
              return (
                <Card key={index} className="border-2 hover:border-primary/50 transition-all">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{principle.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{principle.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compliance Alignment */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Compliance Alignment</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We align with industry-standard compliance frameworks and best practices
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {complianceFrameworks.map((framework, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-lg">{framework.name}</CardTitle>
                  </div>
                  <CardDescription>{framework.status}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Important:</strong> Recouply.ai maintains compliance-aligned practices 
                  but does not claim formal certification unless explicitly stated. We're actively 
                  pursuing SOC 2 Type II certification.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Data Privacy & Customer Control */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Data Privacy & Customer Control
              </h2>
              <div className="space-y-4">
                {privacyFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">{feature}</p>
                  </div>
                ))}
              </div>
              <Card className="mt-8 bg-primary/5 border-primary/20">
                <CardContent className="py-4">
                  <p className="text-sm font-semibold">
                    Recouply.ai does not sell customer data. Ever.
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
                <Globe className="h-32 w-32 text-primary/40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Application Security */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Application Security</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Multi-layered security across authentication, operations, and API access
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Authentication Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {authFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  API Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {apiFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Safety & Compliance */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 md:order-1">
              <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center">
                <Brain className="h-32 w-32 text-primary/40" />
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Responsible AI & Collections Compliance
              </h2>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Our AI-powered collections system is designed with compliance and ethics at its core:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      AI-generated messages are always human-reviewed before sending
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      No threatening language or legal intimidation
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      No impersonation of third-party collections agencies
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      All messaging is white-labeled and internal-only
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Built-in compliance guardrails for collections communications
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Documentation */}
      <section id="security-docs" className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Security Documentation</h2>
          <p className="text-lg text-muted-foreground mb-12">
            Download comprehensive security documentation and compliance materials
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover:border-primary/50 transition-all cursor-pointer">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-lg">Security Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Coming Soon</p>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/50 transition-all cursor-pointer">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-lg">Security Questionnaire</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Request VSQ
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Coming Soon</p>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/50 transition-all cursor-pointer">
              <CardHeader>
                <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                <CardTitle className="text-lg">Data Processing Addendum</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Request DPA
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Coming Soon</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Security Team */}
      <section id="contact" className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4 mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl md:text-3xl">Contact Our Security Team</CardTitle>
              <CardDescription className="text-base">
                Need more information about our security or compliance practices? 
                We're here to help.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="john@company.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    required
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={5}
                    placeholder="Tell us about your security or compliance inquiry..."
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Or email us directly at{" "}
                    <a href="mailto:security@recouply.ai" className="text-primary hover:underline">
                      security@recouply.ai
                    </a>
                  </p>
                  <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Message"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to See Recouply.ai in Action?</h2>
          <p className="text-lg opacity-90">
            Experience enterprise-grade security with powerful AI-driven collections
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/signup">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-primary" asChild>
              <Link to="/contact">Schedule Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Security;
