import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  FileSignature,
  CalendarClock,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Building2,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { SEO } from "@/components/seo/SEO";

const FIN_KEYS = new Set([
  "mrr",
  "arr",
  "acv",
  "tcv",
  "contract_value",
  "total_value",
  "monthly_fee",
  "annual_fee",
  "currency",
  "payment_terms",
  "billing_frequency",
  "discount",
  "auto_renewal",
  "renewal_term",
  "notice_period",
  "late_fee",
  "cap",
  "true_up",
]);

const num = (v: unknown) => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const LiveContractDetailInner = () => {
  const { importId } = useParams<{ importId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["live-contract-detail", importId],
    enabled: !!importId,
    queryFn: async () => {
      const [imp, fields, dates, schedules, flags, parties, debtor] =
        await Promise.all([
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
          supabase
            .from("contract_parties")
            .select("*")
            .eq("import_id", importId!),
          supabase
            .from("live_contract_imports")
            .select("debtor_id")
            .eq("id", importId!)
            .maybeSingle(),
        ]);

      let debtorRow: any = null;
      if (debtor.data?.debtor_id) {
        const { data: d } = await supabase
          .from("debtors")
          .select("id, company_name, name, current_balance")
          .eq("id", debtor.data.debtor_id)
          .maybeSingle();
        debtorRow = d;
      }

      return {
        imp: imp.data,
        fields: fields.data || [],
        dates: dates.data || [],
        schedules: schedules.data || [],
        flags: flags.data || [],
        parties: parties.data || [],
        debtor: debtorRow,
      };
    },
  });

  const totals = useMemo(() => {
    const t = { mrr: 0, arr: 0, acv: 0, tcv: 0, scheduled: 0, currency: "USD" };
    (data?.fields || []).forEach((f: any) => {
      if (f.field_key === "mrr") t.mrr += num(f.field_value);
      else if (f.field_key === "arr") t.arr += num(f.field_value);
      else if (f.field_key === "acv") t.acv += num(f.field_value);
      else if (f.field_key === "tcv" || f.field_key === "contract_value")
        t.tcv += num(f.field_value);
      else if (f.field_key === "currency" && f.field_value)
        t.currency = f.field_value;
    });
    if (t.arr === 0 && t.mrr > 0) t.arr = t.mrr * 12;
    if (t.acv === 0 && t.arr > 0) t.acv = t.arr;
    (data?.schedules || []).forEach((s: any) => {
      t.scheduled += num(s.amount);
    });
    return t;
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

      <Button variant="ghost" size="sm" asChild>
        <Link to={data.debtor ? `/customers/${data.debtor.id}` : "/contracts/live"}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {data.debtor
            ? `Back to ${data.debtor.company_name || data.debtor.name}`
            : "Back to Live Contracts"}
        </Link>
      </Button>

      <ClmBrandedHeader
        title={c.contract_name || "Untitled Contract"}
        subtitle={c.contract_type || "Contract"}
        meta={`${c.effective_date ? formatDateShort(c.effective_date) : "—"} → ${
          c.term_end_date ? formatDateShort(c.term_end_date) : "Open"
        }${c.status ? ` · ${String(c.status).replace(/_/g, " ")}` : ""}`}
        rightSlot={
          data.debtor && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/customers/${data.debtor.id}`}>
                <Building2 className="h-4 w-4 mr-1" />
                {data.debtor.company_name || data.debtor.name}
              </Link>
            </Button>
          )
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
                {financialFields.map((f: any) => (
                  <div
                    key={`${f.field_key}-${f.id}`}
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Key Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No key dates.</p>
            ) : (
              <div className="space-y-2">
                {data.dates.map((d: any) => (
                  <div
                    key={d.id}
                    className="text-sm border rounded-md p-2 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium capitalize">
                        {d.date_type.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateShort(d.due_date)}
                      </div>
                    </div>
                    {d.risk_level && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Invoice Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scheduled invoices.
              </p>
            ) : (
              <div className="space-y-2">
                {data.schedules.map((s: any) => (
                  <div
                    key={s.id}
                    className="text-sm border rounded-md p-2 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.description || s.billing_type || "Scheduled invoice"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateShort(s.scheduled_date)}
                      </div>
                    </div>
                    <div className="font-medium shrink-0">
                      {s.amount != null
                        ? formatCurrency(Number(s.amount), s.currency || totals.currency)
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data.parties.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {data.parties.map((p: any) => (
              <div key={p.id} className="border rounded-md p-3 text-sm">
                <div className="font-medium">{p.party_name || "—"}</div>
                {p.party_role && (
                  <div className="text-xs text-muted-foreground capitalize">
                    {p.party_role.replace(/_/g, " ")}
                  </div>
                )}
                {(p.contact_email || p.contact_phone) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.contact_email}
                    {p.contact_email && p.contact_phone ? " · " : ""}
                    {p.contact_phone}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
  <RequireClmAccess>
    <LiveContractDetailInner />
  </RequireClmAccess>
);

export default LiveContractDetail;
