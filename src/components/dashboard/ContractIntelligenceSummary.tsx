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
      const { data, error } = await supabase
        .from("contracts")
        .select("id,status,contract_type,contract_value,currency,expiry_date,renewal_date")
        .eq("account_id", accountId!)
        .limit(1000);
      if (error) throw error;
      return data ?? [];
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
      if (error) throw error;
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
    <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" /> Contract Intelligence
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Live revenue signal across every active contract
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/contracts/active")}>
              <Search className="h-3.5 w-3.5 mr-1.5" /> Browse contracts
            </Button>
            <Button size="sm" onClick={() => navigate("/contract-intelligence/dashboard")}>
              Open dashboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            icon={<BadgeDollarSign className="h-4 w-4 text-emerald-500" />}
            label="Total Contract Value"
            value={formatCurrency(m.tcv, m.currency)}
            sub={`${m.active} active`}
          />
          <Kpi
            icon={<Activity className="h-4 w-4 text-primary" />}
            label="Annual Recurring Revenue"
            value={formatCurrency(m.arr, m.currency)}
            sub="Subscription / MSA"
          />
          <Kpi
            icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
            label="Revenue at Risk"
            value={formatCurrency(m.revenueAtRisk, m.currency)}
            sub="Critical flags & <30d expiry"
          />
          <Kpi
            icon={<CalendarClock className="h-4 w-4 text-blue-500" />}
            label="Renewals (90 days)"
            value={String(m.renewals90)}
            sub={<Badge variant="outline" className="text-[10px]">action required</Badge>}
          />
        </div>
      </CardContent>
    </Card>
  );
};

const Kpi = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) => (
  <div className="rounded-lg border bg-card p-3">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1.5 text-xl font-semibold tracking-tight truncate">{value}</div>
    <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
  </div>
);

export default ContractIntelligenceSummary;
