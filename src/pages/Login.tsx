import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { logAuditEvent, logSecurityEvent } from "@/lib/auditLog";
import { getAuthRedirectUrl } from "@/lib/appConfig";
import { Eye, EyeOff } from "lucide-react";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import SEO from "@/components/SEO";
import MarketingLayout from "@/components/MarketingLayout";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getSafeReturnTo = () => {
    const from = (location.state as any)?.from;
    if (typeof from !== "string") return null;
    if (!from.startsWith("/")) return null;
    // Avoid loops / sending users back to auth screens.
    if (from === "/login" || from.startsWith("/login?") || from === "/signup" || from.startsWith("/signup?")) {
      return null;
    }
    return from;
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    // Clean up hash fragment from OAuth redirects
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Set up auth state listener for OAuth callbacks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const returnTo = getSafeReturnTo();

          // Determine if they are a paid customer/admin (trial users should still be able to reach /upgrade).
          const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status, is_admin')
            .eq('id', session.user.id)
            .single();

          const status = profile?.subscription_status;
          const isPaidOrAdmin = !!profile?.is_admin || status === 'active' || status === 'past_due';

          const target = returnTo === '/upgrade' && isPaidOrAdmin ? '/dashboard' : (returnTo ?? '/dashboard');
          navigate(target, { replace: true });
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const returnTo = getSafeReturnTo();

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status, is_admin')
          .eq('id', session.user.id)
          .single();

        const status = profile?.subscription_status;
        const isPaidOrAdmin = !!profile?.is_admin || status === 'active' || status === 'past_due';

        const target = returnTo === '/upgrade' && isPaidOrAdmin ? '/dashboard' : (returnTo ?? '/dashboard');
        navigate(target, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => 'unknown');

      const rateLimitCheck = await supabase.functions.invoke('track-login-attempt', {
        body: { email, success: false, ipAddress }
      });

      if (rateLimitCheck.data?.locked) {
        toast.error(rateLimitCheck.data.message);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        await supabase.functions.invoke('track-login-attempt', {
          body: { email, success: false, ipAddress }
        });

        await logSecurityEvent({
          eventType: "login",
          email,
          success: false,
          failureReason: error.message,
        });
        throw error;
      }
      
      await supabase.functions.invoke('track-login-attempt', {
        body: { email, success: true, ipAddress }
      });

      await supabase.functions.invoke('track-session', {
        headers: {
          Authorization: `Bearer ${data.session?.access_token}`
        }
      });

      if (data.user) {
        await logSecurityEvent({
          eventType: "login",
          userId: data.user.id,
          email,
          success: true,
        });
        
        await logAuditEvent({
          action: "login",
          resourceType: "profile",
          resourceId: data.user.id,
          metadata: { email }
        });
      }
      toast.success("Welcome back!");
      const returnTo = getSafeReturnTo();
      navigate(returnTo ?? "/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect back into the app; access control will send non-subscribed users to /upgrade.
          redirectTo: getAuthRedirectUrl('/dashboard'),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          toast.error('Google sign-in is not yet configured. Please use email sign-in.');
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Google sign in failed");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReset(true);

    try {
      // Use custom branded password reset email
      await supabase.functions.invoke('send-password-reset', {
        body: { 
          email: resetEmail,
          redirectTo: getAuthRedirectUrl('/auth/reset-password'),
        },
      });

      logSecurityEvent({
        eventType: "password_reset_request",
        email: resetEmail,
        success: true,
      }).catch(() => {});

      toast.success("If an account exists with this email, you'll receive a password reset link shortly.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      toast.success("If an account exists with this email, you'll receive a password reset link shortly.");
      setShowForgotPassword(false);
      setResetEmail("");
    } finally {
      setSendingReset(false);
    }
  };


  return (
    <MarketingLayout>
      <SEO
        title="Sign In"
        description="Sign in to your Recouply.ai account to manage your collection intelligence dashboard."
        noindex={true}
      />
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <RecouplyLogo size="xl" className="justify-center mb-2" />
          <p className="text-muted-foreground">Collection Intelligence Platform</p>
        </div>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to continue to your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google SSO */}
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
                or
              </span>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
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
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary font-medium hover:underline">
                  Sign up free
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link to="/legal/terms" className="text-primary hover:underline">Terms</Link>
            {" "}and{" "}
            <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>

        {/* Forgot Password Dialog */}
        <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
                Password reset requests are limited to 3 per hour for security.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={sendingReset}>
                  {sendingReset ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>
      </div>
    </MarketingLayout>
  );
};

export default Login;
