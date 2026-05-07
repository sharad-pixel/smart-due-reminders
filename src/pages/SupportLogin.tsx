import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, Heart, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import RecouplyLogo from "@/components/layout/RecouplyLogo";
import { PersonaAvatar } from "@/components/ai/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";

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

  const agents = Object.entries(personaConfig);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-6xl mx-auto pt-8 pb-12">
        {/* Header */}
        <div className="flex justify-center mb-8">
          <RecouplyLogo size="lg" />
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: Login card */}
          <Card className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto border-primary/20 shadow-xl">
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

          {/* Right: Value content */}
          <div className="space-y-6 max-w-md mx-auto lg:mx-0">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
                <Heart className="h-3.5 w-3.5" />
                We value your support
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Behind every customer is a team that cares
              </h2>
              <p className="text-muted-foreground">
                Our support team partners with the AI agents below to ensure every Recouply.ai customer
                gets fast, thoughtful help — so finance teams can focus on recovering revenue, not chasing tickets.
              </p>
            </div>

            {/* AI agents grid */}
            <div className="bg-card border border-border/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Your AI Agent Team</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {agents.map(([key, persona]) => (
                  <div key={key} className="flex flex-col items-center text-center gap-1.5">
                    <PersonaAvatar persona={key} size="md" />
                    <span className="text-xs font-medium">{persona.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
                Seven specialized agents working 24/7 alongside our human support team.
              </p>
            </div>

            {/* Trust signals */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Secure access</p>
                  <p className="text-xs text-muted-foreground">SSO-only, audit-logged, and scoped to verified Recouply.ai team members.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-accent/10 rounded-md">
                  <Heart className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Customer-first support</p>
                  <p className="text-xs text-muted-foreground">Every action you take here helps a finance team get paid faster. Thank you.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportLogin;
