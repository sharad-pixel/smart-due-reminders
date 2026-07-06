import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { formatCurrency } from "@/lib/formatters";
import {
  FileSignature,
  BadgeDollarSign,
  ShieldAlert,
  CalendarClock,
  Activity,
  ArrowRight,
  Search,
} from "lucide-react";

const DAY = 24 * 60 * 60 * 1000;
const isWithin = (iso: string | null | undefined, days: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const delta = t - Date.now();
  return delta >= 0 && delta <= days * DAY;
};

export const ContractIntelligenceSummary = () => {
  const navigate = useNavigate();
  const { accountId } = useAccountId();

  const { data: contracts } = useQuery({
    enabled: !!accountId,
    queryKey: ["dash-cid-contracts", accountId],
    queryFn: async () => {
      // Pull from live_contract_imports (ingested contracts) — the legacy
      // `contracts` table is unused in the current pipeline.
      const { data, error } = await (supabase as any)
        .from("live_contract_imports")
        .select("id,status,contract_type,contract_value,term_end_date,effective_date")
        .eq("account_id", accountId!)
        .neq("status", "archived")
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        status: r.status,
        contract_type: r.contract_type,
        contract_value: r.contract_value,
        currency: "USD",
        expiry_date: r.term_end_date,
        renewal_date: r.term_end_date,
      }));
    },
  });

  const { data: flags } = useQuery({
    enabled: !!accountId,
    queryKey: ["dash-cid-flags", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_risk_flags")
        .select("id,severity,resolved,import_id")
        .eq("account_id", accountId!)
        .limit(1000);
      if (error) return [];
      return data ?? [];
    },
  });

  const m = useMemo(() => {
    const list = contracts ?? [];
    const fl = (flags ?? []).filter((f: any) => !f.resolved);
    const active = list.filter((c: any) => (c.status ?? "").toLowerCase() !== "expired");
    const tcv = active.reduce((s: number, c: any) => s + (Number(c.contract_value) || 0), 0);
    const arr = active
      .filter((c: any) => c.contract_type && /subscription|saas|recurring|msa/i.test(c.contract_type))
      .reduce((s: number, c: any) => s + (Number(c.contract_value) || 0), 0);
    const critIds = new Set(
      fl.filter((f: any) => f.severity && /high|critical/i.test(f.severity)).map((f: any) => f.import_id),
    );
    const revenueAtRisk = list
      .filter((c: any) => critIds.has(c.id) || isWithin(c.expiry_date, 30))
      .reduce((s: number, c: any) => s + (Number(c.contract_value) || 0), 0);
    const renewals90 = list.filter(
      (c: any) => isWithin(c.renewal_date, 90) || isWithin(c.expiry_date, 90),
    ).length;
    const currency = (list[0] as any)?.currency || "USD";
    return { total: list.length, active: active.length, tcv, arr, revenueAtRisk, renewals90, currency };
  }, [contracts, flags]);

  if (!accountId) return null;

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
              <FileSignature className="h-3.5 w-3.5" /> Contract Intelligence
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/contracts/ingestion")}>
              <Activity className="h-3.5 w-3.5 mr-1.5" /> Contracts Ingestion
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate("/contracts/live")}>
              <FileSignature className="h-3.5 w-3.5 mr-1.5" /> Live Contracts <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
          <Kpi
            label="Total Contract Value"
            value={formatCurrency(m.tcv, m.currency)}
            sub={`${m.active} active`}
          />
          <Kpi
            label="Annual Recurring Revenue"
            value={formatCurrency(m.arr, m.currency)}
            sub="Subscription / MSA"
          />
          <Kpi
            label="Revenue at Risk"
            value={formatCurrency(m.revenueAtRisk, m.currency)}
            sub="Critical flags & <30d expiry"
          />
          <Kpi
            label="Renewals (90 days)"
            value={String(m.renewals90)}
            sub="action required"
          />
        </div>
      </CardContent>
    </Card>
  );
};

const Kpi = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) => (
  <div className="px-5 py-4">
    <div className="text-[11px] font-medium text-muted-foreground tracking-wide truncate">
      {label}
    </div>
    <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground truncate">
      {value}
    </div>
    {sub && <div className="mt-1 text-[11px] text-muted-foreground truncate">{sub}</div>}
  </div>
);

export default ContractIntelligenceSummary;
