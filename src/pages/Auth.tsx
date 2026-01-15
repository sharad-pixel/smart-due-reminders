import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import { logAuditEvent, logSecurityEvent } from "@/lib/auditLog";
import { getAuthRedirectUrl, isRedirectUriMismatchError, SUPABASE_CALLBACK_URL } from "@/lib/appConfig";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setOauthError(null);
    try {
      // Redirect to upgrade page - the RequireSubscription gate will handle redirecting
      // users with active subscriptions to dashboard
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl('/upgrade'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        if (isRedirectUriMismatchError(error)) {
          setOauthError(`redirect_uri_mismatch: The Google OAuth redirect URI is not configured correctly. Admin: Add "${SUPABASE_CALLBACK_URL}" to Authorized redirect URIs in Google Cloud Console.`);
          toast.error('OAuth configuration error. Please contact the administrator.');
        } else if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          toast.error('Google sign-in is not yet configured. Please use email sign-in.');
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        await logSecurityEvent({
          eventType: "login",
          email,
          success: false,
          failureReason: error.message
        });
        throw error;
      }
      if (data.user) {
        await logAuditEvent({
          action: "login",
          resourceType: "profile",
          resourceId: data.user.id,
          metadata: { email }
        });
      }
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-foreground">Recouply</span>
            <span className="text-primary">.ai</span>
          </h1>
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

            <form onSubmit={handleAuth} className="space-y-4">
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
                  <Link to="/reset-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
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
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;