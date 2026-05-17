import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Scale, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { usePayOverage } from "@/hooks/usePayOverage";

interface LedgerRow {
  id: string;
  created_at: string;
  delta: number;
  kind: string;
  service: string | null;
  unit_price_cents: number | null;
  note: string | null;
}

const serviceLabel = (s: string | null) =>
  s === "smart_ingestion" ? "Smart Ingestion"
  : s === "asc606" ? "ASC 606"
  : (s || "platform").replace(/_/g, " ");

const kindLabel = (k: string) =>
  k === "consume" ? "Pre-paid credits"
  : k === "overage_accrue" ? "Standard credits (overage)"
  : k === "purchase" ? "Credit purchase"
  : k === "overage_invoice" ? "Overage invoiced"
  : k === "refund" ? "Refund"
  : k.replace(/_/g, " ");

export default function UsageReconciliationCard() {
  const { accountId } = useClmEntitlement();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const { payOverage, loading: paying } = usePayOverage(accountId);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const [{ data: w }, { data: l }] = await Promise.all([
        supabase.from("asc606_credit_wallets").select("*").eq("account_id", accountId).maybeSingle(),
        supabase.from("asc606_credit_ledger").select("id, created_at, delta, kind, service, unit_price_cents, note")
          .eq("account_id", accountId).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      ]);
      setWallet(w);
      setRows((l as LedgerRow[]) || []);
      setLoading(false);
    })();
  }, [accountId]);

  const balance = Number(wallet?.balance_credits ?? 0);
  const overage = Number(wallet?.pending_overage_credits ?? 0);

  // Reconcile from the ledger: prepaid (consume) vs overage (overage_accrue), grouped by service.
  const breakdown = new Map<string, { prepaidCredits: number; prepaidDollars: number; overageCredits: number; overageDollars: number }>();
  for (const r of rows) {
    const key = r.service || "platform";
    const cur = breakdown.get(key) || { prepaidCredits: 0, prepaidDollars: 0, overageCredits: 0, overageDollars: 0 };
    const credits = Math.abs(Number(r.delta) || 0);
    const price = (r.unit_price_cents || 0) / 100;
    if (r.kind === "consume") {
      cur.prepaidCredits += credits;
      cur.prepaidDollars += credits * price;
    } else if (r.kind === "overage_accrue") {
      cur.overageCredits += credits;
      cur.overageDollars += credits * price;
    }
    breakdown.set(key, cur);
  }

  const totalPrepaid = Array.from(breakdown.values()).reduce((s, b) => s + b.prepaidDollars, 0);
  const totalOverage = Array.from(breakdown.values()).reduce((s, b) => s + b.overageDollars, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" />
          Credit Usage & Balance Reconciliation
        </CardTitle>
        <CardDescription>
          Every paid action draws from your Platform Credits wallet. Pre-paid credits cost <strong>$0.80</strong>; if your balance hits zero, additional usage accrues as <strong>standard credits (overage) at $1.00/credit</strong> and forms your balance due.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Reconciled totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile label="Wallet balance" value={`${balance.toFixed(0)} credits`} sub={`= $${balance.toFixed(2)} of usage`} />
          <Tile
            label="Pre-paid usage (30d)"
            value={`$${totalPrepaid.toFixed(2)}`}
            sub="Already covered by wallet"
            tone="emerald"
          />
          <Tile
            label="Standard credits owed"
            value={`$${(overage).toFixed(2)}`}
            sub={`${overage.toFixed(0)} credits @ $1.00 — balance due`}
            tone={overage > 0 ? "amber" : "default"}
          />
        </div>

        {overage > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 flex items-center justify-between gap-3">
            <div className="flex gap-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              <span>
                <strong>${overage.toFixed(2)}</strong> balance due — reconciled below to every credit consumed at the overage rate.
              </span>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={payOverage} disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4 mr-1" />Pay now</>}
            </Button>
          </div>
        )}

        {/* Per-service allocation */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Allocation by service (last 30 days)</div>
          {loading ? (
            <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : breakdown.size === 0 ? (
            <p className="text-xs text-muted-foreground">No usage in the last 30 days.</p>
          ) : (
            <div className="border rounded-md divide-y text-sm">
              <div className="px-3 py-2 grid grid-cols-5 gap-2 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                <div>Service</div>
                <div className="text-right">Pre-paid credits</div>
                <div className="text-right">Pre-paid $</div>
                <div className="text-right">Overage credits</div>
                <div className="text-right">Overage $ (due)</div>
              </div>
              {Array.from(breakdown.entries()).map(([svc, b]) => (
                <div key={svc} className="px-3 py-2 grid grid-cols-5 gap-2">
                  <div className="font-medium">{serviceLabel(svc)}</div>
                  <div className="text-right font-mono">{b.prepaidCredits.toFixed(0)}</div>
                  <div className="text-right font-mono text-emerald-700">${b.prepaidDollars.toFixed(2)}</div>
                  <div className="text-right font-mono">{b.overageCredits.toFixed(0)}</div>
                  <div className="text-right font-mono text-amber-700">${b.overageDollars.toFixed(2)}</div>
                </div>
              ))}
              <div className="px-3 py-2 grid grid-cols-5 gap-2 bg-muted/30 font-semibold">
                <div>Total</div>
                <div></div>
                <div className="text-right font-mono text-emerald-700">${totalPrepaid.toFixed(2)}</div>
                <div></div>
                <div className="text-right font-mono text-amber-700">${totalOverage.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Itemized ledger */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Itemized fee log — reconciled to credits consumed
          </div>
          {loading ? null : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No ledger entries yet.</p>
          ) : (
            <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
              {rows.map((r) => {
                const credits = Math.abs(Number(r.delta) || 0);
                const price = (r.unit_price_cents || 0) / 100;
                const dollars = credits * price;
                const isCharge = r.kind === "consume" || r.kind === "overage_accrue";
                const tone = r.kind === "overage_accrue" ? "bg-amber-100 text-amber-800 border-amber-300"
                  : r.kind === "consume" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-muted text-muted-foreground";
                return (
                  <div key={r.id} className="px-3 py-2 text-xs grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                    <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${tone}`}>{kindLabel(r.kind)}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{serviceLabel(r.service)}</Badge>
                    </div>
                    <div className="col-span-4 truncate text-muted-foreground">{r.note || "—"}</div>
                    <div className="col-span-1 text-right font-mono">{Number(r.delta) > 0 ? "+" : ""}{Number(r.delta).toFixed(0)}</div>
                    <div className="col-span-1 text-right font-mono text-muted-foreground">${price.toFixed(2)}</div>
                    <div className={`col-span-1 text-right font-mono ${isCharge ? (r.kind === "overage_accrue" ? "text-amber-700" : "text-emerald-700") : ""}`}>
                      {isCharge ? `$${dollars.toFixed(2)}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            Every fee on this log equals <em>credits consumed × unit price</em>. Pre-paid rows debit your wallet; overage rows add to your balance due and are settled via <strong>Pay now</strong> or the month-end invoice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "amber" | "emerald" }) {
  const toneCls = tone === "amber" ? "border-amber-300 bg-amber-50/60"
    : tone === "emerald" ? "border-emerald-300 bg-emerald-50/60"
    : "bg-muted/30";
  return (
    <div className={`border rounded-md p-3 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
