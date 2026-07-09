import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, Loader2, Sparkles, CheckCircle2, AlertTriangle,
  Users, CreditCard, FileCheck2, ArrowRight, ArrowLeft, X,
  Search, Plus, ExternalLink, ShieldCheck,
} from "lucide-react";
import { useStripeConnected } from "@/hooks/useStripeConnected";
import { useAccountId } from "@/hooks/useAccountId";
import { ContractSupportingDocsPanel } from "@/components/contracts/ContractSupportingDocsPanel";
import { Asc606ConsolidatedCard } from "@/components/contracts/Asc606ConsolidatedCard";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";

const CONTRACT_TYPES = [
  "MSA", "SOW", "Order Form", "Subscription", "Amendment",
  "Renewal", "Addendum", "NDA", "Other",
];
const ACCEPT = [".pdf", ".docx", ".txt"];
const MAX_BYTES = 25 * 1024 * 1024;

// Field keys required to advance past Step 2 — mirrors the platform's
// downstream expectations (billing sync, ASC 606, key-date engines).
const REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "customer_name", label: "Customer / counterparty" },
  { key: "effective_date", label: "Contract start date" },
  { key: "term_end_date", label: "Contract end date" },
  { key: "total_contract_value", label: "Total contract value (TCV)" },
  { key: "annual_contract_value", label: "Annual contract value (ARR)" },
  { key: "billing_frequency", label: "Billing frequency" },
  { key: "currency", label: "Currency" },
];

const RECOMMENDED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "renewal_notice_period", label: "Renewal notice window" },
  { key: "auto_renewal", label: "Auto-renewal flag" },
  { key: "payment_terms", label: "Payment terms" },
  { key: "termination_clause", label: "Termination clause" },
];

// OCR-alias keys the AI extractor may have emitted for TCV / ARR.
// We fall back to these when the canonical key is empty so the user still
// sees a suggested value they can accept or override.
const TCV_ALIASES = ["total_contract_value", "contract_value", "tcv", "total_value"];
const ARR_ALIASES = ["annual_contract_value", "arr", "annual_value", "annual_recurring_revenue"];

const parseMoney = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const monthsBetween = (start?: string, end?: string): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.4375)));
};

const fmtMoney = (n: number, cur = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (cur || "USD").replace(/[^A-Z]/gi, "").slice(0, 3) || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
};

type Step = 1 | 2 | 3 | 4;
const STEPS: { n: Step; label: string; icon: any }[] = [
  { n: 1, label: "Upload", icon: Upload },
  { n: 2, label: "Review data", icon: Sparkles },
  { n: 3, label: "Customer", icon: Users },
  { n: 4, label: "Compliance", icon: FileCheck2 },
];

function Rail({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 border rounded-lg p-3 bg-muted/20">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                done ? "bg-primary text-primary-foreground"
                : active ? "bg-primary/15 text-primary border border-primary"
                : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Step {s.n}</div>
              <div className={`text-sm truncate ${active ? "font-semibold" : ""}`}>{s.label}</div>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border ml-2" />}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
 * STEP 1 — Upload & Classify
 * ============================================================ */
function StepUpload({ onUploaded }: { onUploaded: (importId: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [type, setType] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const validate = (f: File): string | null => {
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPT.includes(ext)) return `${f.name}: unsupported file type`;
    if (f.size > MAX_BYTES) return `${f.name}: exceeds 25MB`;
    return null;
  };

  const submit = async () => {
    if (!file || !type) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("contract_type", type);
      const { data, error } = await supabase.functions.invoke("live-contract-upload", { body: fd });
      if (error) throw new Error(error.message);
      if (!data?.success || !data?.import?.id) throw new Error(data?.error || "Upload failed");
      toast.success("Contract uploaded — AI is now extracting data");
      onUploaded(data.import.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4 text-primary" /> Upload the contract
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Drop your MSA, SOW, order form or subscription document. AI extracts every field —
          you review and fill gaps in the next step.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Contract type <span className="text-destructive">*</span></Label>
          <Select value={type} onValueChange={setType} disabled={busy}>
            <SelectTrigger><SelectValue placeholder="Select contract type…" /></SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (!f) return;
            const err = validate(f);
            if (err) return toast.error(err);
            setFile(f);
          }}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
            drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => document.getElementById("wizard-file-input")?.click()}
        >
          <input
            id="wizard-file-input" type="file" className="hidden" accept={ACCEPT.join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const err = validate(f);
              if (err) return toast.error(err);
              setFile(f);
            }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div className="text-sm font-medium">{file.name}</div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">{drag ? "Drop to upload" : "Drag & drop or click to browse"}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT · up to 25MB</p>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!file || !type || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {busy ? "Uploading…" : "Upload & extract"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * STEP 2 — Review Extracted Data (gap prompts)
 * ============================================================ */
function StepReview({ importId, onNext }: { importId: string; onNext: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wizard-import", importId],
    queryFn: async () => {
      const [imp, fields] = await Promise.all([
        supabase.from("live_contract_imports").select("*").eq("id", importId).maybeSingle(),
        supabase.from("live_contract_extracted_fields").select("*").eq("import_id", importId),
      ]);
      return { imp: imp.data as any, fields: (fields.data || []) as any[] };
    },
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.imp?.status;
      return s && ["found", "queued", "scanning", "ocr_processing", "ai_extracting", "processing", "extracting"].includes(String(s))
        ? 3000 : false;
    },
  });

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fieldMap = useMemo(() => {
    const m = new Map<string, any>();
    (data?.fields || []).forEach((f: any) => m.set(f.field_key, f));
    // hydrate common keys from import row itself
    const imp = data?.imp || {};
    if (imp.effective_date && !m.has("effective_date"))
      m.set("effective_date", { field_key: "effective_date", field_value: imp.effective_date });
    if (imp.term_end_date && !m.has("term_end_date"))
      m.set("term_end_date", { field_key: "term_end_date", field_value: imp.term_end_date });
    return m;
  }, [data]);

  const valueOf = (key: string) => {
    if (edits[key] !== undefined) return edits[key];
    return fieldMap.get(key)?.field_value || "";
  };

  // Was the current value produced by OCR (not the wizard user)?
  const isOcrSuggested = (key: string) => {
    if (edits[key] !== undefined) return false;
    const rec = fieldMap.get(key);
    if (!rec?.field_value) return false;
    const editor = String(rec.edited_by_user || "").toLowerCase();
    return editor !== "wizard" && editor !== "user";
  };

  // Compute suggested TCV / ARR from any alias key or from the counterpart.
  const suggestedFor = (key: string): number | null => {
    const cur = valueOf(key);
    if (String(cur).trim()) return null; // only suggest when empty

    const readAlias = (aliases: string[]): number | null => {
      for (const a of aliases) {
        const raw = fieldMap.get(a)?.field_value;
        const n = parseMoney(raw);
        if (n) return n;
      }
      return null;
    };

    const months = monthsBetween(valueOf("effective_date"), valueOf("term_end_date"));
    const freq = String(valueOf("billing_frequency") || "").toLowerCase();

    if (key === "total_contract_value") {
      const direct = readAlias(TCV_ALIASES);
      if (direct) return direct;
      const arr = parseMoney(valueOf("annual_contract_value")) ?? readAlias(ARR_ALIASES);
      if (arr && months) return Math.round((arr / 12) * months);
      return null;
    }
    if (key === "annual_contract_value") {
      const direct = readAlias(ARR_ALIASES);
      if (direct) return direct;
      const tcv = parseMoney(valueOf("total_contract_value")) ?? readAlias(TCV_ALIASES);
      if (tcv && months) return Math.round(tcv / (months / 12));
      if (tcv && /annual|year/.test(freq)) return tcv;
      return null;
    }
    return null;
  };

  const applySuggestion = (key: string, value: number) => {
    setEdits((prev) => ({ ...prev, [key]: String(value) }));
  };

  const missing = REQUIRED_FIELDS.filter((f) => !String(valueOf(f.key)).trim());
  const missingRecommended = RECOMMENDED_FIELDS.filter((f) => !String(valueOf(f.key)).trim());
  const scanning = data?.imp && ["queued", "scanning", "ocr_processing", "ai_extracting", "processing", "extracting"]
    .includes(String(data.imp.status));

  const saveEdits = async () => {
    if (!Object.keys(edits).length) return;
    setSaving(true);
    try {
      // Find an extraction_id to attach new field rows to (required by schema).
      let extractionId: string | null = (data?.fields as any[])?.[0]?.extraction_id || null;
      if (!extractionId) {
        const { data: ex } = await supabase
          .from("live_contract_extractions")
          .select("id").eq("import_id", importId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        extractionId = (ex as any)?.id || null;
      }

      for (const [k, v] of Object.entries(edits)) {
        const existing = fieldMap.get(k);
        if (existing?.id) {
          await supabase.from("live_contract_extracted_fields")
            .update({ field_value: v, edited_by_user: "wizard", confidence: 1, approved: true })
            .eq("id", existing.id);
        } else if (extractionId) {
          await supabase.from("live_contract_extracted_fields").insert({
            import_id: importId,
            account_id: data!.imp.account_id,
            extraction_id: extractionId,
            field_group: "commercial",
            field_key: k,
            field_value: v,
            edited_by_user: "wizard",
            confidence: 1,
            approved: true,
          });
        }
      }
      // Mirror common commercial fields onto the import row itself.
      const impPatch: any = {};
      if (edits.effective_date) impPatch.effective_date = edits.effective_date;
      if (edits.term_end_date) impPatch.term_end_date = edits.term_end_date;
      if (Object.keys(impPatch).length) {
        await supabase.from("live_contract_imports").update(impPatch).eq("id", importId);
      }
      toast.success("Saved");
      setEdits({});
      await qc.invalidateQueries({ queryKey: ["wizard-import", importId] });
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Review extracted data
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI pulled these fields from your document. Fill any missing required data before advancing.
            Upload supporting documents to enrich the extraction.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {scanning && (
            <div className="rounded-md border border-blue-200 bg-blue-50 text-blue-900 p-3 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is still extracting fields — this typically takes 30–60 seconds. New values will appear here automatically.
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required</div>
            {REQUIRED_FIELDS.map((f) => {
              const val = valueOf(f.key);
              const hasVal = !!String(val).trim();
              const ocr = isOcrSuggested(f.key);
              const suggestion = suggestedFor(f.key);
              const cur = String(valueOf("currency") || "USD");
              return (
                <div key={f.key} className="grid sm:grid-cols-[1fr_2fr] gap-2 items-center">
                  <Label className="flex items-center gap-2">
                    {hasVal ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    {f.label}
                  </Label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={val}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={hasVal ? "" : "Add value…"}
                        className={hasVal ? "" : "border-amber-300 bg-amber-50/30"}
                      />
                      {ocr && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] gap-1">
                          <Sparkles className="h-3 w-3" /> OCR suggested
                        </Badge>
                      )}
                    </div>
                    {!hasVal && suggestion != null && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Suggested from OCR: <span className="font-medium text-foreground">{fmtMoney(suggestion, cur)}</span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => applySuggestion(f.key, suggestion)}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended (optional)</div>
            {RECOMMENDED_FIELDS.map((f) => (
              <div key={f.key} className="grid sm:grid-cols-[1fr_2fr] gap-2 items-center">
                <Label className="text-muted-foreground">{f.label}</Label>
                <Input
                  value={valueOf(f.key)}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="—"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {missing.length === 0 ? (
                <span className="text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All required fields present
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {missing.length} required field{missing.length > 1 ? "s" : ""} missing
                </span>
              )}
              {missingRecommended.length > 0 && (
                <span className="ml-3">{missingRecommended.length} recommended</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveEdits} disabled={!Object.keys(edits).length || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
              </Button>
              <Button
                onClick={async () => { if (Object.keys(edits).length) await saveEdits(); onNext(); }}
                disabled={missing.length > 0 || saving || !!scanning}
              >
                Continue to customer <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data?.imp && (
        <ContractSupportingDocsPanel importId={importId} accountId={data.imp.account_id} />
      )}
    </div>
  );
}

/* ============================================================
 * STEP 3 — Customer Match / Create / Push to Stripe
 * ============================================================ */
function StepCustomer({ importId, onNext }: { importId: string; onNext: () => void }) {
  const qc = useQueryClient();
  const { accountId } = useAccountId();
  const { connected: stripeConnected } = useStripeConnected();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCust, setNewCust] = useState({ company_name: "", email: "", phone: "" });
  const [pushingStripe, setPushingStripe] = useState(false);

  const { data: imp } = useQuery({
    queryKey: ["wizard-imp-basic", importId],
    queryFn: async () => {
      const { data } = await supabase.from("live_contract_imports")
        .select("id, account_id, debtor_id, contract_name, file_name").eq("id", importId).maybeSingle();
      return data as any;
    },
  });

  const { data: debtor } = useQuery({
    queryKey: ["wizard-debtor", imp?.debtor_id],
    enabled: !!imp?.debtor_id,
    queryFn: async () => {
      const { data } = await supabase.from("debtors")
        .select("id, company_name, name, email, phone, stripe_customer_id, billing_address_line1, billing_city, billing_country, billing_postal_code, billing_state, country")
        .eq("id", imp!.debtor_id).maybeSingle();
      return data as any;
    },
  });

  // Pre-flight duplicate check: does a Stripe customer already exist for this email?
  const { data: stripeDupe, isFetching: dupChecking } = useQuery({
    queryKey: ["wizard-stripe-dupe", debtor?.id, debtor?.email],
    enabled: !!debtor?.id && !!debtor?.email && stripeConnected && !debtor?.stripe_customer_id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("link-debtor-to-stripe", {
        body: { action: "search", debtor_id: debtor!.id, query: debtor!.email },
      });
      if (error) return null;
      const match = (data?.candidates || []).find((c: any) =>
        (c.email || "").toLowerCase() === (debtor!.email || "").toLowerCase()
      );
      return match || null;
    },
    staleTime: 30_000,
  });

  // Suggested match — grab counterparty name from extracted fields
  const { data: extractedCustomerName } = useQuery({
    queryKey: ["wizard-ext-cust", importId],
    queryFn: async () => {
      const { data } = await supabase.from("live_contract_extracted_fields")
        .select("field_value").eq("import_id", importId).eq("field_key", "customer_name").maybeSingle();
      return (data as any)?.field_value || "";
    },
  });

  const searchTerm = search.trim() || extractedCustomerName || "";
  const { data: matches = [], isFetching: matching } = useQuery({
    queryKey: ["wizard-match", searchTerm],
    enabled: !imp?.debtor_id && !!searchTerm,
    queryFn: async () => {
      const s = `%${searchTerm}%`;
      const { data } = await supabase.from("debtors")
        .select("id, company_name, name, email, stripe_customer_id")
        .or(`company_name.ilike.${s},name.ilike.${s},email.ilike.${s}`)
        .limit(10);
      return data || [];
    },
  });

  const linkDebtor = async (debtorId: string) => {
    const { error } = await supabase.from("live_contract_imports")
      .update({ debtor_id: debtorId }).eq("id", importId);
    if (error) return toast.error(error.message);
    toast.success("Customer linked");
    await qc.invalidateQueries({ queryKey: ["wizard-imp-basic", importId] });
    await qc.invalidateQueries({ queryKey: ["wizard-debtor"] });
  };

  const createAndLink = async () => {
    if (!newCust.company_name.trim() || !accountId) {
      toast.error("Company name is required");
      return;
    }
    setCreating(true);
    try {
      const referenceId = `RCPLY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const { data: d, error } = await supabase.from("debtors").insert([{
        company_name: newCust.company_name.trim(),
        name: newCust.company_name.trim(),
        reference_id: referenceId,
        type: "B2B" as const,
        email: newCust.email.trim() || null,
        phone: newCust.phone.trim() || null,
        user_id: accountId,
      }]).select("id").single();
      if (error) throw error;
      if (newCust.email.trim()) {
        await supabase.from("debtor_contacts").insert([{
          debtor_id: d.id, user_id: accountId,
          name: newCust.company_name.trim(),
          email: newCust.email.trim() || null,
          phone: newCust.phone.trim() || null,
          is_primary: true, outreach_enabled: true,
        }]);
      }
      await linkDebtor(d.id);
      setNewCust({ company_name: "", email: "", phone: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to create customer");
    } finally {
      setCreating(false);
    }
  };

  const pushToStripe = async () => {
    if (!debtor) return;
    setPushingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke("link-debtor-to-stripe", {
        body: { action: "create", debtor_id: debtor.id, force_create: false },
      });
      if (error) throw new Error(error.message || "Stripe request failed");
      if (data?.error) throw new Error(data.error);
      if (data?.duplicate && data?.candidate?.id) {
        // Auto-link the duplicate to avoid Stripe dupes
        const { data: linkData, error: linkErr } = await supabase.functions.invoke("link-debtor-to-stripe", {
          body: { action: "link", debtor_id: debtor.id, stripe_customer_id: data.candidate.id },
        });
        if (linkErr) throw new Error(linkErr.message || "Failed to link existing Stripe customer");
        if (linkData?.error) throw new Error(linkData.error);
        toast.success(`Linked to existing Stripe customer ${data.candidate.name || data.candidate.id}`);
      } else if (data?.ok) {
        toast.success("Customer created in Stripe");
      }
      await qc.invalidateQueries({ queryKey: ["wizard-debtor"] });
      await qc.invalidateQueries({ queryKey: ["wizard-stripe-dupe"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to push customer to Stripe");
    } finally {
      setPushingStripe(false);
    }
  };

  // Stripe readiness checklist — mirrors the invoice push pre-flight so users
  // can fix data gaps before hitting the API and getting a cryptic error.
  const emailValid = !!debtor?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debtor.email);
  const hasAddress = !!(debtor?.billing_address_line1 || debtor?.billing_city || debtor?.billing_country || debtor?.country);
  const stripeChecks = debtor ? [
    { ok: !!(debtor.company_name || debtor.name), label: "Customer name",
      detail: debtor.company_name || debtor.name || "Missing" },
    { ok: emailValid, label: "Email address",
      detail: debtor.email ? (emailValid ? debtor.email : `Invalid format: ${debtor.email}`) : "Missing" },
    { ok: hasAddress, optional: true, label: "Billing address",
      detail: hasAddress
        ? [debtor.billing_city, debtor.billing_state, debtor.billing_country || debtor.country].filter(Boolean).join(", ")
        : "Recommended for tax & receipts" },
    { ok: !!debtor.phone, optional: true, label: "Phone",
      detail: debtor.phone || "Optional" },
    { ok: !stripeDupe, optional: true, warn: !!stripeDupe, label: "Duplicate check",
      detail: dupChecking
        ? "Checking Stripe…"
        : stripeDupe
          ? `A Stripe customer with this email already exists (${stripeDupe.id}) — will auto-link on push`
          : "No existing Stripe customer with this email" },
  ] : [];
  const stripeRequiredOk = stripeChecks.filter((c) => !c.optional).every((c) => c.ok);


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Match to a customer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {debtor
              ? `This contract is linked to ${debtor.company_name || debtor.name}. You can change it, or continue.`
              : `We'll try to match the counterparty to an existing customer. If we can't, create a new one.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {debtor ? (
            <div className="border rounded-md p-3 flex items-center justify-between bg-primary/5">
              <div>
                <div className="text-sm font-semibold">{debtor.company_name || debtor.name}</div>
                <div className="text-xs text-muted-foreground">{debtor.email || "No email on file"}</div>
              </div>
              <div className="flex items-center gap-2">
                {debtor.stripe_customer_id && (
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> In Stripe
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => linkDebtor("")}>Change</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Search existing customers</Label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder={extractedCustomerName ? `Try "${extractedCustomerName}"…` : "Search by name or email…"}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="border rounded-md divide-y max-h-48 overflow-auto">
                  {matching && <div className="p-3 text-xs text-muted-foreground">Searching…</div>}
                  {!matching && matches.length === 0 && (
                    <div className="p-3 text-xs text-muted-foreground text-center">No matches — create below</div>
                  )}
                  {matches.map((d: any) => (
                    <button key={d.id} onClick={() => linkDebtor(d.id)}
                      className="w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{d.company_name || d.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.email || "—"}</div>
                      </div>
                      {d.stripe_customer_id && <Badge variant="outline" className="text-[10px]">Stripe</Badge>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Or create a new customer
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <Input placeholder="Company name *" value={newCust.company_name}
                    onChange={(e) => setNewCust({ ...newCust, company_name: e.target.value })} />
                  <Input placeholder="Email" type="email" value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
                  <Input placeholder="Phone" value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                </div>
                <Button onClick={createAndLink} disabled={creating || !newCust.company_name.trim()} size="sm">
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create & link
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stripe push panel — only when Stripe connected AND customer not yet in Stripe */}
      {debtor && stripeConnected && !debtor.stripe_customer_id && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" /> Push customer to Stripe
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Stripe is connected. Push this customer so future invoices from this contract sync
              to your Stripe account, just like the invoice push flow.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5 text-sm">
              {stripeChecks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.ok
                    ? <CheckCircle2 className="h-4 w-4 text-primary" />
                    : c.optional
                      ? <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                      : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <span className={c.ok ? "" : c.optional ? "text-muted-foreground" : "text-destructive"}>
                    {c.label}{c.optional ? " — optional" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button onClick={pushToStripe} disabled={!stripeRequiredOk || pushingStripe}>
                {pushingStripe ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              : <CreditCard className="h-4 w-4 mr-2" />}
                Create in Stripe
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!debtor}>
          Continue to compliance <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
 * STEP 4 — Paid Revenue Compliance Assessment (PwC)
 * ============================================================ */
function StepCompliance({ importId, onFinish }: { importId: string; onFinish: () => void }) {
  const { accountId } = useAccountId();
  const { data: imp } = useQuery({
    queryKey: ["wizard-imp-title", importId],
    queryFn: async () => {
      const { data } = await supabase.from("live_contract_imports")
        .select("contract_name, file_name").eq("id", importId).maybeSingle();
      return data as any;
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Revenue Compliance Assessment (PwC-governed)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Run the paid ASC 606 review to score contract compliance, surface commercial risks, and prepare
            the contract for finance handoff. You can skip this and run it later from the Contract Command page.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Asc606ReferenceBanner />
          {accountId && (
            <Asc606ConsolidatedCard
              contractId={importId}
              accountId={accountId}
              contractTitle={imp?.contract_name || imp?.file_name || "Contract"}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onFinish}>Skip — I'll run it later</Button>
        <Button onClick={onFinish}>
          Finish & open contract <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
 * Orchestrator
 * ============================================================ */
const WizardInner = () => {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(() => Number(sp.get("step") || 1) as Step);
  const [importId, setImportId] = useState<string>(() => sp.get("id") || "");

  useEffect(() => {
    const params = new URLSearchParams(sp);
    params.set("step", String(step));
    if (importId) params.set("id", importId); else params.delete("id");
    setSp(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, importId]);

  const finish = () => {
    if (!importId) return navigate("/contracts");
    navigate(`/contracts/live/${importId}`);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <SEO title="New Contract · Recouply" description="Guided contract ingestion, customer matching, and revenue compliance review." />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Contract</h1>
          <p className="text-sm text-muted-foreground">Upload, review, match a customer, and run compliance — one guided flow.</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/contracts"><ArrowLeft className="h-4 w-4 mr-1" /> Back to contracts</Link>
        </Button>
      </div>

      <Rail current={step} />

      {step === 1 && (
        <StepUpload onUploaded={(id) => { setImportId(id); setStep(2); }} />
      )}
      {step === 2 && importId && (
        <>
          <div className="flex justify-start">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Upload a different file
            </Button>
          </div>
          <StepReview importId={importId} onNext={() => setStep(3)} />
        </>
      )}
      {step === 3 && importId && (
        <>
          <div className="flex justify-start">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to review
            </Button>
          </div>
          <StepCustomer importId={importId} onNext={() => setStep(4)} />
        </>
      )}
      {step === 4 && importId && (
        <>
          <div className="flex justify-start">
            <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to customer
            </Button>
          </div>
          <StepCompliance importId={importId} onFinish={finish} />
        </>
      )}
    </div>
  );
};

const ContractIngestionWizard = () => (
  <Layout>
    <WizardInner />
  </Layout>
);
export default ContractIngestionWizard;
