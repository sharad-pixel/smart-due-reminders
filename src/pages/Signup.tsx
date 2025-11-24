import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/auditLog";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  icp: z.string().min(1, "Please select your industry")
});

// Stripe plan configuration
const STRIPE_PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    priceId: 'price_1SX2cyFaeMMSBqclAGkxSliI',
    productId: 'prod_TU0eI8uJBt4uFu',
    price: 99,
    description: '50 invoices per month with AI-powered collections'
  },
  {
    id: 'growth',
    name: 'Growth Plan',
    priceId: 'price_1SX2dkFaeMMSBqclPIjUA6N2',
    productId: 'prod_TU0f7AKZA4QVKe',
    price: 199,
    description: '200 invoices per month with AI-powered collections'
  },
  {
    id: 'professional',
    name: 'Professional Plan',
    priceId: 'price_1SX2duFaeMMSBqclrYq4rikr',
    productId: 'prod_TU0fTQf4l1UgT9',
    price: 399,
    description: '500 invoices per month with AI-powered collections and team features'
  }
];

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');
  const icpParam = searchParams.get('icp');
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(planParam || "starter");
  const [selectedIcp, setSelectedIcp] = useState(icpParam || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      navigate("/dashboard");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = signupSchema.parse({
        name,
        email,
        password,
        businessName,
        icp: selectedIcp
      });

      // Get selected plan details
      const plan = STRIPE_PLANS.find(p => p.id === selectedPlan);
      if (!plan) throw new Error("Please select a valid plan");

      // Calculate trial end date (14 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            name: validatedData.name
          },
        },
      });

      if (authError) {
        // Log failed signup attempt
        await logSecurityEvent({
          eventType: "signup",
          email: validatedData.email,
          success: false,
          failureReason: authError.message,
        });
        throw authError;
      }
      if (!authData.user) throw new Error("Failed to create account");

      // Log successful signup
      await logSecurityEvent({
        eventType: "signup",
        userId: authData.user.id,
        email: validatedData.email,
        success: true,
        metadata: { plan: selectedPlan, icp: selectedIcp }
      });

      // Update profile with plan and business details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: validatedData.businessName,
          plan_type: selectedPlan as 'starter' | 'growth' | 'pro',
          trial_ends_at: trialEndsAt.toISOString()
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      toast.success("Account created! Redirecting to checkout...");
      
      // Redirect to checkout
      setTimeout(() => {
        navigate("/checkout");
      }, 1000);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error(error.message || "Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Recouply.ai</h1>
          <p className="text-muted-foreground">AI-Powered Invoice Collection</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Start your 14-day free trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Choose Your Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRIPE_PLANS.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.price}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="you@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={100}
                  placeholder="••••••••"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Acme Inc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icp">Industry *</Label>
                <Select value={selectedIcp} onValueChange={setSelectedIcp}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home-services">Home Services</SelectItem>
                    <SelectItem value="agencies">Agencies / Professional Services</SelectItem>
                    <SelectItem value="local-smb">Local SMB</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Start Free Trial"}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                By signing up, you agree to our{" "}
                <Link to="/legal/terms" className="text-primary hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/legal/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
