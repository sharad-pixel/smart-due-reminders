import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/billing/asc606-credits"
          className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-xs font-medium transition-colors hover:bg-accent ${
            low ? "border-destructive/40 text-destructive" : "border-border text-foreground"
          }`}
          aria-label="Platform credits"
        >
          <Sparkles className={`h-3.5 w-3.5 ${low ? "text-destructive" : "text-primary"}`} />
          <span className="tabular-nums">{balance.toFixed(0)}</span>
          <span className="text-muted-foreground hidden md:inline">credits</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs">
          <div><strong>{balance.toFixed(0)}</strong> platform credits available</div>
          {overage > 0 && (
            <div className="text-destructive mt-0.5">
              {overage.toFixed(0)} overage credits pending (${overage.toFixed(2)})
            </div>
          )}
          <div className="text-muted-foreground mt-1">Click to manage or buy more</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
