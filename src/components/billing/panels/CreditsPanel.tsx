import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ExternalLink, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { ComplianceDocsManager } from "@/components/clm/ComplianceDocsManager";
import { usePayOverage } from "@/hooks/usePayOverage";

const PACKS = [
  { credits: 25, popular: false },
  { credits: 100, popular: true },
  { credits: 250, popular: false },
];

/**
 * Platform Credits panel — used inside the unified Subscription & Billing page.
 * Extracted from the old standalone /billing/asc606-credits page.
 */
export default function CreditsPanel() {
  const { accountId } = useClmEntitlement();
  const [params] = useSearchParams();
  const [wallet, setWallet] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState<string>("");
  const { payOverage, loading: payingOverage } = usePayOverage(accountId);

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
    const sessionId = params.get("session_id");
    if (params.get("purchase") === "success") {
      if (sessionId) {
        (async () => {
          try {
            const { data, error } = await supabase.functions.invoke("verify-asc606-purchase", {
              body: { sessionId },
            });
            if (error) throw error;
            if (data?.status === "credits_applied") {
              toast.success(`Payment confirmed — ${data.credits} credits added.`);
            } else if (data?.status === "overage_settled") {
              toast.success(`Payment confirmed — ${data.credits} overage credits settled.`);
            } else if (data?.status === "already_applied") {
              toast.success("Payment already applied.");
            } else if (data?.status === "unpaid") {
              toast.info("Payment is still processing — refresh in a moment.");
            } else {
              toast.success("Payment received.");
            }
          } catch (e: any) {
            toast.error(`Could not verify payment: ${e?.message ?? "unknown error"}`);
          } finally {
            load();
          }
        })();
      } else {
        toast.success("Payment received — credits will appear in a few seconds.");
        setTimeout(load, 4000);
      }
    } else if (params.get("purchase") === "cancelled") {
      toast.info("Purchase cancelled");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const balance = Number(wallet?.balance_credits ?? 0);
  const overage = Number(wallet?.pending_overage_credits ?? 0);
  const customN = Math.floor(Number(custom) || 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Platform Credits
        </h2>
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

      {/* Outstanding overage — pay now */}
      {overage > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-amber-900">
                  Outstanding balance due: ${overage.toFixed(2)}
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  {overage.toFixed(0)} credits of post-paid usage billed at $1.00/credit. Settle now to avoid month-end invoicing.
                </div>
              </div>
            </div>
            <Button
              onClick={payOverage}
              disabled={payingOverage}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              {payingOverage ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4 mr-1" />Pay ${overage.toFixed(2)} now</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Discount & overage policy */}
      <div className="rounded-md border border-border bg-muted/30 p-3 flex gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div>
            <strong className="text-foreground">20% discount applies to pre-paid credits only.</strong> Only usage processed against a positive pre-purchased balance qualifies for the $0.80/credit rate. Any usage that exceeds your balance is billed post-paid at $1.00/credit.
          </div>
          <div>
            <strong className="text-foreground">Newly purchased credits cannot settle existing overages.</strong> They apply to future usage from the moment of purchase forward. To clear an outstanding overage balance, use <em>Pay now</em> above (or wait for the month-end invoice).
          </div>
        </div>
      </div>

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
              {ledger.map((row) => {
                const service = row.service || "asc606";
                const serviceLabel = service === "smart_ingestion" ? "Smart Ingestion"
                  : service === "asc606" ? "ASC 606"
                  : service.replace(/_/g, " ");
                return (
                  <div key={row.id} className="flex items-center justify-between text-sm border-b py-2 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] capitalize shrink-0">{row.kind.replace("_", " ")}</Badge>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{serviceLabel}</Badge>
                      <span className="text-muted-foreground text-xs shrink-0">{new Date(row.created_at).toLocaleString()}</span>
                      {row.note && <span className="text-xs text-muted-foreground truncate">{row.note}</span>}
                    </div>
                    <span className={`font-mono shrink-0 ${Number(row.delta) > 0 ? "text-green-600" : Number(row.delta) < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {Number(row.delta) > 0 ? "+" : ""}{Number(row.delta).toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
