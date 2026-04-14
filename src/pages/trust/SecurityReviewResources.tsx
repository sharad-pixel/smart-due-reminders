import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Server, Activity, FileText, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const resourceCards = [
  { icon: Shield, title: "Security Overview", description: "Our approach to protecting customer data and platform security posture." },
  { icon: Server, title: "Architecture Summary", description: "High-level overview of platform architecture, infrastructure, and data flows." },
  { icon: Lock, title: "Access Controls Summary", description: "Role-based access, authentication, and authorization controls." },
  { icon: Activity, title: "Incident Response Summary", description: "Our approach to incident detection, response, and customer notification." },
  { icon: FileText, title: "Data Handling Summary", description: "How we handle, store, retain, and protect customer data." },
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
        description="Request security documentation and support for your vendor due diligence and security review process with Recouply.ai."
        canonical="/trust/security-review-resources"
      />
      <div className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <button onClick={() => navigate("/trust")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Trust Center
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Security Review</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Security review resources</h1>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Recouply.ai supports customer due diligence with clear documentation, practical control summaries, and responsive security review support.
          </p>

          {/* Resource cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {resourceCards.map((card) => (
              <Card key={card.title} className="border-primary/10">
                <CardContent className="p-5">
                  <div className="p-2 rounded-lg bg-primary/10 w-fit mb-3">
                    <card.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Form */}
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">Request security information</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Fill out the form below and our team will follow up with the appropriate security documentation.
            </p>

            {submitted ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Thank you</h3>
                  <p className="text-sm text-muted-foreground">Our team will review your request and follow up with the appropriate security information.</p>
                </CardContent>
              </Card>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="company">Company *</Label>
                  <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="email">Work Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="deadline">Security review deadline</Label>
                  <Input id="deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="notes">Notes / Requested documents</Label>
                  <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Submitting..." : "Request Security Information"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default SecurityReviewResources;
