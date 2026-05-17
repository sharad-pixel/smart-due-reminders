import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { usePayOverage } from "@/hooks/usePayOverage";

/**
 * Compact Platform Credits status card used at the top of pages that
 * consume credits (e.g. Live Contracts / Smart Ingestion). Replaces
 * the legacy "AI Smart Ingestion balance" card. Reads from the unified
 * asc606_credit_wallets table.
 */
export default function IngestionBalanceCard() {
  const { accountId } = useAccountId();
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { payOverage, loading: payingOverage } = usePayOverage(accountId);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("asc606_credit_wallets")
        .select("balance_credits, pending_overage_credits")
        .eq("account_id", accountId)
        .maybeSingle();
      if (!cancelled) {
        setWallet(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  const balance = Number(wallet?.balance_credits ?? 0);
  const overage = Number(wallet?.pending_overage_credits ?? 0);
  const hasOverage = overage > 0;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg ${hasOverage ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>
                {hasOverage ? <AlertTriangle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Platform Credits
                </div>
                <div className="text-3xl font-semibold mt-0.5">
                  {loading ? "—" : `${balance.toFixed(0)} credits`}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Covers ASC 606 (10 cr/contract) and Smart Ingestion (1 cr/page).
                  {hasOverage && (
                    <span className="block text-amber-700 font-medium">
                      {overage.toFixed(0)} credits of overage pending — ${overage.toFixed(2)} due.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm">
                <Link to="/billing?tab=credits">Manage credits</Link>
              </Button>
              {hasOverage && (
                <Button
                  onClick={payOverage}
                  disabled={payingOverage}
                  size="lg"
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  {payingOverage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Pay ${overage.toFixed(2)} now
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
