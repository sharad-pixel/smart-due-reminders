import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

const SupportLogin = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    if (!normalized.endsWith("@recouply.ai")) {
      toast.error("Only @recouply.ai email addresses may use support login.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("support-login-request", {
      body: { email: normalized },
    });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      toast.error((data as any)?.error || "Could not send code. Make sure your email has been granted support access.");
      return;
    }
    sessionStorage.setItem("recouply.support_login_email", normalized);
    const next = searchParams.get("next");
    if (next?.startsWith("/")) sessionStorage.setItem("recouply.support_login_next", next);
    toast.success("A 6-digit code has been sent to your email.");
    navigate("/support/verify");
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const next = searchParams.get("next");
      if (next?.startsWith("/")) sessionStorage.setItem("recouply.support_login_next", next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/support/callback`,
          queryParams: {
            hd: "recouply.ai",
            prompt: "select_account",
          },
        },
      });
      if (error) {
        toast.error(error.message?.includes("provider") ? "Google sign-in is not configured." : error.message);
        setGoogleLoading(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-lg bg-primary/10 p-3 w-fit mb-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Recouply Support Login</CardTitle>
          <CardDescription>For Recouply.ai admins and support team members only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? "Redirecting…" : "Continue with Google (@recouply.ai)"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or use a 6-digit code</span>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              placeholder="you@recouply.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportLogin;
