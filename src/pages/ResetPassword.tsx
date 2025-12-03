import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { logSecurityEvent } from "@/lib/auditLog";

// Password requirements based on industry best practices (NIST guidelines)
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);

  useEffect(() => {
    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error("Invalid or expired reset link. Please request a new one.");
        navigate("/login");
      }
    });
  }, [navigate]);

  // Check individual password requirements
  const requirements = useMemo(() => ({
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    maxLength: password.length <= PASSWORD_REQUIREMENTS.maxLength,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  // Calculate password strength
  const passwordStrength = useMemo((): PasswordStrength => {
    const metRequirements = Object.values(requirements).filter(Boolean).length;
    const totalRequirements = Object.keys(requirements).length;
    const score = Math.round((metRequirements / totalRequirements) * 100);

    if (score < 40) return { score, label: "Weak", color: "bg-destructive" };
    if (score < 70) return { score, label: "Fair", color: "bg-yellow-500" };
    if (score < 100) return { score, label: "Good", color: "bg-blue-500" };
    return { score, label: "Strong", color: "bg-green-500" };
  }, [requirements]);

  const allRequirementsMet = Object.values(requirements).every(Boolean);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!allRequirementsMet) {
      toast.error("Please meet all password requirements");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Log successful password reset
      if (user) {
        await logSecurityEvent({
          eventType: "password_reset_complete",
          userId: user.id,
          email: user.email,
          success: true,
        });
      }

      toast.success("Password updated successfully! Please sign in with your new password.");
      
      // Sign out to force re-authentication with new password
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error: any) {
      // Log failed attempt
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logSecurityEvent({
          eventType: "password_reset_complete",
          userId: user.id,
          email: user.email,
          success: false,
          failureReason: error.message,
        });
      }
      toast.error(error.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const RequirementItem = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? "text-green-600" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Recouply.ai</h1>
          <p className="text-muted-foreground">AI-Powered Invoice Collection</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Create a strong, unique password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setShowRequirements(true)}
                  required
                  placeholder="••••••••"
                  maxLength={PASSWORD_REQUIREMENTS.maxLength}
                  autoComplete="new-password"
                />
                
                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Password strength:</span>
                      <span className={`font-medium ${
                        passwordStrength.label === "Weak" ? "text-destructive" :
                        passwordStrength.label === "Fair" ? "text-yellow-600" :
                        passwordStrength.label === "Good" ? "text-blue-600" :
                        "text-green-600"
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <Progress 
                      value={passwordStrength.score} 
                      className="h-2"
                    />
                  </div>
                )}

                {/* Password Requirements */}
                {showRequirements && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-1">
                    <p className="text-sm font-medium mb-2">Password must have:</p>
                    <RequirementItem met={requirements.minLength} label="At least 8 characters" />
                    <RequirementItem met={requirements.hasUppercase} label="At least one uppercase letter" />
                    <RequirementItem met={requirements.hasLowercase} label="At least one lowercase letter" />
                    <RequirementItem met={requirements.hasNumber} label="At least one number" />
                    <RequirementItem met={requirements.hasSpecial} label="At least one special character (!@#$%...)" />
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  maxLength={PASSWORD_REQUIREMENTS.maxLength}
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-sm text-destructive">Passwords do not match</p>
                )}
                {confirmPassword.length > 0 && password === confirmPassword && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="h-4 w-4" /> Passwords match
                  </p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !allRequirementsMet || password !== confirmPassword}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
