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
import { DEMO_CUSTOMERS, DEMO_TEAM, DEMO_ACTION_LABELS, type DemoAction } from "@/lib/demoWorkspace";
import { useDemoWorkspace } from "@/contexts/DemoWorkspaceContext";
import { AlertTriangle, Beaker, PlayCircle, RefreshCw, Trash2, Sparkles, FileText, ListChecks, CreditCard, CheckCircle2, LogIn } from "lucide-react";

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

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: st } = await supabase.from("demo_workspace_state").select("*").eq("user_id", userData.user.id).maybeSingle();
    setState(st as any);
    const { data: sti } = await supabase.from("stripe_test_integrations").select("is_connected, stripe_account_id, last_sync_at").eq("user_id", userData.user.id).maybeSingle();
    setStripeTest(sti as any);
  };

  useEffect(() => { load(); }, []);

  const invoke = async (action: DemoAction) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("demo-workspace-seed", { body: { action } });
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
    { key: "seed", icon: Sparkles },
    { key: "generate_invoices", icon: FileText, variant: "outline" },
    { key: "generate_activity", icon: ListChecks, variant: "outline" },
    { key: "recompute_insights", icon: RefreshCw, variant: "outline" },
    { key: "reset", icon: PlayCircle, variant: "secondary" },
    { key: "clear", icon: Trash2, variant: "destructive" },
  ];

  return (
    <AdminLayout title="Demo Workspace" description="Create, reset, and manage the reusable demo dataset for sales and product demos.">
      {/* Enter Demo Workspace CTA */}
      <Card className="mb-4 border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <LogIn className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Enter the demo workspace</div>
              <div className="text-muted-foreground">
                You stay signed in as yourself. Enabling Demo Mode filters every page (Dashboard, Contracts, Invoices, Collections) to only show <code>is_demo = true</code> rows so you can walk through NimbusHR & friends without touching real data.
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={() => { setDemoView(true); navigate("/dashboard"); }}
              disabled={!state?.workspace_exists}
            >
              <LogIn className="h-4 w-4 mr-2" /> Enter Demo Dashboard
            </Button>
            {isDemoView && (
              <Button variant="outline" onClick={() => setDemoView(false)}>Exit Demo Mode</Button>
            )}
          </div>
        </CardContent>
        {!state?.workspace_exists && (
          <div className="px-4 pb-3 text-xs text-amber-600">Load the demo dataset below first, then click Enter Demo Dashboard.</div>
        )}
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

        {/* Seed preview */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Demo Customers</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2">Company</th><th>Industry</th><th>ARR</th><th>Invoice</th><th>CI</th><th>BR</th><th>CR</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_CUSTOMERS.map((c) => (
                  <tr key={c.slug} className="border-b last:border-0">
                    <td className="py-2 font-medium">{c.company_name}{c.complete && <Badge className="ml-2" variant="outline">Full</Badge>}</td>
                    <td>{c.industry}</td>
                    <td>${c.arr.toLocaleString()}</td>
                    <td>${c.invoice_amount.toLocaleString()}</td>
                    <td>{c.contract_intelligence_score}</td>
                    <td>{c.billing_readiness_score}</td>
                    <td>{c.collection_readiness_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
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
              This workspace contains fictional demo data for testing and product demonstrations. Reset only ever deletes rows where <code>is_demo = true</code> — production data is untouched.
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction && DEMO_ACTION_LABELS[pendingAction]}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "clear" && "This will delete every row tagged is_demo = true for your account. Production data is not affected."}
              {pendingAction === "reset" && "This will clear the current demo workspace and re-seed the full dataset."}
              {pendingAction === "seed" && "Seeds the 5 demo customers, NimbusHR full contract & invoice, tasks, alerts, and AI assessments."}
              {pendingAction === "generate_invoices" && "Creates one additional open invoice per demo customer."}
              {pendingAction === "generate_activity" && "Logs a sample outreach activity per demo customer."}
              {pendingAction === "recompute_insights" && "Marks readiness scores as freshly recomputed."}
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
