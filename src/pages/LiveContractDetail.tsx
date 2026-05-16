import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import Layout from "@/components/layout/Layout";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  FileSignature,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  Building2,
  ExternalLink,
  Users,
  ShieldAlert,
} from "lucide-react";
import { ContractTasksPanel } from "@/components/clm/ContractTasksPanel";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import SEO from "@/components/seo/SEO";
import {
  computeContractTotals,
  AMOUNT_KEYS,
  toNumber,
} from "@/lib/clm/financialMetrics";
import { ContractStagingPanel } from "@/components/clm/ContractStagingPanel";
import { ContractOverviewEditor } from "@/components/clm/ContractOverviewEditor";
import { ContractScheduleLines } from "@/components/clm/ContractScheduleLines";
import { InvoiceDataAuditPanel } from "@/components/clm/InvoiceDataAuditPanel";
import { ContractTermGauge } from "@/components/clm/ContractTermGauge";
import { ContractReconciliationPanel } from "@/components/contracts/ContractReconciliationPanel";
import { Asc606AssessmentDialog } from "@/components/contracts/Asc606AssessmentDialog";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { FileCheck2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const FIN_KEYS = new Set<string>([
  ...Array.from(AMOUNT_KEYS),
  "currency",
  "payment_terms",
  "billing_frequency",
  "auto_renewal",
  "renewal_term",
  "renewal_frequency",
  "notice_period",
  "true_up",
  "subscription_fees",
  "platform_fees",
  "one_time_fees",
  "professional_services_fees",
]);

const LiveContractDetailInner = () => {
  const { importId } = useParams<{ importId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { accountId } = useClmEntitlement();
  const [asc606Open, setAsc606Open] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["live-contract-detail", importId],
    enabled: !!importId,
    queryFn: async () => {
      const [imp, fields, dates, schedules, flags] = await Promise.all([
        supabase
          .from("live_contract_imports")
          .select("*")
          .eq("id", importId!)
          .maybeSingle(),
        supabase
          .from("live_contract_extracted_fields")
          .select("*")
          .eq("import_id", importId!),
        supabase
          .from("contract_critical_dates")
          .select("*")
          .eq("import_id", importId!)
          .order("due_date"),
        supabase
          .from("contract_invoice_schedules")
          .select("*")
          .eq("import_id", importId!)
          .order("scheduled_date"),
        supabase
          .from("contract_risk_flags")
          .select("*")
          .eq("import_id", importId!),
      ]);

      let debtorRow: any = null;
      if (imp.data?.debtor_id) {
        const { data: d } = await supabase
          .from("debtors")
          .select("id, company_name, name, current_balance")
          .eq("id", imp.data.debtor_id)
          .maybeSingle();
        debtorRow = d;
      }

      return {
        imp: imp.data,
        fields: fields.data || [],
        dates: dates.data || [],
        schedules: schedules.data || [],
        flags: flags.data || [],
        debtor: debtorRow,
      };
    },
  });

  const totals = useMemo(() => {
    const t = computeContractTotals(data?.fields || [], data?.imp || undefined);
    let scheduled = 0;
    (data?.schedules || []).forEach((s: any) => {
      scheduled += toNumber(s.amount);
    });
    return { ...t, scheduled };
  }, [data]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.imp) {
    return (
      <div className="container mx-auto py-16 text-center">
        <p className="text-muted-foreground">Contract not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/contracts/live">Back to Live Contracts</Link>
        </Button>
      </div>
    );
  }

  const c = data.imp;
  const financialFields = data.fields.filter((f: any) =>
    FIN_KEYS.has(f.field_key),
  );
  const otherFields = data.fields.filter(
    (f: any) => !FIN_KEYS.has(f.field_key) && f.field_group !== "commercial",
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <SEO
        title={`${c.contract_name || "Contract"} — Contract Intelligence`}
        description="Financial terms and risk profile for this contract."
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate(data.debtor ? `/debtors/${data.debtor.id}` : "/contracts/live");
        }}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {data.debtor
          ? `Back to ${data.debtor.company_name || data.debtor.name}`
          : "Back to Live Contracts"}
      </Button>

      <ClmBrandedHeader
        title={c.contract_name || "Untitled Contract"}
        subtitle={c.contract_type || "Contract"}
        meta={`${c.effective_date ? formatDateShort(c.effective_date) : "—"} → ${
          c.term_end_date ? formatDateShort(c.term_end_date) : "Open"
        }${c.status ? ` · ${String(c.status).replace(/_/g, " ")}` : ""}`}
        rightSlot={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(() => {
              const high = data.flags.filter((f: any) => f.severity === "high" || f.severity === "critical").length;
              const med = data.flags.filter((f: any) => f.severity === "medium").length;
              if (!high && !med) return null;
              return (
                <Badge
                  variant="outline"
                  className={high
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"}
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                  {high ? `${high} high risk` : `${med} medium risk`}
                </Badge>
              );
            })()}
            <Button
              size="sm"
              onClick={() => setAsc606Open(true)}
              className="bg-primary"
            >
              <FileCheck2 className="h-4 w-4 mr-1" />
              ASC 606 Assessment
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/team">
                <Users className="h-4 w-4 mr-1" />
                Manage team
              </Link>
            </Button>
            {data.debtor && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/debtors/${data.debtor.id}`}>
                  <Building2 className="h-4 w-4 mr-1" />
                  {data.debtor.company_name || data.debtor.name}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile label="MRR" value={formatCurrency(totals.mrr, totals.currency)} />
          <KpiTile label="ARR" value={formatCurrency(totals.arr, totals.currency)} />
          <KpiTile label="ACV" value={formatCurrency(totals.acv, totals.currency)} />
          <KpiTile
            label={totals.tcv > 0 ? "TCV" : "Scheduled"}
            value={formatCurrency(
              totals.tcv > 0 ? totals.tcv : totals.scheduled,
              totals.currency,
            )}
          />
        </CardContent>
      </Card>

      <ContractOverviewEditor
        contract={c}
        onSaved={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" /> Financial Terms
            </CardTitle>
          </CardHeader>
          <CardContent>
            {financialFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No financial terms extracted.
              </p>
            ) : (
              <dl className="divide-y text-sm">
                {financialFields.map((f: any) => {
                  const isAmount = AMOUNT_KEYS.has(f.field_key);
                  const numeric = isAmount ? toNumber(f.field_value) : 0;
                  const display =
                    isAmount && numeric > 0
                      ? formatCurrency(numeric, totals.currency)
                      : f.field_value || "—";
                  return (
                    <div
                      key={`${f.field_key}-${f.id}`}
                      className="flex items-start justify-between gap-3 py-2"
                    >
                      <dt className="text-muted-foreground capitalize">
                        {f.field_key.replace(/_/g, " ")}
                      </dt>
                      <dd className="font-medium text-right break-words max-w-[60%]">
                        {display}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Risk Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.flags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No risk flags identified.
              </p>
            ) : (
              <div className="space-y-2">
                {data.flags.map((f: any) => (
                  <div key={f.id} className="border rounded-md p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium capitalize">
                        {(f.flag_type || "risk").replace(/_/g, " ")}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          f.severity === "high" || f.severity === "critical"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : f.severity === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {f.severity || "low"}
                      </Badge>
                    </div>
                    {f.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {f.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ContractTermGauge
            effectiveDate={c.effective_date}
            termEndDate={c.term_end_date}
            keyDates={data.dates}
          />
        </div>

      </div>

      <ContractScheduleLines
        schedules={data.schedules}
        defaultCurrency={totals.currency}
        onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
      />

      <ContractReconciliationPanel
        importId={c.id}
        debtorId={c.debtor_id || null}
        staged={c.staging_status !== "published"}
        published={c.staging_status === "published"}
        schedules={data.schedules}
        defaultCurrency={totals.currency}
        onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
      />

      <ContractTasksPanel
        debtorId={c.debtor_id || null}
        contractName={c.contract_name}
      />

      <InvoiceDataAuditPanel contractId={c.id} />

      {/* Parties section omitted (no contract_parties table) */}

      {otherFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Other Extracted Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {otherFields.map((f: any) => (
                <div
                  key={f.id}
                  className="flex items-start justify-between gap-3 py-2"
                >
                  <dt className="text-muted-foreground capitalize">
                    {f.field_key.replace(/_/g, " ")}
                  </dt>
                  <dd className="font-medium text-right break-words max-w-[60%]">
                    {f.field_value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <ContractStagingPanel
        contractId={c.id}
        accountId={c.account_id}
        debtorId={c.debtor_id || null}
        contractName={c.contract_name || null}
        schedules={data.schedules}
        stagingStatus={c.staging_status || "draft"}
        onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
      />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/contracts/live?import=${c.id}`}>
            Open in Review Workspace <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

const KpiTile = ({ label, value }: { label: string; value: string }) => (
  <div className="border rounded-md p-3 bg-muted/30">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="text-lg font-semibold mt-1 truncate">{value}</div>
  </div>
);

const LiveContractDetail = () => (
  <Layout>
    <LiveContractDetailInner />
  </Layout>
);

export default LiveContractDetail;
