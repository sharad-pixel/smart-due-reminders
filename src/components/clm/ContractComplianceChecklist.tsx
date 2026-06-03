import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  MinusCircle,
  Sparkles,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type Status = "pass" | "warn" | "fail" | "unknown" | "na";

interface ItemDef {
  key: string;
  label: string;
  description: string;
}

const ITEMS: ItemDef[] = [
  {
    key: "fully_executed",
    label: "Contract fully executed",
    description: "Signatures from all parties present on the document.",
  },
  {
    key: "terms_identified",
    label: "Terms clearly identified",
    description: "Counterparty, value, currency, and payment terms extracted.",
  },
  {
    key: "performance_obligations_defined",
    label: "Performance obligations defined",
    description: "Schedule lines or distinct performance obligations identified.",
  },
  {
    key: "term_dates_defined",
    label: "Term dates clearly defined",
    description: "Effective and term-end (or renewal) dates extracted.",
  },
  {
    key: "risk_factors_assessed",
    label: "Risk factors assessed",
    description: "Risk flags reviewed; no unresolved high/critical risks.",
  },
];

const STATUS_META: Record<Status, { label: string; tone: string; Icon: any }> = {
  pass: { label: "Pass", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  warn: { label: "Needs review", tone: "bg-amber-50 text-amber-700 border-amber-200", Icon: AlertTriangle },
  fail: { label: "Fail", tone: "bg-red-50 text-red-700 border-red-200", Icon: XCircle },
  unknown: { label: "Unknown", tone: "bg-slate-50 text-slate-600 border-slate-200", Icon: HelpCircle },
  na: { label: "N/A", tone: "bg-slate-50 text-slate-500 border-slate-200", Icon: MinusCircle },
};

interface AutoComputeInputs {
  rawText: string | null;
  contract: any;
  fields: any[];
  schedules: any[];
  flags: any[];
}

function autoCompute({ rawText, contract, fields, schedules, flags }: AutoComputeInputs): Record<string, { status: Status; evidence: string }> {
  const out: Record<string, { status: Status; evidence: string }> = {};

  // 1. Fully executed — look for signature markers in raw text
  const text = (rawText || "").toLowerCase();
  const sigPatterns = [
    /\b(signed|executed)\b/,
    /\bsignature\b/,
    /\b\/s\//,
    /_{3,}\s*\n?\s*(name|title|signature)/i,
    /\bdocusign\b|\bhellosign\b|\badobe sign\b|\bpandadoc\b/,
  ];
  const sigHits = sigPatterns.filter((re) => re.test(text)).length;
  const partyHits = (text.match(/\b(by:|name:|title:)\b/g) || []).length;
  if (!rawText) {
    out.fully_executed = { status: "unknown", evidence: "Source text not yet extracted." };
  } else if (sigHits >= 2 && partyHits >= 2) {
    out.fully_executed = { status: "pass", evidence: `Signature markers detected (${sigHits} signature cues, ${partyHits} party markers).` };
  } else if (sigHits >= 1 || partyHits >= 1) {
    out.fully_executed = { status: "warn", evidence: "Partial signature evidence — verify both parties signed." };
  } else {
    out.fully_executed = { status: "fail", evidence: "No signature markers detected in document text." };
  }

  // 2. Terms identified — counterparty / value / currency / payment terms
  const fieldKeys = new Set(fields.map((f) => f.field_key));
  const hasCounterparty = !!contract?.contract_name || fieldKeys.has("counterparty") || fieldKeys.has("customer_name");
  const hasValue = Number(contract?.contract_value || 0) > 0 || fieldKeys.has("contract_value") || fieldKeys.has("tcv");
  const hasPayTerms = fieldKeys.has("payment_terms") || fieldKeys.has("billing_frequency");
  const score = [hasCounterparty, hasValue, hasPayTerms].filter(Boolean).length;
  out.terms_identified = {
    status: score === 3 ? "pass" : score >= 1 ? "warn" : "fail",
    evidence: `Counterparty: ${hasCounterparty ? "yes" : "no"} · Value: ${hasValue ? "yes" : "no"} · Payment terms: ${hasPayTerms ? "yes" : "no"}.`,
  };

  // 3. Performance obligations
  if (schedules.length >= 1) {
    out.performance_obligations_defined = {
      status: "pass",
      evidence: `${schedules.length} performance obligation${schedules.length === 1 ? "" : "s"} / schedule line${schedules.length === 1 ? "" : "s"} identified.`,
    };
  } else if (fieldKeys.has("product_description") || contract?.product_description) {
    out.performance_obligations_defined = {
      status: "warn",
      evidence: "Product description present but no discrete schedule lines extracted.",
    };
  } else {
    out.performance_obligations_defined = { status: "fail", evidence: "No performance obligations or schedule lines identified." };
  }

  // 4. Term dates
  const hasEff = !!contract?.effective_date;
  const hasEnd = !!contract?.term_end_date;
  out.term_dates_defined = {
    status: hasEff && hasEnd ? "pass" : hasEff || hasEnd ? "warn" : "fail",
    evidence: `Effective: ${hasEff ? "yes" : "no"} · Term end: ${hasEnd ? "yes" : "no"}.`,
  };

  // 5. Risk factors
  const unresolved = flags.filter((f) => !f.resolved);
  const high = unresolved.filter((f) => f.severity === "high" || f.severity === "critical").length;
  const med = unresolved.filter((f) => f.severity === "medium").length;
  if (flags.length === 0) {
    out.risk_factors_assessed = {
      status: "warn",
      evidence: "No risk assessment yet — run extraction or review the document.",
    };
  } else if (high > 0) {
    out.risk_factors_assessed = { status: "fail", evidence: `${high} high/critical risk${high === 1 ? "" : "s"} unresolved.` };
  } else if (med > 0) {
    out.risk_factors_assessed = { status: "warn", evidence: `${med} medium risk${med === 1 ? "" : "s"} unresolved.` };
  } else {
    out.risk_factors_assessed = { status: "pass", evidence: `${flags.length} risk${flags.length === 1 ? "" : "s"} reviewed, none unresolved.` };
  }

  return out;
}

interface Props {
  importId: string;
  accountId: string;
  contract: any;
  fields: any[];
  schedules: any[];
  flags: any[];
}

export const ContractComplianceChecklist = ({ importId, accountId, contract, fields, schedules, flags }: Props) => {
  const qc = useQueryClient();
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  // Load raw text for signature detection (single small fetch)
  const { data: rawText } = useQuery({
    queryKey: ["lc-rawtext", importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_extractions")
        .select("raw_text")
        .eq("import_id", importId)
        .order("extracted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.raw_text || null;
    },
  });

  const { data: saved } = useQuery({
    queryKey: ["lc-checklist", importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_checklist_items" as any)
        .select("*")
        .eq("import_id", importId);
      return ((data as any[]) || []).reduce<Record<string, any>>((acc, r) => {
        acc[r.item_key] = r;
        return acc;
      }, {});
    },
  });

  const auto = useMemo(
    () => autoCompute({ rawText: rawText ?? null, contract, fields, schedules, flags }),
    [rawText, contract, fields, schedules, flags],
  );

  // Effective rows: manual overrides win, else auto.
  const rows = ITEMS.map((def) => {
    const m = saved?.[def.key];
    const a = auto[def.key];
    if (m && m.source === "manual") {
      return {
        def,
        status: m.status as Status,
        evidence: m.evidence || a?.evidence || "",
        notes: m.notes || "",
        source: "manual" as const,
        savedId: m.id,
      };
    }
    return {
      def,
      status: (a?.status || "unknown") as Status,
      evidence: a?.evidence || "",
      notes: m?.notes || "",
      source: "auto" as const,
      savedId: m?.id,
    };
  });

  useEffect(() => {
    const next: Record<string, string> = {};
    rows.forEach((r) => {
      next[r.def.key] = r.notes;
    });
    setEditingNotes((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.fully_executed?.id]);

  const passCount = rows.filter((r) => r.status === "pass").length;
  const failCount = rows.filter((r) => r.status === "fail").length;
  const warnCount = rows.filter((r) => r.status === "warn").length;
  const pct = Math.round((passCount / ITEMS.length) * 100);

  const upsert = async (key: string, patch: { status?: Status; notes?: string; source?: "auto" | "manual"; evidence?: string }) => {
    const existing = saved?.[key];
    const payload = {
      account_id: accountId,
      import_id: importId,
      item_key: key,
      status: patch.status ?? existing?.status ?? auto[key]?.status ?? "unknown",
      source: patch.source ?? (patch.status ? "manual" : existing?.source ?? "auto"),
      evidence: patch.evidence ?? existing?.evidence ?? auto[key]?.evidence ?? null,
      notes: patch.notes ?? existing?.notes ?? null,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("live_contract_checklist_items" as any)
      .upsert(payload, { onConflict: "import_id,item_key" });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["lc-checklist", importId] });
  };

  const resetToAuto = async (key: string) => {
    const existing = saved?.[key];
    if (!existing?.id) return;
    const { error } = await supabase.from("live_contract_checklist_items" as any).delete().eq("id", existing.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Reset to AI assessment");
      qc.invalidateQueries({ queryKey: ["lc-checklist", importId] });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Contract Readiness Checklist
            </CardTitle>
            <CardDescription>
              AI-derived from OCR and extracted terms. Override any item to reflect your review.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{passCount} pass</Badge>
            {warnCount > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{warnCount} review</Badge>
            )}
            {failCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{failCount} fail</Badge>
            )}
          </div>
        </div>
        <div className="pt-2">
          <Progress value={pct} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">{pct}% complete · {passCount} of {ITEMS.length} items passing</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const meta = STATUS_META[r.status];
          const Icon = meta.Icon;
          return (
            <div key={r.def.key} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        r.status === "pass"
                          ? "text-emerald-600"
                          : r.status === "warn"
                          ? "text-amber-600"
                          : r.status === "fail"
                          ? "text-red-600"
                          : "text-slate-400"
                      }`}
                    />
                    <span className="font-medium text-sm">{r.def.label}</span>
                    <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                    <Badge variant="outline" className="text-[10px]">{r.source === "manual" ? "Manual" : "AI"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.def.description}</p>
                  {r.evidence && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">
                      <span className="font-medium not-italic">Evidence:</span> {r.evidence}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Select
                    value={r.status}
                    onValueChange={(v) => upsert(r.def.key, { status: v as Status, source: "manual" })}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="warn">Needs review</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                      <SelectItem value="na">N/A</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                  {r.source === "manual" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      title="Reset to AI assessment"
                      onClick={() => resetToAuto(r.def.key)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  rows={1}
                  placeholder="Add review notes…"
                  className="text-xs min-h-[36px]"
                  value={editingNotes[r.def.key] ?? ""}
                  onChange={(e) => setEditingNotes((s) => ({ ...s, [r.def.key]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => upsert(r.def.key, { notes: editingNotes[r.def.key] ?? "" })}
                >
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ContractComplianceChecklist;
