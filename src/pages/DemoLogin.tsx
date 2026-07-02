import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beaker, LogIn, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DemoLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    // If already signed in as demo, go straight to dashboard
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email?.toLowerCase() === "demo@recouply.ai") {
        // stay on page so they can choose to reset or enter
      }
    });
  }, []);

  const enterDemo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-login-provision", { body: {} });
      if (error) throw error;
      const { email, password } = data as { email: string; password: string };
      // Sign out any current session first so demo replaces it cleanly
      await supabase.auth.signOut();
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) throw sErr;
      toast({ title: "Welcome to the demo", description: "You're signed in as the shared demo user." });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Could not enter demo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetData = async () => {
    setResetting(true);
    try {
      // Must be signed in as demo to reset
      const { data: u } = await supabase.auth.getUser();
      if (u.user?.email?.toLowerCase() !== "demo@recouply.ai") {
        await enterDemo();
      }
      const { error } = await supabase.functions.invoke("demo-workspace-seed", { body: { action: "reset" } });
      if (error) throw error;
      toast({ title: "Demo data reset", description: "Fresh seed loaded." });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Beaker className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Recouply Demo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shared demo workspace with seeded contracts, invoices, and accounts. Safe for recording — reset anytime.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" size="lg" onClick={enterDemo} disabled={loading}>
            <LogIn className="h-4 w-4 mr-2" />
            {loading ? "Signing in…" : "Enter Demo"}
          </Button>
          <Button variant="outline" className="w-full" onClick={resetData} disabled={resetting || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${resetting ? "animate-spin" : ""}`} />
            {resetting ? "Resetting…" : "Reset Demo Data"}
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            All demo data is tagged <code className="text-[10px]">is_demo=true</code> and isolated from production accounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
