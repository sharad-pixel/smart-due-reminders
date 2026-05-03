import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

const SupportLogin = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
          <CardDescription>
            Restricted to Recouply.ai admins and support team members. Google Workspace sign-in only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? "Redirecting…" : "Continue with Google (@recouply.ai)"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your Google account must use a <strong>@recouply.ai</strong> address and be on the support access list.
          </p>
          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportLogin;
