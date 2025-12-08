import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Loader2, UserPlus, LogIn, Mail, Lock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MarketingLayout from "@/components/MarketingLayout";

interface InviteDetails {
  valid: boolean;
  email?: string;
  role?: string;
  account_owner_name?: string;
  expires_at?: string;
  error?: string;
}

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  
  // Signup form state
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    validateInvite();
    checkCurrentUser();
  }, [token]);

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser({ id: user.id, email: user.email || "" });
    }
  };

  const validateInvite = async () => {
    try {
      const { data, error } = await supabase.rpc("validate_invite_token", {
        p_token: token,
      });

      if (error) throw error;
      
      const inviteData = data as unknown as InviteDetails;
      setInviteDetails(inviteData);
      
      if (inviteData?.valid && inviteData?.email) {
        setSignupEmail(inviteData.email);
      }
    } catch (error) {
      console.error("Error validating invite:", error);
      setInviteDetails({ valid: false, error: "Failed to validate invite" });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!currentUser || !token) return;

    setIsAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-team-invite", {
        body: { token },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("You've joined the team successfully!");
        navigate("/dashboard");
      } else {
        toast.error(data.error || "Failed to accept invite");
      }
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      toast.error(error.message || "Failed to accept invite");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupPassword || signupPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSigningUp(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          data: {
            name: signupName,
            invite_token: token,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // After signup, accept the invite
        const { data: acceptData, error: acceptError } = await supabase.functions.invoke("accept-team-invite", {
          body: { token },
        });

        if (acceptError) throw acceptError;

        if (acceptData.success) {
          toast.success("Account created and team joined successfully!");
          navigate("/dashboard");
        } else {
          toast.success("Account created! Please check your email to verify, then return to accept the invite.");
        }
      }
    } catch (error: any) {
      console.error("Error signing up:", error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleLoginRedirect = () => {
    // Store token in sessionStorage for post-login acceptance
    if (token) {
      sessionStorage.setItem("pending_invite_token", token);
    }
    navigate("/login?redirect=/accept-invite&token=" + token);
  };

  if (loading) {
    return (
      <MarketingLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MarketingLayout>
    );
  }

  if (!token) {
    return (
      <MarketingLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Invalid Invite Link</CardTitle>
              <CardDescription>
                This invite link is missing required information.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate("/login")}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  if (!inviteDetails?.valid) {
    return (
      <MarketingLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Invite Expired or Invalid</CardTitle>
              <CardDescription>
                {inviteDetails?.error || "This invitation link is no longer valid. Please ask your team admin to send a new invite."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => navigate("/login")} className="w-full">
                Go to Login
              </Button>
              <Button variant="outline" onClick={() => navigate("/contact")} className="w-full">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  // User is logged in
  if (currentUser) {
    const emailMatches = currentUser.email.toLowerCase() === inviteDetails.email?.toLowerCase();

    if (!emailMatches) {
      return (
        <MarketingLayout>
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <CardTitle>Email Mismatch</CardTitle>
                <CardDescription>
                  This invite was sent to <strong>{inviteDetails.email}</strong>, but you're logged in as <strong>{currentUser.email}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Please log out and sign in with the invited email address to accept this invitation.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.reload();
                    }}
                    className="w-full"
                  >
                    Log Out & Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </MarketingLayout>
      );
    }

    // Email matches - show accept button
    return (
      <MarketingLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>You're Invited!</CardTitle>
              <CardDescription>
                {inviteDetails.account_owner_name 
                  ? `${inviteDetails.account_owner_name} has invited you to join their team on Recouply.ai`
                  : "You've been invited to join a team on Recouply.ai"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{inviteDetails.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium capitalize">{inviteDetails.role}</span>
                </div>
              </div>
              
              <Button 
                onClick={handleAcceptInvite}
                disabled={isAccepting}
                className="w-full"
                size="lg"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  // User is not logged in - show signup/login options
  if (!showSignupForm) {
    return (
      <MarketingLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>You're Invited!</CardTitle>
              <CardDescription>
                {inviteDetails.account_owner_name 
                  ? `${inviteDetails.account_owner_name} has invited you to join their team on Recouply.ai`
                  : "You've been invited to join a team on Recouply.ai"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invited Email</span>
                  <span className="font-medium">{inviteDetails.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium capitalize">{inviteDetails.role}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowSignupForm(true)}
                  className="w-full"
                  size="lg"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account & Accept
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleLoginRedirect}
                  className="w-full"
                  size="lg"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Already have an account? Log in
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  // Show signup form
  return (
    <MarketingLayout>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>
              Complete your registration to join the team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Smith"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10 bg-muted"
                    value={signupEmail}
                    readOnly
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This email was specified in the invitation and cannot be changed.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10"
                    placeholder="Create a strong password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>
              
              <Button
                type="submit"
                disabled={isSigningUp}
                className="w-full"
                size="lg"
              >
                {isSigningUp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Create Account & Join Team
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowSignupForm(false)}
              >
                Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default AcceptInvite;
