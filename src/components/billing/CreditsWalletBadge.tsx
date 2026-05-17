import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export function CreditsWalletBadge() {
  const { accountId } = useClmEntitlement();
  const [balance, setBalance] = useState<number | null>(null);
  const [overage, setOverage] = useState<number>(0);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("asc606_credit_wallets")
        .select("balance_credits, pending_overage_credits")
        .eq("account_id", accountId)
        .maybeSingle();
      if (cancelled) return;
      setBalance(Number(data?.balance_credits ?? 0));
      setOverage(Number(data?.pending_overage_credits ?? 0));
    };

    load();

    const channel = supabase
      .channel(`wallet-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asc606_credit_wallets", filter: `account_id=eq.${accountId}` },
        load
      )
      .subscribe();

    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [accountId]);

  if (balance === null) return null;

  const low = balance < 10;
  const hasDue = overage > 0;
  // Net balance: credits available minus pending overage owed (in credits).
  const netCredits = balance - overage;

  return (
    <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/billing/asc606-credits"
          className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-xs font-medium transition-colors hover:bg-accent ${
            hasDue
              ? "border-amber-400/60 text-amber-700 bg-amber-50"
              : low
              ? "border-destructive/40 text-destructive"
              : "border-border text-foreground"
          }`}
          aria-label="Platform credits and balance due"
        >
          <Sparkles className={`h-3.5 w-3.5 ${hasDue ? "text-amber-600" : low ? "text-destructive" : "text-primary"}`} />
          <span className="tabular-nums">{balance.toFixed(0)}</span>
          <span className="text-muted-foreground hidden md:inline">credits</span>
          {hasDue && (
            <span className="ml-1 pl-1.5 border-l border-amber-300 tabular-nums text-amber-700">
              −${overage.toFixed(2)}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs space-y-0.5">
          <div><strong>{balance.toFixed(0)}</strong> platform credits available</div>
          {hasDue && (
            <>
              <div className="text-amber-700">
                {overage.toFixed(0)} overage credits pending (<strong>${overage.toFixed(2)}</strong> due)
              </div>
              <div className="text-foreground">
                Net balance: <strong>{netCredits.toFixed(0)}</strong> credits
              </div>
            </>
          )}
          <div className="text-muted-foreground pt-1">Click to manage or buy more</div>
        </div>
      </TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}
