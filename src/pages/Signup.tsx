import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/auditLog";
import { getAuthRedirectUrl } from "@/lib/appConfig";
import { Check, X } from "lucide-react";
import { User } from "@supabase/supabase-js";
import recouplyLogoHeader from "@/assets/recouply-logo-header.png";

// NIST-compliant password requirements
const passwordRequirements = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .refine((p) => /[A-Z]/.test(p), "Password must contain an uppercase letter")
    .refine((p) => /[a-z]/.test(p), "Password must contain a lowercase letter")
    .refine((p) => /[0-9]/.test(p), "Password must contain a number")
    .refine((p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), "Password must contain a special character"),
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  icp: z.string().min(1, "Please select your industry")
});

// Stripe plan configuration with monthly and annual prices
const STRIPE_PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    monthlyPriceId: 'price_1SaNQ5FaeMMSBqcli04PsmKX',
    annualPriceId: 'price_1SaNWBFaeMMSBqcl6EK9frSv',
    productId: 'prod_TXSKnoJFoHzsKc',
    monthlyPrice: 99,
    annualPrice: 84,
    description: '100 invoices per month with AI-powered collections'
  },
  {
    id: 'growth',
    name: 'Growth Plan',
    monthlyPriceId: 'price_1SaNQKFaeMMSBqclWKbyVTSv',
    annualPriceId: 'price_1SaNWTFaeMMSBqclXYovl2Hj',
    productId: 'prod_TXSLdpR7XTZZQx',
    monthlyPrice: 199,
    annualPrice: 169,
    description: '300 invoices per month with AI-powered collections'
  },
  {
    id: 'professional',
    name: 'Professional Plan',
    monthlyPriceId: 'price_1SaNVyFaeMMSBqclrcAXjUmm',
    annualPriceId: 'price_1SaNXGFaeMMSBqcl08sXmTEm',
    productId: 'prod_TXSQ7XHGszt03J',
    monthlyPrice: 499,
    annualPrice: 424,
    description: '500 invoices per month with AI-powered collections and team features'
  }
];

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');
  const icpParam = searchParams.get('icp');
  const billingParam = searchParams.get('billing');
  
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(planParam || "starter");
  const [isAnnual, setIsAnnual] = useState(billingParam === 'annual');
  const [selectedIcp, setSelectedIcp] = useState(icpParam || "");
  const [loading, setLoading] = useState(false);

  // Calculate password strength
  const passedRequirements = passwordRequirements.filter(req => req.test(password));
  const passwordStrength = passedRequirements.length;
  const isPasswordValid = passwordStrength === passwordRequirements.length;

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl('/dashboard'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        
        if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          toast.error('Google sign-in is not yet configured. Please contact support or use email sign-in.', {
            duration: 5000,
          });
        } else {
          throw error;
        }
        return;
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error(error.message || "Google sign in failed. Please try again or use email sign-in.");
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
          emailRedirectTo: getAuthRedirectUrl('/dashboard'),
          data: {
            name: validatedData.name,
            business_name: validatedData.businessName
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
        
        // Handle specific error cases
        if (authError.message?.includes('already registered')) {
          toast.error("This email is already registered. Please sign in instead.");
          return;
        }
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

      // Send admin alert
      try {
        await supabase.functions.invoke('send-admin-alert', {
          body: { 
            type: 'signup', 
            email: validatedData.email,
            name: validatedData.name,
            company: validatedData.businessName
          }
        });
      } catch (alertErr) {
        console.error('Failed to send admin alert:', alertErr);
      }

      // Update profile with plan and business details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: validatedData.businessName,
          plan_type: selectedPlan as 'starter' | 'growth' | 'pro',
          trial_ends_at: trialEndsAt.toISOString()
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        // Don't throw - profile might not exist yet due to trigger timing
      }

      // Check if email confirmation is required
      if (authData.session) {
        // User is immediately signed in (email confirmation disabled)
        toast.success("Account created! Welcome to Recouply.ai");
        navigate("/dashboard");
      } else {
        // Email confirmation required
        toast.success("Account created! Please check your email to verify your account.");
      }
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

  // Don't render form if user is already logged in
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={recouplyLogoHeader} 
            alt="Recouply.ai" 
            className="h-12 w-auto mx-auto mb-2"
          />
          <p className="text-muted-foreground">AI-Powered Invoice Collection</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              Use your Google work account to get started with a 14-day free trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* SSO Buttons - Primary */}
            <div className="space-y-3 mb-6">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={handleGoogleSignIn}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
            </div>

            <div className="relative mb-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                Or continue with email
              </span>
            </div>

            {/* Email/Password Form - Secondary */}
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Billing Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Label htmlFor="billing-toggle" className={!isAnnual ? "font-semibold" : "text-muted-foreground"}>
                    Monthly
                  </Label>
                  <Switch
                    id="billing-toggle"
                    checked={isAnnual}
                    onCheckedChange={setIsAnnual}
                  />
                  <Label htmlFor="billing-toggle" className={isAnnual ? "font-semibold" : "text-muted-foreground"}>
                    Annual
                  </Label>
                </div>
                {isAnnual && (
                  <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2 py-1 rounded-full">
                    Save 15%
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Choose Your Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRIPE_PLANS.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ${isAnnual ? plan.annualPrice : plan.monthlyPrice}/mo
                        {isAnnual && <span className="text-muted-foreground ml-1">(billed annually)</span>}
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
                
                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded ${
                            level <= passwordStrength
                              ? passwordStrength <= 2
                                ? 'bg-destructive'
                                : passwordStrength <= 3
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {passwordStrength <= 2 && "Weak password"}
                      {passwordStrength === 3 && "Fair password"}
                      {passwordStrength === 4 && "Good password"}
                      {passwordStrength === 5 && "Strong password"}
                    </p>
                  </div>
                )}

                {/* Password Requirements Checklist */}
                <div className="grid grid-cols-1 gap-1 mt-2">
                  {passwordRequirements.map((req) => {
                    const passed = req.test(password);
                    return (
                      <div
                        key={req.id}
                        className={`flex items-center gap-2 text-xs ${
                          password ? (passed ? 'text-green-600' : 'text-muted-foreground') : 'text-muted-foreground'
                        }`}
                      >
                        {password ? (
                          passed ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )
                        ) : (
                          <div className="h-3 w-3" />
                        )}
                        {req.label}
                      </div>
                    );
                  })}
                </div>
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
                    <SelectItem value="small-businesses">Small Businesses</SelectItem>
                    <SelectItem value="agencies">Agencies / Professional Services</SelectItem>
                    <SelectItem value="local-smb">Local SMB</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !isPasswordValid}
              >
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
