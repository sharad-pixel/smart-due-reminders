import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { DEMO_TEAM } from "@/lib/demoWorkspace";
import { useDemoWorkspace } from "@/contexts/DemoWorkspaceContext";
import { AlertTriangle, Beaker, Trash2, CreditCard, CheckCircle2, LogIn } from "lucide-react";

type DemoAction = "wipe_all";
const DEMO_ACTION_LABELS: Record<DemoAction, string> = {
  wipe_all: "Wipe Demo Tenant",
};

interface DemoState {
  workspace_exists: boolean;
  last_seeded_at: string | null;
  last_reset_at: string | null;
  last_insights_at: string | null;
  entity_counts: Record<string, number>;
}

interface TestStripe {
  is_connected: boolean;
  stripe_account_id: string | null;
  last_sync_at: string | null;
}

export default function AdminDemoWorkspace() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isDemoView, setDemoView } = useDemoWorkspace();
  const [state, setState] = useState<DemoState | null>(null);
  const [stripeTest, setStripeTest] = useState<TestStripe | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<DemoAction | null>(null);
  const [stripeKey, setStripeKey] = useState("");
  const [stripeSaving, setStripeSaving] = useState(false);

  const DEMO_EMAIL = "demo@recouply.ai";

  const load = async () => {
    // Always read the shared demo user's workspace, regardless of which admin is signed in.
    try {
      const { data, error } = await supabase.functions.invoke("demo-workspace-seed", {
        body: { action: "status", target_user_email: DEMO_EMAIL },
      });
      if (error) throw error;
      setState((data?.state as any) ?? { workspace_exists: false, entity_counts: {}, last_seeded_at: null, last_reset_at: null, last_insights_at: null });
      setStripeTest((data?.stripe_test as any) ?? null);
    } catch (e) {
      console.error("demo status load failed", e);
    }
  };

  useEffect(() => { load(); }, []);

  const invoke = async (action: DemoAction) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-workspace-seed", {
        body: { action, target_user_email: DEMO_EMAIL },
      });
      if (error) throw error;
      toast({ title: DEMO_ACTION_LABELS[action], description: data?.summary ? `Seeded ${JSON.stringify(data.summary)}` : "Done." });
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  const enterDemoAsUser = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-login-provision", { body: {} });
      if (error) throw error;
      const { email, password } = data as { email: string; password: string };
      await supabase.auth.signOut();
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) throw sErr;
      toast({ title: "Signed in as demo user", description: "You are now recording as demo@recouply.ai." });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Could not enter demo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveStripeTest = async () => {
    if (!stripeKey.startsWith("sk_test_")) {
      toast({ title: "Test key required", description: "Only sk_test_ keys are accepted for the demo workspace.", variant: "destructive" });
      return;
    }
    setStripeSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      // Store encrypted-at-rest via edge fn in a future pass; for now store as-is with clear marker.
      const { error } = await supabase.from("stripe_test_integrations").upsert({
        user_id: userData.user.id,
        is_connected: true,
        stripe_secret_key_encrypted: stripeKey,
        connected_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Stripe test mode connected" });
      setStripeKey("");
      await load();
    } catch (e: any) {
      toast({ title: "Could not save", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setStripeSaving(false);
    }
  };

  const actions: { key: DemoAction; icon: any; variant?: "default" | "destructive" | "outline" | "secondary" }[] = [
    { key: "wipe_all", icon: Trash2, variant: "destructive" },
  ];

  return (
    <AdminLayout title="Demo Workspace" description="Create, reset, and manage the reusable demo dataset for sales and product demos.">
      {/* Enter Demo Workspace CTA */}
      <Card className="mb-4 border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <LogIn className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Sign in as the shared demo user</div>
              <div className="text-muted-foreground">
                Signs you out and back in as <code>demo@recouply.ai</code> — a clean, dedicated tenant for testing and recording demos. Load whatever data you need through the app, then return to <code>/admin/demo</code> and sign in as an admin to wipe it.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" disabled={loading} onClick={async () => {
              setLoading(true);
              try {
                const { error } = await supabase.functions.invoke("demo-workspace-seed", {
                  body: { action: "enable_stripe_demo", target_user_email: DEMO_EMAIL },
                });
                if (error) throw error;
                toast({ title: "Stripe enabled for demo account", description: "demo@recouply.ai now shows a connected Stripe integration." });
                await load();
              } catch (e: any) {
                toast({ title: "Could not enable Stripe", description: e?.message ?? String(e), variant: "destructive" });
              } finally { setLoading(false); }
            }}>
              <CreditCard className="h-4 w-4 mr-2" /> Enable Stripe for Demo
            </Button>
            <Button onClick={enterDemoAsUser} disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" /> Enter Demo as demo@recouply.ai
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Beaker className="h-5 w-5 text-primary" /> Workspace Status</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Demo data is tagged <code>is_demo = true</code> and stays out of production dashboards.</p>
            </div>
            <div className="flex items-center gap-2">
              {state?.workspace_exists
                ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Active</Badge>
                : <Badge variant="outline">Not created</Badge>}
              <Button size="sm" variant={isDemoView ? "default" : "outline"} onClick={() => setDemoView(!isDemoView)}>
                {isDemoView ? "Viewing: Demo" : "View: Production"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["debtors", "contracts", "invoices", "tasks", "alerts"].map((k) => (
              <div key={k} className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground capitalize">{k}</div>
                <div className="text-2xl font-semibold">{state?.entity_counts?.[k] ?? 0}</div>
              </div>
            ))}
            <div className="col-span-2 md:col-span-5 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div>Seeded: {state?.last_seeded_at ? new Date(state.last_seeded_at).toLocaleString() : "—"}</div>
              <div>Reset: {state?.last_reset_at ? new Date(state.last_reset_at).toLocaleString() : "—"}</div>
              <div>Insights: {state?.last_insights_at ? new Date(state.last_insights_at).toLocaleString() : "—"}</div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Test Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Stripe Test Mode</CardTitle>
            <p className="text-sm text-muted-foreground">Demo workspace only. sk_test_ keys accepted.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stripeTest?.is_connected ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Connected {stripeTest.stripe_account_id ? `(${stripeTest.stripe_account_id})` : ""}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Not connected.</div>
            )}
            <Input placeholder="sk_test_..." value={stripeKey} onChange={(e) => setStripeKey(e.target.value)} />
            <Button size="sm" onClick={saveStripeTest} disabled={stripeSaving || !stripeKey}>
              {stripeTest?.is_connected ? "Reconnect Stripe Test Account" : "Connect Stripe Test Account"}
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <p className="text-sm text-muted-foreground">Every action asks for confirmation and only affects demo rows.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Button key={a.key} variant={a.variant ?? "default"} disabled={loading} onClick={() => setPendingAction(a.key)}>
                  <Icon className="h-4 w-4 mr-2" />
                  {DEMO_ACTION_LABELS[a.key]}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Demo Team */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Demo Team</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {DEMO_TEAM.map((m) => (
              <div key={m.email} className="text-sm">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.title} · {m.email}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <b>Wipe Demo Tenant</b> deletes <b>every</b> row owned by <code>demo@recouply.ai</code> across debtors, invoices, contracts, tasks, activity, alerts, AI artifacts, <b>and all Stripe integration data + keys</b> (both live and test). Fully clean slate — use <b>Enable Stripe for Demo</b> to re-connect the mock integration when you're ready.
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction && DEMO_ACTION_LABELS[pendingAction]}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "wipe_all" && "This permanently deletes every debtor, invoice, contract, task, activity, alert, AI artifact, and all Stripe integration data + keys owned by demo@recouply.ai. Safety-gated to the demo account only. Fully clean slate — re-enable Stripe manually afterward if needed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAction && invoke(pendingAction)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
