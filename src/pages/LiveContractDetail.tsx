import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import Layout from "@/components/layout/Layout";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Trash2,
  Archive,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ContractTasksPanel } from "@/components/clm/ContractTasksPanel";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import SEO from "@/components/seo/SEO";
import {
  computeContractTotals,
  AMOUNT_KEYS,
  toNumber,
} from "@/lib/clm/financialMetrics";
import { ContractStagingPanel } from "@/components/clm/ContractStagingPanel";
import { ContractReassessPanel } from "@/components/clm/ContractReassessPanel";
import ContractRevenueItemsPanel from "@/components/contracts/ContractRevenueItemsPanel";
import { ContractOverviewEditor } from "@/components/clm/ContractOverviewEditor";
import { ContractScheduleLines } from "@/components/clm/ContractScheduleLines";
import { ProductCatalogMatchCard } from "@/components/clm/ProductCatalogMatchCard";
import { ContractValueByYearCard } from "@/components/clm/ContractValueByYearCard";

import { ContractExtractedFieldsEditor } from "@/components/clm/ContractExtractedFieldsEditor";
import { EditableFinancialTermsCard } from "@/components/clm/EditableFinancialTermsCard";
import { ContractRiskFlagsEditor } from "@/components/clm/ContractRiskFlagsEditor";
import { InvoiceDataAuditPanel } from "@/components/clm/InvoiceDataAuditPanel";
import { ContractTermGauge } from "@/components/clm/ContractTermGauge";
import { ContractRevRecASC606 } from "@/components/clm/ContractRevRecASC606";
import { AssessmentPanel } from "@/components/ai/AssessmentPanel";
import { KeyDatesNotificationsPanel } from "@/components/clm/KeyDatesNotificationsPanel";
import { ContractFinancialExport } from "@/components/clm/ContractFinancialExport";
import { ContractPageNav } from "@/components/clm/ContractPageNav";
import { ContractPerformanceObligations } from "@/components/clm/ContractPerformanceObligations";
import { ContractBillingRequirements } from "@/components/clm/ContractBillingRequirements";
import { ContractInvoiceRecapture } from "@/components/clm/ContractInvoiceRecapture";
import { ContractInvoiceBacklog } from "@/components/clm/ContractInvoiceBacklog";
import { ContractCustomTriggersPanel } from "@/components/clm/ContractCustomTriggersPanel";
import { ContractStripeBillingSync } from "@/components/clm/billing-sync/ContractStripeBillingSync";

import { Asc606AssessmentDialog } from "@/components/contracts/Asc606AssessmentDialog";
import { RevenueComplianceReview } from "@/components/contracts/RevenueComplianceReview";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { FileCheck2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AssignContractDebtor } from "@/components/contracts/AssignContractDebtor";
import { ContractStatusStepper } from "@/components/contracts/ContractStatusStepper";
import { ContractSupportingDocsPanel } from "@/components/contracts/ContractSupportingDocsPanel";
import { ContractLinksPanel } from "@/components/clm/ContractLinksPanel";
import { ContractComplianceChecklist } from "@/components/clm/ContractComplianceChecklist";
import { ContractDetailSubHeader } from "@/components/clm/ContractDetailSubHeader";
import { ContractAgreementFamily } from "@/components/clm/ContractAgreementFamily";
import { DocumentTypeBadge } from "@/components/clm/DocumentTypeBadge";
import { NicolasLineReviewBanner } from "@/components/clm/NicolasLineReviewBanner";
import { ContractSection } from "@/components/contracts/ContractSection";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [revFilter, setRevFilter] = useState<"all" | "recurring" | "services" | "fixed">("all");

  const handleDelete = async () => {
    if (!importId) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "delete_import" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Contract deleted");
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      navigate("/contracts");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleArchive = async () => {
    if (!importId) return;
    setArchiving(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "archive_import" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Contract archived — invoices and alerts preserved for audit");
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      navigate("/contracts");
    } catch (e: any) {
      toast.error(e?.message || "Archive failed");
    } finally {
      setArchiving(false);
      setConfirmArchive(false);
    }
  };

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
    // Poll while AI is still extracting so the page updates the moment it lands.
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.imp?.status;
      return s && ["found", "queued", "scanning", "ocr_processing", "ai_extracting", "processing", "extracting"].includes(String(s)) ? 3000 : false;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const totals = useMemo(() => {
    // Prefer cached engine output when healthy, but derive fresh client-side when
    // an older cache classified prepaid recurring schedule rows as one-time.
    const cached = (data?.imp as any)?.metrics_jsonb;
    const schedules = data?.schedules || [];
    let scheduled = 0;
    schedules.forEach((s: any) => {
      scheduled += toNumber(s.amount);
    });
    const derived = computeContractTotals(data?.fields || [], data?.imp || undefined, {
      schedule: schedules as any[],
    });
    const staleScheduleCache =
      schedules.length > 0 &&
      toNumber((cached as any)?.tcv) > 0 &&
      toNumber((cached as any)?.recurringTcv) === 0 &&
      toNumber((derived as any)?.recurringTcv) > 0;
    const base = cached && typeof cached === "object" && cached.source && !staleScheduleCache
      ? cached
      : derived;

    // Reconcile schedule sum vs TCV across the life of the contract.
    // If they diverge by more than 1% (and both are present) the extraction is
    // suspect — we surface a warning and the page triggers an auto re-assess.
    const tcvVal = toNumber((base as any).tcv);
    let scheduleVariance = 0;
    let scheduleMismatch = false;
    if (tcvVal > 0 && scheduled > 0) {
      scheduleVariance = (scheduled - tcvVal) / tcvVal;
      if (Math.abs(scheduleVariance) > 0.01) scheduleMismatch = true;
    }
    const warnings: string[] = Array.isArray((base as any).warnings)
      ? [...(base as any).warnings]
      : [];
    if (scheduleMismatch) {
      const direction = scheduleVariance > 0 ? "exceeds" : "is below";
      warnings.unshift(
        `Scheduled invoice total (${scheduled.toLocaleString(undefined, { maximumFractionDigits: 0 })}) ${direction} TCV (${tcvVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}) by ${(Math.abs(scheduleVariance) * 100).toFixed(1)}% — re-assessing extraction.`,
      );
    }
    return { ...base, scheduled, scheduleVariance, scheduleMismatch, warnings };
  }, [data]);

  const [recomputing, setRecomputing] = useState(false);
  const handleRecompute = async () => {
    if (!importId) return;
    setRecomputing(true);
    try {
      const { error } = await supabase.functions.invoke("contract-metrics-recompute", {
        body: { import_id: importId },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
    } catch (e) {
      console.error("Recompute failed", e);
    } finally {
      setRecomputing(false);
    }
  };

  // Auto-reassess when schedule total doesn't tie to TCV.
  // Guard: only once per import per browser session to avoid loops / re-billing.
  const autoReassessTriedRef = useRef(false);
  const [autoReassessing, setAutoReassessing] = useState(false);
  useEffect(() => {
    if (!importId || !totals?.scheduleMismatch) return;
    if (autoReassessTriedRef.current) return;
    const storageKey = `contract-auto-reassess:${importId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) return;
    autoReassessTriedRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(storageKey, "1");
    (async () => {
      setAutoReassessing(true);
      try {
        // First try a lightweight recompute (no AI cost).
        await supabase.functions.invoke("contract-metrics-recompute", {
          body: { import_id: importId },
        });
        await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
        // If still mismatched after recompute, fall back to a full re-extract.
        const { data: fresh } = await supabase
          .from("live_contract_imports")
          .select("metrics_jsonb")
          .eq("id", importId)
          .maybeSingle();
        const cachedTcv = toNumber((fresh as any)?.metrics_jsonb?.tcv);
        if (cachedTcv > 0 && totals.scheduled > 0 && Math.abs((totals.scheduled - cachedTcv) / cachedTcv) > 0.01) {
          await supabase.functions.invoke("live-contract-extract", { body: { importId } });
          await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
        }
      } catch (e) {
        console.error("Auto re-assess failed", e);
      } finally {
        setAutoReassessing(false);
      }
    })();
  }, [importId, totals?.scheduleMismatch, totals?.scheduled, qc]);

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
          <Link to="/contracts">Back to Contracts</Link>
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
    <div className="container mx-auto py-4 space-y-4">
      <SEO
        title={`${c.contract_name || "Contract"} — Contract Intelligence`}
        description="Financial terms and risk profile for this contract."
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate(data.debtor ? `/debtors/${data.debtor.id}` : "/ai-ingestion");
        }}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {data.debtor
          ? `Back to ${data.debtor.company_name || data.debtor.name}`
          : "Back to Contracts"}
      </Button>

      <ClmBrandedHeader
        title={c.contract_name || "Untitled Contract"}
        subtitle={c.contract_type || "Contract"}
        meta={`${c.effective_date ? formatDateShort(c.effective_date) : "—"} → ${
          c.term_end_date ? formatDateShort(c.term_end_date) : "Open"
        }${c.status ? ` · ${String(c.status).replace(/_/g, " ")}` : ""}`}
        rightSlot={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <DocumentTypeBadge
              type={(c as any).document_type}
              confidence={(c as any).document_type_confidence}
              full
            />
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
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Contract Command
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link to="/team">
                <Users className="h-4 w-4 mr-1" />
                Manage team
              </Link>
            </Button>
            {(() => {
              const DELETABLE = new Set([
                "found", "queued", "scanning", "ocr_processing", "ai_extracting",
                "needs_review", "failed", "rejected", "duplicate",
              ]);
              const canDelete = DELETABLE.has(String(c.status || ""));
              if (canDelete) {
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                );
              }
              if (c.status === "archived") {
                return (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archived
                  </Badge>
                );
              }
              return (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmArchive(true)}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </Button>
              );
            })()}
            {data.debtor ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/debtors/${data.debtor.id}`}>
                    <Building2 className="h-4 w-4 mr-1" />
                    {data.debtor.company_name || data.debtor.name}
                  </Link>
                </Button>
                <AssignContractDebtor
                  importId={c.id}
                  currentDebtorId={c.debtor_id || null}
                  currentDebtorName={data.debtor.company_name || data.debtor.name}
                />
              </>
            ) : (
              <AssignContractDebtor
                importId={c.id}
                currentDebtorId={null}
              />
            )}
          </div>
        }
      />

      <ContractDetailSubHeader
        importId={c.id}
        initialContractType={c.contract_type}
        onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
        onScrollToLinks={() => {
          const el = document.getElementById("contract-links");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <ContractStatusStepper importId={c.id} status={c.status} />

      <Asc606ReferenceBanner />

      <ContractAgreementFamily
        importId={c.id}
        accountId={c.account_id}
        debtorId={c.debtor_id}
      />

      <ContractPageNav />

      {/* ============ 1. FINANCE ============ */}
      <ContractSection id="finance" title="Finance" icon={<TrendingUp className="h-3.5 w-3.5" />}>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Financial Summary
              <Badge variant="outline" className="ml-2 text-[10px] font-normal capitalize">
                {String(totals.source || "—").replace(/_/g, " ")}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={revFilter} onValueChange={(v: any) => setRevFilter(v)}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All revenue</SelectItem>
                  <SelectItem value="recurring" className="text-xs">Recurring only</SelectItem>
                  <SelectItem value="services" className="text-xs">Professional Services</SelectItem>
                  <SelectItem value="fixed" className="text-xs">Fixed / One-time</SelectItem>
                </SelectContent>
              </Select>
              <ContractFinancialExport
                contractName={c.contract_name || c.file_name || "Contract"}
                customerName={data.debtor?.company_name || data.debtor?.name || null}
                totals={totals as any}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRecompute}
                disabled={recomputing}
              >
                {recomputing ? "Recalculating…" : "Recalculate"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {autoReassessing && (
              <div className="rounded-md border border-blue-200 bg-blue-50 text-blue-900 p-2 text-xs flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Schedule total doesn't tie to TCV — re-assessing the contract automatically…
              </div>
            )}
            {Array.isArray(totals.warnings) && totals.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-2 text-xs space-y-1">
                <div className="font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Review recommended
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {totals.warnings.slice(0, 4).map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {(() => {
              const years = totals.termYears > 0 ? totals.termYears : 0;
              const recTcv = totals.recurringTcv || 0;
              const svcTcv = totals.servicesTcv || 0;
              const fixedTcv = totals.oneTimeTcv || 0;
              const totalTcv = totals.tcv > 0 ? totals.tcv : recTcv + svcTcv + fixedTcv;
              let sliceTcv = totalTcv;
              let sliceLabel = "Annualized Revenue";
              if (revFilter === "recurring") { sliceTcv = recTcv; sliceLabel = "Annualized Recurring"; }
              else if (revFilter === "services") { sliceTcv = svcTcv; sliceLabel = "Annualized Services"; }
              else if (revFilter === "fixed") { sliceTcv = fixedTcv; sliceLabel = "Annualized Fixed"; }
              const annualized = years > 0 && sliceTcv > 0 ? sliceTcv / years : (revFilter === "all" || revFilter === "recurring" ? totals.arr : 0);
              const monthly = annualized > 0 ? annualized / 12 : 0;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <KpiTile label="MRR" value={formatCurrency(monthly, totals.currency)} />
                  <KpiTile label={sliceLabel} value={formatCurrency(annualized, totals.currency)} />
                  <KpiTile label="ACV" value={formatCurrency(annualized, totals.currency)} />
                  <KpiTile label="Slice TCV" value={formatCurrency(sliceTcv, totals.currency)} />
                  <KpiTile
                    label={totals.tcv > 0 ? "TCV" : "Scheduled"}
                    value={formatCurrency(
                      totals.tcv > 0 ? totals.tcv : totals.scheduled,
                      totals.currency,
                    )}
                  />
                </div>
              );
            })()}
            <p className="text-[11px] text-muted-foreground pt-1">
              Filter switches the annualized view between Recurring (ASC 606 over-time), Professional Services, and Fixed/One-time. TCV always reflects the full contract.
            </p>
            {(totals.recurringTcv > 0 || totals.servicesTcv > 0 || totals.oneTimeTcv > 0) && (
              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t">
                <span>Recurring TCV: {formatCurrency(totals.recurringTcv || 0, totals.currency)}</span>
                <span>Services TCV: {formatCurrency(totals.servicesTcv || 0, totals.currency)}</span>
                <span>One-time TCV: {formatCurrency(totals.oneTimeTcv || 0, totals.currency)}</span>
                {totals.termMonths > 0 && <span>Term: {Math.round(totals.termMonths)} mo</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <ContractPerformanceObligations
          schedules={data.schedules as any}
          defaultCurrency={totals.currency}
        />

        <ContractReassessPanel importId={c.id} currentFileName={c.file_name} />

        <ContractOverviewEditor
          contract={c}
          onSaved={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
        />

        <EditableFinancialTermsCard
          importId={c.id}
          accountId={c.account_id}
          extractionId={(data.fields[0] as any)?.extraction_id || null}
          financialFields={financialFields as any}
          currency={totals.currency}
          onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
        />

        <ContractValueByYearCard
          schedules={data.schedules as any}
          effectiveDate={c.effective_date}
          termEndDate={c.term_end_date}
          defaultCurrency={totals.currency}
          importId={c.id}
          onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
        />
      </ContractSection>

      {/* ============ 2. TERM & KEY DATES ============ */}
      <ContractSection id="term-dates" title="Term & Key Dates" icon={<CalendarClock className="h-3.5 w-3.5" />}>
        <ContractTermGauge
          effectiveDate={c.effective_date}
          termEndDate={c.term_end_date}
          keyDates={data.dates}
        />

        <ContractRevRecASC606
          schedules={data.schedules as any}
          effectiveDate={c.effective_date}
          termEndDate={c.term_end_date}
          defaultCurrency={totals.currency}
          contractId={c.id}
          contractTitle={c.contract_name || c.file_name}
        />

        <KeyDatesNotificationsPanel importId={c.id} dates={data.dates as any} />
      </ContractSection>

      {/* ============ 3. RISK & READINESS ============ */}
      <ContractSection id="risk" title="Risk & Readiness" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        <ContractComplianceChecklist
          importId={c.id}
          accountId={c.account_id}
          contract={c}
          fields={data.fields as any[]}
          schedules={data.schedules as any[]}
          flags={data.flags as any[]}
        />
        <div id="contract-links" className="scroll-mt-16">
          <ContractLinksPanel
            importId={c.id}
            accountId={c.account_id}
            debtorId={c.debtor_id || null}
          />
        </div>
        <ContractRiskFlagsEditor importId={c.id} accountId={c.account_id} />
        <AssessmentPanel
          scope="contract_intelligence"
          subjectType="contract"
          subjectId={c.id}
        />
      </ContractSection>

      {/* ============ 4. INVOICING & COLLECTIBILITY ============ */}
      <ContractSection id="invoicing" title="Invoicing & Collectibility" icon={<FileSignature className="h-3.5 w-3.5" />}>
        <ContractBillingRequirements fields={data.fields as any} />

        <ContractInvoiceRecapture importId={c.id} debtorId={c.debtor_id || null} />

        <ContractInvoiceBacklog schedules={data.schedules as any} defaultCurrency={totals.currency} />

        <NicolasLineReviewBanner
          importId={c.id}
          status={c.status}
          ackAt={(c as any).nicolas_line_review_ack_at}
        />

        <ProductCatalogMatchCard importId={c.id} />

        <ContractScheduleLines
          importId={c.id}
          debtorId={c.debtor_id || null}
          staged={c.staging_status !== "published"}
          published={c.staging_status === "published"}
          schedules={data.schedules}
          defaultCurrency={totals.currency}
          onChanged={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
        />

        <InvoiceDataAuditPanel contractId={c.id} />
        <AssessmentPanel
          scope="collectability"
          subjectType="contract"
          subjectId={c.id}
        />
      </ContractSection>

      {/* ============ 5. CUSTOM TRIGGERS ============ */}
      <ContractSection id="triggers" title="Custom Triggers" icon={<FileCheck2 className="h-3.5 w-3.5" />} defaultOpen={false}>
        <ContractCustomTriggersPanel
          importId={c.id}
          accountId={c.account_id}
          fields={data.fields as any}
        />
      </ContractSection>

      {/* ============ 5b. STRIPE BILLING SYNC ============ */}
      <ContractSection id="billing-sync" title="Billing Sync" icon={<FileCheck2 className="h-3.5 w-3.5" />} defaultOpen={false}>
        <ContractStripeBillingSync
          contractId={c.id}
          fields={(data.fields[0] as any) || {}}
          currency={(c as any).currency || (data.fields[0] as any)?.currency}
        />
      </ContractSection>



      {/* ============ ALL EXTRACTED TERMS ============ */}
      <ContractSection id="all-terms" title="All Extracted Terms" icon={<FileSignature className="h-3.5 w-3.5" />} defaultOpen={false}>
        <ContractExtractedFieldsEditor
          importId={c.id}
          accountId={c.account_id}
          extractionId={(data.fields[0] as any)?.extraction_id || null}
          debtorId={c.debtor_id || null}
          debtorName={(c as any).debtor?.company_name || (c as any).debtor?.name || null}
        />

        <ContractTasksPanel
          debtorId={c.debtor_id || null}
          contractName={c.contract_name}
        />
      </ContractSection>


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

      <ContractSupportingDocsPanel importId={c.id} accountId={c.account_id} />

      {importId && accountId && (
        <ContractRevenueItemsPanel importId={importId} accountId={accountId} />
      )}

      {importId && accountId && (
        <RevenueComplianceReview
          contractId={importId}
          accountId={accountId}
          contractTitle={c.contract_name || "Untitled Contract"}
        />
      )}

      {/* Legacy standalone dialog trigger — kept for the header "ASC 606 Assessment" button */}
      {accountId && importId && (
        <Asc606AssessmentDialog
          open={asc606Open}
          onOpenChange={setAsc606Open}
          contractId={importId}
          accountId={accountId}
          contractTitle={c.contract_name || "Untitled Contract"}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{c.contract_name || c.file_name || "this contract"}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the contract, its extracted fields, schedule lines, risk flags,
              and audit history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmArchive} onOpenChange={(o) => !archiving && setConfirmArchive(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{c.contract_name || c.file_name || "this contract"}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This contract has been extracted and may have generated invoices and date alerts.
              Archiving hides it from active views and pauses future alerts, but keeps the contract,
              its invoices, schedule lines, and audit history intact for compliance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleArchive(); }}
              disabled={archiving}
            >
              {archiving ? "Archiving…" : "Archive contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const KpiTile = ({ label, value }: { label: string; value: string }) => (
  <div className="border rounded-md px-2.5 py-2 bg-muted/30">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
      {label}
    </div>
    <div className="text-base font-semibold mt-0.5 truncate">{value}</div>
  </div>
);

const LiveContractDetail = () => (
  <Layout>
    <LiveContractDetailInner />
  </Layout>
);

export default LiveContractDetail;
