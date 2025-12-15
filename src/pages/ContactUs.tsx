import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import MarketingLayout from "@/components/MarketingLayout";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { HoneypotField, isHoneypotTriggered } from "@/components/HoneypotField";
import { checkClientRateLimit } from "@/lib/rateLimiting";

const INTENT_OPTIONS = [
  { value: "general", label: "General Inquiry" },
  { value: "investment", label: "Investment Opportunities" },
  { value: "partnership", label: "Partnership" },
  { value: "enterprise", label: "Enterprise / Bespoke Plan" },
  { value: "support", label: "Product Support" },
  { value: "demo", label: "Request a Demo" },
] as const;

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  company: z.string().trim().min(1, "Company is required").max(200),
  intent: z.string().min(1, "Please select a reason for contacting us"),
  billingSystem: z.string().optional(),
  monthlyInvoices: z.string().optional(),
  teamSize: z.string().optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(1000),
  website: z.string().max(0, "Invalid submission").optional(),
});

const ContactUs = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  
  // Get initial intent from URL params (e.g., /contact?intent=investment)
  const initialIntent = searchParams.get("intent") || "";
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    intent: initialIntent,
    billingSystem: "",
    monthlyInvoices: "",
    teamSize: "",
    message: ""
  });

  const showBusinessFields = formData.intent === "enterprise" || formData.intent === "demo";

  useEffect(() => {
    document.title = "Contact Us – Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Get in touch with Recouply.ai. Contact us for inquiries, partnerships, investment opportunities, or enterprise plans.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isHoneypotTriggered(honeypot)) {
      setSubmitted(true);
      return;
    }
    
    const rateLimit = checkClientRateLimit('contact_form');
    if (!rateLimit.allowed) {
      toast.error("Too many submissions. Please try again later.");
      return;
    }
    
    setLoading(true);

    try {
      const validatedData = contactSchema.parse({ ...formData, website: honeypot });

      const intentLabel = INTENT_OPTIONS.find(o => o.value === validatedData.intent)?.label || validatedData.intent;

      const { error } = await supabase
        .from('contact_requests')
        .insert([{
          name: validatedData.name,
          email: validatedData.email,
          company: validatedData.company,
          billing_system: validatedData.billingSystem || null,
          monthly_invoices: validatedData.monthlyInvoices || null,
          team_size: validatedData.teamSize || null,
          message: `[${intentLabel}] ${validatedData.message}`
        }]);

      if (error) throw error;

      await supabase.functions.invoke('send-admin-alert', {
        body: {
          type: 'contact_request',
          email: validatedData.email,
          name: validatedData.name,
          company: validatedData.company,
          message: validatedData.message,
          intent: intentLabel,
          billingSystem: validatedData.billingSystem,
          monthlyInvoices: validatedData.monthlyInvoices,
          teamSize: validatedData.teamSize
        }
      });

      setSubmitted(true);
      toast.success("Message sent! We'll get back to you soon.");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error(error.message || "Failed to submit request");
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <MarketingLayout>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Thank You!</CardTitle>
              <CardDescription>
                We've received your message and will get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")} className="w-full">
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-muted-foreground mb-6">
              Have a question or want to learn more? We'd love to hear from you.
            </p>
            <Button 
              size="lg" 
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8"
            >
              Book a Call
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Or fill out the form below and we'll respond within 24 hours
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Send Us a Message</CardTitle>
              <CardDescription>
                Tell us how we can help. Form submissions are limited to 3 per hour.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <HoneypotField name="website" />
                
                <div className="space-y-2">
                  <Label htmlFor="intent">How can we help? *</Label>
                  <Select
                    value={formData.intent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, intent: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      maxLength={100}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                      maxLength={255}
                      placeholder="john@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    required
                    maxLength={200}
                    placeholder="Acme Inc."
                  />
                </div>

                {showBusinessFields && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="billingSystem">Billing System</Label>
                      <Select
                        value={formData.billingSystem}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, billingSystem: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your billing system" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="chargebee">Chargebee</SelectItem>
                          <SelectItem value="netsuite">NetSuite</SelectItem>
                          <SelectItem value="quickbooks">QuickBooks</SelectItem>
                          <SelectItem value="saasoptics">SaaSOptics</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="monthlyInvoices">Monthly Invoices</Label>
                        <Select
                          value={formData.monthlyInvoices}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, monthlyInvoices: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select volume" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-100">0-100</SelectItem>
                            <SelectItem value="100-500">100-500</SelectItem>
                            <SelectItem value="500-1000">500-1,000</SelectItem>
                            <SelectItem value="1000+">1,000+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamSize">Team Size</Label>
                        <Select
                          value={formData.teamSize}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, teamSize: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10</SelectItem>
                            <SelectItem value="11-50">11-50</SelectItem>
                            <SelectItem value="51-200">51-200</SelectItem>
                            <SelectItem value="201-500">201-500</SelectItem>
                            <SelectItem value="500+">500+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    required
                    maxLength={1000}
                    placeholder="Tell us more about your inquiry..."
                    rows={5}
                  />
                  <p className="text-sm text-muted-foreground">
                    {formData.message.length}/1000 characters
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ContactUs;
