import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAuditEvent, logSecurityEvent } from "@/lib/auditLog";
import { getAuthRedirectUrl } from "@/lib/appConfig";
import { Sparkles, Zap, Users, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import SEO from "@/components/SEO";

type LoginLocationState = {
  from?: string;
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LoginLocationState | null)?.from || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestingAccess, setRequestingAccess] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate(redirectTo, { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate(redirectTo, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo]);

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
      navigate(redirectTo, { replace: true });
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

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    setRequestingAccess(true);

    try {
      const { error } = await supabase
        .from('waitlist_signups')
        .insert([{ email: requestEmail, name: requestName.trim() }]);
      
      if (error) {
        if (error.code === '23505') {
          toast.error("This email is already on the waitlist!");
        } else {
          throw error;
        }
      } else {
        try {
          await supabase.functions.invoke('send-admin-alert', {
            body: { type: 'waitlist', email: requestEmail, name: requestName.trim() }
          });
        } catch (alertErr) {
          console.error('Failed to send admin alert:', alertErr);
        }
        
        toast.success("Thanks! We'll review your request and get back to you soon.", {
          description: "You've been added to the early access waitlist."
        });
        setShowRequestAccess(false);
        setRequestName("");
        setRequestEmail("");
      }
    } catch (error) {
      console.error('Error saving to waitlist:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRequestingAccess(false);
    }
  };

  return (
    <>
      <SEO
        title="Login | Recouply.ai"
        description="Sign in to your Recouply.ai account to manage your collection intelligence dashboard."
        noindex={true}
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* Early Access Banner */}
        <div className="text-center mb-6">
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-4 h-4 mr-2" />
            Early Access Program
          </Badge>
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

        {/* Early Access Info */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium">Don't have access yet?</span>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowRequestAccess(true)}
          >
            <Mail className="w-4 h-4 mr-2" />
            Request Early Access
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
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

        {/* Request Early Access Dialog */}
        <Dialog open={showRequestAccess} onOpenChange={setShowRequestAccess}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Early Access</DialogTitle>
              <DialogDescription>
                Enter your details and we'll review your request for early access to Recouply.ai.
                We respond to requests within 24-48 hours.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="request-name">Name</Label>
                <Input
                  id="request-name"
                  type="text"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  required
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-email">Email</Label>
                <Input
                  id="request-email"
                  type="email"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRequestAccess(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={requestingAccess}>
                  {requestingAccess ? "Submitting..." : "Request Access"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </>
  );
};

export default Login;
