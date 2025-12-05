import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import recouplyLogoHeader from "@/assets/recouply-logo-header.png";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get IP address (best effort)
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => 'unknown');

      // Check rate limit before attempting login
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
        // Record failed attempt
        await supabase.functions.invoke('track-login-attempt', {
          body: { email, success: false, ipAddress }
        });

        // Log failed login attempt
        await logSecurityEvent({
          eventType: "login",
          email,
          success: false,
          failureReason: error.message,
        });
        throw error;
      }
      
      // Record successful login attempt
      await supabase.functions.invoke('track-login-attempt', {
        body: { email, success: true, ipAddress }
      });

      // Track session
      await supabase.functions.invoke('track-session', {
        headers: {
          Authorization: `Bearer ${data.session?.access_token}`
        }
      });

      // Log successful login
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
      navigate("/dashboard");
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


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReset(true);

    try {
      // Always show same message regardless of whether email exists (security best practice)
      await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: getAuthRedirectUrl('/auth/reset-password'),
      });

      // Log the password reset request (don't await to not block UI)
      logSecurityEvent({
        eventType: "password_reset_request",
        email: resetEmail,
        success: true,
      }).catch(() => {});

      // Generic success message - don't reveal if email exists
      toast.success("If an account exists with this email, you'll receive a password reset link shortly.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      // Still show generic message even on error (don't reveal system state)
      toast.success("If an account exists with this email, you'll receive a password reset link shortly.");
      setShowForgotPassword(false);
      setResetEmail("");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={recouplyLogoHeader} 
            alt="Recouply.ai" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <p className="text-muted-foreground">AI-Powered Invoice Collection</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to Recouply.ai</CardTitle>
            <CardDescription>
              Use your Google work account to get started
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
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/signup" className="text-sm text-primary hover:underline">
                Don't have an account? Sign up
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Forgot Password Dialog */}
        <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
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
  );
};

export default Login;
