import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server, Activity, FileText, ArrowLeft, CheckCircle2, ShieldCheck, ArrowRight, Building2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const resourceCards = [
  { icon: Shield, title: "Security Overview", description: "Platform security posture and control framework." },
  { icon: Server, title: "Architecture Summary", description: "Infrastructure, data flows, and deployment model." },
  { icon: Lock, title: "Access Controls", description: "RBAC, MFA, and credential management practices." },
  { icon: Activity, title: "Incident Response", description: "Detection, escalation, and notification procedures." },
  { icon: FileText, title: "Data Handling", description: "Encryption, retention, isolation, and deletion." },
];

const SecurityReviewResources = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", deadline: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.company || !form.email) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("contact_requests").insert({
        name: form.name,
        company: form.company,
        email: form.email,
        message: `Security Review Request\nDeadline: ${form.deadline || "Not specified"}\nNotes: ${form.notes || "None"}`,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <SEOHead
        title="Security Review Resources | Trust Center | Recouply.ai"
        description="Request security documentation and support for your vendor due diligence and security review with Recouply.ai."
        canonical="/trust/security-review-resources"
      />
      <div className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <button onClick={() => navigate("/trust")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-10 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trust Center
          </button>

          {/* Header */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold tracking-wide uppercase text-primary">Security Review</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Security review resources</h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              We support procurement and security teams with clear documentation, practical control summaries, and responsive diligence support. Request what you need below.
            </p>
          </div>

          {/* Available resources */}
          <div className="mb-20">
            <h2 className="text-lg font-semibold mb-5">Available documentation</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {resourceCards.map((card) => (
                <div key={card.title} className="p-4 rounded-xl border bg-card hover:border-primary/20 transition-colors">
                  <card.icon className="h-5 w-5 text-primary mb-3" />
                  <p className="text-sm font-semibold mb-1">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold mb-2">Request security information</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Tell us what you need and we'll follow up with the relevant documentation — typically within 2 business days.
              </p>

              {submitted ? (
                <div className="p-10 rounded-xl border border-primary/20 bg-primary/5 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-lg mb-2">Request received</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">Our team will review your request and follow up with the appropriate security information.</p>
                  <Button variant="outline" className="mt-6" onClick={() => navigate("/trust")}>
                    Back to Trust Center
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Name *</Label>
                      <Input id="name" placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="company" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Company *</Label>
                      <Input id="company" placeholder="Acme Corp" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Work Email *</Label>
                      <Input id="email" type="email" placeholder="jane@acme.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="deadline" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Review Deadline</Label>
                      <Input id="deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Notes / Requested Documents</Label>
                    <Textarea id="notes" placeholder="e.g., SOC 2 narrative, architecture diagram, vendor questionnaire..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
                  </div>
                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
                    {submitting ? "Submitting..." : "Request Security Pack"}
                    {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Typical response time</p>
                </div>
                <p className="text-sm text-muted-foreground">We respond to security review requests within 2 business days. Expedited turnaround is available for time-sensitive procurement.</p>
              </div>
              <div className="p-5 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">What we provide</p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Security overview document</li>
                  <li>• Architecture & data flow summary</li>
                  <li>• Completed vendor questionnaires</li>
                  <li>• Policy documentation</li>
                  <li>• Live review calls if needed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default SecurityReviewResources;
