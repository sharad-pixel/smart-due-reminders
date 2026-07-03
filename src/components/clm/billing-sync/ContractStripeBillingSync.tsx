import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStripeConnected } from "@/hooks/useStripeConnected";
import { useContractBillingSync } from "@/hooks/useContractBillingSync";
import { BillingSyncStatusCard } from "./BillingSyncStatusCard";
import { BillingReadinessCard } from "./BillingReadinessCard";
import { StripeProductMappingCard } from "./StripeProductMappingCard";
import { BillingPreviewCard } from "./BillingPreviewCard";
import { ContractCustomerLinkCard } from "./ContractCustomerLinkCard";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

interface Props {
  contractId: string;
  fields: any;
  currency?: string;
}

export function ContractStripeBillingSync({ contractId, fields, currency }: Props) {
  const { connected, integration } = useStripeConnected();
  const { sync, computeReadiness, syncToStripe } = useContractBillingSync(contractId);

  const { data: revenueItems = [] } = useQuery({
    queryKey: ["contract-revenue-items", contractId],
    enabled: connected,
    queryFn: async () => {
      const { data } = await supabase.from("contract_revenue_items").select("*").eq("import_id", contractId);
      return data ?? [];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["contract-invoice-schedules", contractId],
    enabled: connected,
    queryFn: async () => {
      const { data } = await supabase.from("contract_invoice_schedules").select("*").eq("import_id", contractId);
      return data ?? [];
    },
  });

  // Resolve the Recouply account → Stripe customer chain for this contract.
  const { data: linkage } = useQuery({
    queryKey: ["contract-debtor-stripe-link", contractId],
    enabled: connected,
    queryFn: async () => {
      const { data: imp } = await supabase
        .from("live_contract_imports")
        .select("debtor_id")
        .eq("id", contractId)
        .maybeSingle();
      const debtorId = (imp as any)?.debtor_id ?? null;
      if (!debtorId) return { debtorId: null, debtorName: null, stripeCustomerId: null };
      const { data: deb } = await supabase
        .from("debtors")
        .select("id, company_name, name, stripe_customer_id")
        .eq("id", debtorId)
        .maybeSingle();
      return {
        debtorId,
        debtorName: (deb as any)?.company_name || (deb as any)?.name || null,
        stripeCustomerId: (deb as any)?.stripe_customer_id ?? null,
      };
    },
  });

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          Connect Stripe to enable Billing Sync for this contract.
        </CardContent>
      </Card>
    );
  }

  const totals = {
    revenueItemsCount: revenueItems.length,
    scheduleCount: schedules.length,
    totalContractValue: revenueItems.reduce((a: number, r: any) => a + (Number(r.amount) || 0), 0),
  };

  const customerLinked = !!linkage?.stripeCustomerId;

  return (
    <div className="space-y-3">
      <ContractCustomerLinkCard
        debtorId={linkage?.debtorId ?? null}
        debtorName={linkage?.debtorName ?? null}
        stripeCustomerId={linkage?.stripeCustomerId ?? null}
      />
      <BillingSyncStatusCard
        sync={sync}
        stripeAccount={integration?.stripe_account_id}
        onRecompute={() => computeReadiness.mutate()}
        onSync={() => syncToStripe.mutate()}
        computing={computeReadiness.isPending}
        syncing={syncToStripe.isPending}
        customerLinked={customerLinked}
      />
      <BillingReadinessCard
        fields={fields}
        totals={totals}
        blockingIssues={sync?.blocking_issues}
        customerLinked={customerLinked}
      />
      <StripeProductMappingCard contractId={contractId} revenueItems={revenueItems} currency={currency} />
      <BillingPreviewCard fields={fields} revenueItems={revenueItems} schedules={schedules} currency={currency} />
    </div>
  );
}
