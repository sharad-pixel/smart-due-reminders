import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CalendarClock, Receipt, TrendingUp, ArrowRight } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { computeContractTotals } from "@/lib/clm/financialMetrics";

const PAGE_SIZE = 5;

export const ContractSummaryCard = () => {
  const { isActive, isLoading: clmLoading } = useClmEntitlement();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-contract-summary"],
    enabled: isActive,
    queryFn: async () => {
      const { data: imports } = await supabase
        .from("live_contract_imports")
        .select("id, contract_name, contract_type, effective_date, term_end_date, debtor_id")
        .in("status", ["approved", "imported"])
        .order("updated_at", { ascending: false })
        .limit(50);

      const importIds = (imports ?? []).map((i) => i.id);
      if (importIds.length === 0) return { imports: [], fields: [], dates: [], schedules: [] };

      const [{ data: fields }, { data: dates }, { data: schedules }] = await Promise.all([
        supabase
          .from("live_contract_extracted_fields")
          .select("import_id, field_group, field_key, field_value")
          .in("import_id", importIds)
          .in("field_group", ["commercial", "contract"]),
        supabase
          .from("contract_critical_dates")
          .select("import_id, date_type, due_date, status, risk_level")
          .in("import_id", importIds)
          .gte("due_date", new Date().toISOString().slice(0, 10))
          .order("due_date", { ascending: true })
          .limit(8),
        supabase
          .from("contract_invoice_schedules")
          .select("import_id, scheduled_date, amount, currency, billing_type, description, status")
          .in("import_id", importIds)
          .order("scheduled_date", { ascending: true })
          .limit(8),
      ]);

      return {
        imports: imports ?? [],
        fields: fields ?? [],
        dates: dates ?? [],
        schedules: schedules ?? [],
      };
    },
  });

  if (clmLoading || !isActive) return null;
  if (isLoading) return null;
  if (!data || data.imports.length === 0) return null;

  // Aggregate MRR/ARR/ACV/TCV across active contracts using shared derivation
  const totals = { mrr: 0, arr: 0, acv: 0, tcv: 0, currency: "USD" };
  for (const imp of data.imports) {
    const impFields = data.fields.filter((f: any) => f.import_id === imp.id);
    const t = computeContractTotals(impFields, imp);
    totals.mrr += t.mrr;
    totals.arr += t.arr;
    totals.acv += t.acv;
    totals.tcv += t.tcv;
    if (t.currency && t.currency !== "USD") totals.currency = t.currency;
  }

  const activeContracts = data.imports.filter((c) => {
    if (!c.term_end_date) return true;
    return new Date(c.term_end_date) >= new Date();
  });

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Current Contract Summary
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/live-contracts")}>
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Financial metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile label="MRR" value={formatCurrency(totals.mrr, totals.currency)} icon={TrendingUp} />
          <MetricTile label="ARR" value={formatCurrency(totals.arr, totals.currency)} icon={TrendingUp} />
          <MetricTile label="ACV" value={formatCurrency(totals.acv, totals.currency)} icon={TrendingUp} />
          <MetricTile label="Active Contracts" value={String(activeContracts.length)} icon={FileText} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Current Term */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Current Term
            </div>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {activeContracts.slice(0, PAGE_SIZE).map((c) => (
                <div key={c.id} className="text-sm border rounded-md p-2">
                  <div className="font-medium truncate">{c.contract_name || "Untitled contract"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.effective_date ? formatDateShort(c.effective_date) : "—"}
                    {" → "}
                    {c.term_end_date ? formatDateShort(c.term_end_date) : "Open"}
                  </div>
                  {c.contract_type && (
                    <Badge variant="outline" className="mt-1 text-[10px] font-normal">{c.contract_type}</Badge>
                  )}
                </div>
              ))}
              {activeContracts.length === 0 && (
                <p className="text-xs text-muted-foreground">No active contracts.</p>
              )}
            </div>
          </div>

          {/* Key Dates */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> Upcoming Key Dates
            </div>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {data.dates.slice(0, PAGE_SIZE).map((d, idx) => (
                <div key={idx} className="text-sm border rounded-md p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium capitalize truncate">{d.date_type.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">{formatDateShort(d.due_date)}</div>
                  </div>
                  {d.risk_level && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-normal shrink-0 ${
                        d.risk_level === "high" || d.risk_level === "critical"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : d.risk_level === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {d.risk_level}
                    </Badge>
                  )}
                </div>
              ))}
              {data.dates.length === 0 && (
                <p className="text-xs text-muted-foreground">No upcoming dates.</p>
              )}
            </div>
          </div>

          {/* Invoice Schedule */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5" /> Invoice Schedule
            </div>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {data.schedules.slice(0, PAGE_SIZE).map((s, idx) => (
                <div key={idx} className="text-sm border rounded-md p-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {s.description || s.billing_type || "Scheduled invoice"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateShort(s.scheduled_date)}
                    </div>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    {s.amount != null ? formatCurrency(Number(s.amount), s.currency || "USD") : "—"}
                  </div>
                </div>
              ))}
              {data.schedules.length === 0 && (
                <p className="text-xs text-muted-foreground">No scheduled invoices.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const MetricTile = ({
  label, value, icon: Icon,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) => (
  <div className="border rounded-md p-3 bg-muted/30">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
      <Icon className="h-3 w-3" /> {label}
    </div>
    <div className="text-lg font-semibold mt-1 truncate">{value}</div>
  </div>
);
