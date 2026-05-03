import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SupportCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Wait briefly for supabase to hydrate the session from the URL.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 500));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session) {
        setError("Could not establish session. Please try again.");
        return;
      }

      const email = (session.user.email ?? "").toLowerCase();
      if (!email.endsWith("@recouply.ai")) {
        await supabase.auth.signOut();
        setError("Only @recouply.ai accounts may use support login.");
        return;
      }

      const { data, error: fnErr } = await supabase.functions.invoke("support-oauth-check", {
        body: {},
      });
      if (cancelled) return;
      if (fnErr || !data?.allowed) {
        await supabase.auth.signOut();
        setError(
          data?.reason === "not_on_support_list"
            ? "Your @recouply.ai account is not on the support access list. Ask an admin to add you."
            : data?.reason === "domain_not_allowed"
            ? "Only @recouply.ai accounts may use support login."
            : "Access denied."
        );
        return;
      }

      const next = sessionStorage.getItem("recouply.support_login_next") || "/admin/support-access";
      sessionStorage.removeItem("recouply.support_login_next");
      toast.success("Signed in");
      navigate(next, { replace: true });
    };
    run();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-lg bg-primary/10 p-3 w-fit mb-2">
            {error ? <ShieldAlert className="h-6 w-6 text-destructive" /> : <LifeBuoy className="h-6 w-6 text-primary" />}
          </div>
          <CardTitle>{error ? "Access denied" : "Verifying access…"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          {error ? (
            <>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => navigate("/support/login", { replace: true })}>Back to support login</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Checking your support access…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportCallback;
