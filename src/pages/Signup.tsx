import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/auditLog";
import { getAuthRedirectUrl, isRedirectUriMismatchError, SUPABASE_CALLBACK_URL } from "@/lib/appConfig";
import { Check, X, Zap, Users, FileText, Bot, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import { User } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import SEO from "@/components/SEO";

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
});

const Signup = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [inviteProcessing, setInviteProcessing] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Calculate password strength
  const passedRequirements = passwordRequirements.filter(req => req.test(password));
  const passwordStrength = passedRequirements.length;

  useEffect(() => {
    // Check for invite token in URL hash
    const handleInviteToken = async () => {
      const hash = window.location.hash;
      
      // Check if this is an invite flow (type=invite or type=recovery in hash)
      if (hash && (hash.includes('type=invite') || hash.includes('type=signup') || hash.includes('access_token'))) {
        setIsInviteFlow(true);
        
        // Let Supabase handle the token exchange
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error processing invite:', error);
          toast.error('Failed to process invite link. Please try again or contact support.');
          setInviteProcessing(false);
          return;
        }
        
        if (data.session?.user) {
          // User is authenticated via invite, pre-fill email
          setEmail(data.session.user.email || '');
          setUser(data.session.user);
          
          // Check if profile needs to be completed
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, business_name')
            .eq('id', data.session.user.id)
            .maybeSingle();
          
          if (profile?.name && profile?.business_name) {
            // Profile is complete, redirect to dashboard
            toast.success('Welcome back!');
            navigate('/dashboard');
            return;
          }
          
          // Profile needs completion, show form
          if (profile?.name) setName(profile.name);
          toast.info('Please complete your profile to continue.');
        }
      }
      
      setInviteProcessing(false);
    };

    handleInviteToken();
  }, [navigate]);

  useEffect(() => {
    if (inviteProcessing) return;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        
        // Don't auto-redirect during invite flow - user needs to complete profile
        if (session?.user && !isInviteFlow) {
          navigate("/dashboard");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isInviteFlow) {
        setUser(session?.user ?? null);
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isInviteFlow, inviteProcessing]);


  const handleGoogleSignIn = async () => {
    setOauthError(null);
    try {
      // Redirect back into the app; access control will send non-subscribed users to /upgrade.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl('/dashboard'),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        if (isRedirectUriMismatchError(error)) {
          setOauthError(`redirect_uri_mismatch: The Google OAuth redirect URI is not configured correctly. Admin: Add "${SUPABASE_CALLBACK_URL}" to Authorized redirect URIs in Google Cloud Console.`);
          toast.error('OAuth configuration error. Please contact the administrator.');
        } else if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          toast.error('Google sign-in is not yet configured. Please use email sign-up.');
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      if (isRedirectUriMismatchError(error)) {
        setOauthError(`redirect_uri_mismatch: The Google OAuth redirect URI is not configured correctly. Admin: Add "${SUPABASE_CALLBACK_URL}" to Authorized redirect URIs in Google Cloud Console.`);
        toast.error('OAuth configuration error. Please contact the administrator.');
      } else {
        toast.error(error.message || "Google sign in failed");
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For invite flow, password may not be required if already authenticated
      const validationSchema = isInviteFlow && user
        ? z.object({
            name: z.string().trim().min(1, "Name is required").max(100),
            email: z.string().trim().email("Invalid email address").max(255),
            businessName: z.string().trim().min(1, "Business name is required").max(200),
          })
        : signupSchema;

      const dataToValidate = isInviteFlow && user
        ? { name, email, businessName }
        : { name, email, password, businessName };

      const validatedData = validationSchema.parse(dataToValidate);

      // If invite flow with authenticated user, just update profile
      if (isInviteFlow && user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: validatedData.name,
            business_name: validatedData.businessName,
            plan_type: 'free'
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          throw new Error('Failed to update profile');
        }


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

        // Send welcome email and create in-app alert
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: { 
              email: validatedData.email,
              userName: validatedData.name,
              companyName: validatedData.businessName,
              userId: user.id
            }
          });
        } catch (welcomeErr) {
          console.error('Failed to send welcome email:', welcomeErr);
        }

        toast.success("Welcome to Recouply.ai! You're on your way to Collection Excellence.");
        navigate("/dashboard");
        return;
      }

      // Standard signup flow - Create account first, then redirect to Stripe checkout

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: (validatedData as any).password,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/dashboard'),
          data: {
            name: validatedData.name,
            business_name: validatedData.businessName
          },
        },
      });

      if (authError) {
        await logSecurityEvent({
          eventType: "signup",
          email: validatedData.email,
          success: false,
          failureReason: authError.message,
        });
        
        if (authError.message?.includes('already registered')) {
          toast.error("This email is already registered. Please sign in instead.");
          return;
        }
        throw authError;
      }
      if (!authData.user) throw new Error("Failed to create account");


      await logSecurityEvent({
        eventType: "signup",
        userId: authData.user.id,
        email: validatedData.email,
        success: true,
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

      // Send welcome email and create in-app alert
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: { 
            email: validatedData.email,
            userName: validatedData.name,
            companyName: validatedData.businessName,
            userId: authData.user.id
          }
        });
      } catch (welcomeErr) {
        console.error('Failed to send welcome email:', welcomeErr);
      }

      // Update profile with business name and FREE trial (not starter)
      // Users get 7 days free with 5 invoice credits, then must select a plan
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          business_name: validatedData.businessName,
          plan_type: 'free', // Start on free plan
          subscription_status: 'trialing', // Trialing status for 7-day trial
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      // New flow: Don't require payment upfront - give 7-day trial with 5 invoices
      // Users will be prompted to upgrade when trial expires or limits reached
      if (authData.session) {
        toast.success("Welcome! You have 7 days and 5 invoices to explore Recouply.ai free.");
        navigate("/dashboard");
      } else {
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

  // Don't redirect invited users - they need to complete profile
  if (user && !isInviteFlow) {
    return null;
  }

  // Show loading state while processing invite
  if (inviteProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing your invite...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Sign Up"
        description="Create your Recouply.ai account and start automating invoice collection with AI-powered intelligence."
        noindex={true}
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <RecouplyLogo size="xl" className="justify-center mb-2" />
          <p className="text-muted-foreground">Collection Intelligence Platform</p>
        </div>

        {/* Free Trial Benefits Card */}
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">7-Day Free Trial on Starter</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-background rounded-lg">
                <FileText className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">5</p>
                <p className="text-xs text-muted-foreground">Invoices</p>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <Bot className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">6</p>
                <p className="text-xs text-muted-foreground">AI Agents</p>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">7</p>
                <p className="text-xs text-muted-foreground">Days Free</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              No credit card required. Select a plan when you're ready.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {isInviteFlow && user ? "Complete Your Profile" : "Create Your Account"}
            </CardTitle>
            <CardDescription>
              {isInviteFlow && user 
                ? "Just a few more details to get started" 
                : "Get started with AI-powered collections"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OAuth Error Alert - Admin Only */}
            {oauthError && (
              <Alert variant="destructive" className="text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>OAuth Configuration Error</AlertTitle>
                <AlertDescription className="text-xs mt-2">
                  <p className="mb-2">{oauthError}</p>
                  <p className="font-medium">Required Redirect URI:</p>
                  <code className="block mt-1 p-2 bg-destructive/10 rounded text-xs break-all">
                    {SUPABASE_CALLBACK_URL}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            {/* Google SSO - Only show for non-invite flow */}
            {!(isInviteFlow && user) && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    or sign up with email
                  </span>
                </div>
              </>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
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
                  <Label htmlFor="businessName">Company</Label>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{isInviteFlow && user ? "Email" : "Invited Email"}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="you@company.com"
                  disabled={isInviteFlow && !!user}
                />
              </div>

              {/* Only show password for non-invite or unauthenticated users */}
              {!(isInviteFlow && user) && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={100}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                    </Button>
                  </div>
                
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
                    </div>
                  )}

                  {/* Password Requirements */}
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {passwordRequirements.map((req) => {
                      const passed = req.test(password);
                      return (
                        <div
                          key={req.id}
                          className={`flex items-center gap-1.5 text-xs ${
                            password ? (passed ? 'text-green-600' : 'text-muted-foreground') : 'text-muted-foreground'
                          }`}
                        >
                          {password ? (
                            passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                          {req.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (isInviteFlow && user ? "Completing profile..." : "Creating account...") : (isInviteFlow && user ? "Complete Profile" : "Create Account")}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By signing up, you agree to our{" "}
                <Link to="/legal/terms" className="text-primary hover:underline">Terms</Link>
                {" "}and{" "}
                <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </p>
            </form>

            {!(isInviteFlow && user) && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Need help? Contact us at{" "}
            <a href="mailto:support@recouply.ai" className="text-primary hover:underline">
              support@recouply.ai
            </a>
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default Signup;