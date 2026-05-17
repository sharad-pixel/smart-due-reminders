import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, ExternalLink, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import SEO from "@/components/seo/SEO";
import { ComplianceDocsManager } from "@/components/clm/ComplianceDocsManager";

const PACKS = [
  { credits: 25, popular: false },
  { credits: 100, popular: true },
  { credits: 250, popular: false },
];

export default function Asc606Credits() {
  const { accountId } = useClmEntitlement();
  const [params] = useSearchParams();
  const [wallet, setWallet] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState<string>("");

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    const [{ data: w }, { data: l }] = await Promise.all([
      supabase.from("asc606_credit_wallets").select("*").eq("account_id", accountId).maybeSingle(),
      supabase.from("asc606_credit_ledger").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(w);
    setLedger(l ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [accountId]);

  useEffect(() => {
    if (params.get("purchase") === "success") {
      toast.success("Payment received — credits will appear in a few seconds.");
      setTimeout(load, 4000);
    } else if (params.get("purchase") === "cancelled") {
      toast.info("Purchase cancelled");
    }
  }, [params]);

  const buy = async (credits: number) => {
    if (!accountId) { toast.error("No active account"); return; }
    setBusy(String(credits));
    try {
      const { data, error } = await supabase.functions.invoke("asc606-purchase-credits", {
        body: { credits, accountId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start checkout");
    } finally {
      setBusy(null);
    }
  };

  const payOverage = async () => {
    if (!accountId) { toast.error("No active account"); return; }
    setBusy("overage");
    try {
      const { data, error } = await supabase.functions.invoke("asc606-purchase-credits", {
        body: { mode: "overage", accountId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start checkout");
    } finally {
      setBusy(null);
    }
  };

  const balance = Number(wallet?.balance_credits ?? 0);
  const overage = Number(wallet?.pending_overage_credits ?? 0);
  const customN = Math.floor(Number(custom) || 0);

  return (
    <Layout>
      <SEO title="Platform Credits" description="Pre-purchase platform credits at 20% off — usable across ASC 606 assessments, AI Smart Ingestion, and other paid services." />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Platform Credits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            One wallet, used across paid services. Pre-purchase at <strong>$0.80 / credit</strong> (20% off the $1.00 post-paid rate).
          </p>
          <ul className="text-xs text-muted-foreground mt-2 list-disc pl-5 space-y-0.5">
            <li><strong>ASC 606 GAAP Revenue Risk Assessment</strong> — 10 credits per contract</li>
            <li><strong>AI Smart Ingestion</strong> — 1 credit per page processed</li>
            <li>Additional paid services as they launch</li>
          </ul>
        </div>

        {/* Wallet card */}
        <Card>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="Available balance" value={`${balance.toFixed(0)} credits`} sub={`= $${balance.toFixed(2)} of usage`} />
            <Stat label="Pending overage (this month)" value={`${overage.toFixed(0)} credits`} sub={`$${(overage * 1.0).toFixed(2)} will be billed`} />
            <Stat label="Lifetime purchased" value={`${Number(wallet?.lifetime_purchased ?? 0).toFixed(0)} credits`} />
          </CardContent>
        </Card>

        {/* Packs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PACKS.map((p) => {
            const total = p.credits * 0.8;
            return (
              <Card key={p.credits} className={p.popular ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.credits} credits</CardTitle>
                    {p.popular && <Badge>Popular</Badge>}
                  </div>
                  <CardDescription>${p.credits.toFixed(2)} of usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">${total.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mb-4">
                    $0.80 / credit · save ${(p.credits * 0.2).toFixed(2)} vs post-paid
                  </div>
                  <Button className="w-full" onClick={() => buy(p.credits)} disabled={busy === String(p.credits)}>
                    {busy === String(p.credits) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4 mr-1" />Buy</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Custom amount */}
        <Card>
          <CardHeader>
            <CardTitle>Custom amount</CardTitle>
            <CardDescription>Buy any quantity from 10 credits up. $0.80 per credit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Credits</label>
              <Input
                type="number"
                min={10}
                step={10}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. 75"
                className="[&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="text-sm text-muted-foreground sm:pb-2">
              {customN >= 10 ? <>Total <strong>${(customN * 0.8).toFixed(2)}</strong></> : "Min 10 credits"}
            </div>
            <Button onClick={() => buy(customN)} disabled={customN < 10 || busy === String(customN)}>
              {busy === String(customN) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
            </Button>
          </CardContent>
        </Card>

        {/* Compliance documents library */}
        {accountId && <ComplianceDocsManager accountId={accountId} defaultStandard="ASC 606" />}

        {/* Ledger */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : ledger.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No activity yet.</div>
            ) : (
              <div className="space-y-1">
                {ledger.map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-sm border-b py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{row.kind.replace("_", " ")}</Badge>
                      <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
                      {row.note && <span className="text-xs text-muted-foreground">{row.note}</span>}
                    </div>
                    <span className={`font-mono ${Number(row.delta) > 0 ? "text-green-600" : Number(row.delta) < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {Number(row.delta) > 0 ? "+" : ""}{Number(row.delta).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
