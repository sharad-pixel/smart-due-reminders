import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Pencil, Save, X, UserCheck, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { AMOUNT_KEYS, toNumber } from "@/lib/clm/financialMetrics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FieldRow {
  id: string;
  field_group: string;
  field_key: string;
  field_value: string | null;
  field_value_json: any;
  edited_by_user: string | null;
  approved: boolean;
  confidence: number | null;
  extraction_id?: string | null;
}

interface Props {
  importId: string;
  accountId: string;
  extractionId?: string | null;
  financialFields: FieldRow[];
  currency: string;
  onChanged: () => void;
}

const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Common financial keys that may be missing and worth adding so totals reconcile.
const ADDABLE_KEYS: { key: string; label: string }[] = [
  { key: "total_contract_value", label: "Total Contract Value (TCV)" },
  { key: "annual_contract_value", label: "Annual Contract Value (ACV)" },
  { key: "annual_recurring_revenue", label: "Annual Recurring Revenue (ARR)" },
  { key: "monthly_recurring_revenue", label: "Monthly Recurring Revenue (MRR)" },
  { key: "subscription_fees", label: "Subscription Fees" },
  { key: "platform_fees", label: "Platform Fees" },
  { key: "one_time_fees", label: "One-Time Fees" },
  { key: "professional_services_fees", label: "Professional Services Fees" },
  { key: "currency", label: "Currency" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "billing_frequency", label: "Billing Frequency" },
];

export const EditableFinancialTermsCard = ({
  importId,
  accountId,
  extractionId,
  financialFields,
  currency,
  onChanged,
}: Props) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [addKey, setAddKey] = useState("");
  const [addValue, setAddValue] = useState("");
  const [adding, setAdding] = useState(false);

  const existingKeys = new Set(financialFields.map((f) => f.field_key));
  const availableToAdd = ADDABLE_KEYS.filter((o) => !existingKeys.has(o.key));

  const startEdit = (r: FieldRow) => {
    setEditing((s) => ({
      ...s,
      [r.id]: r.field_value ?? (r.field_value_json ? JSON.stringify(r.field_value_json) : ""),
    }));
  };
  const cancelEdit = (id: string) =>
    setEditing((s) => {
      const { [id]: _, ...rest } = s;
      return rest;
    });

  const recompute = async () => {
    setRecomputing(true);
    try {
      await supabase.functions.invoke("contract-metrics-recompute", {
        body: { import_id: importId },
      });
      await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      onChanged();
    } catch (e) {
      console.error("Recompute failed", e);
    } finally {
      setRecomputing(false);
    }
  };

  const save = async (r: FieldRow) => {
    const next = (editing[r.id] ?? "").trim();
    setSavingId(r.id);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id || null;
      const { error } = await supabase
        .from("live_contract_extracted_fields")
        .update({
          field_value: next || null,
          field_value_json: null,
          edited_by_user: uid,
          approved: true,
        })
        .eq("id", r.id);
      if (error) throw error;
      toast.success(`${humanize(r.field_key)} updated`);
      cancelEdit(r.id);
      await recompute();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const addField = async () => {
    if (!addKey || !extractionId) return;
    setAdding(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id || null;
      const { error } = await supabase.from("live_contract_extracted_fields").insert({
        account_id: accountId,
        import_id: importId,
        extraction_id: extractionId,
        field_group: "commercial",
        field_key: addKey,
        field_value: addValue.trim() || null,
        edited_by_user: uid,
        approved: true,
      } as any);
      if (error) throw error;
      toast.success("Field added");
      setAddKey("");
      setAddValue("");
      await recompute();
    } catch (e: any) {
      toast.error(e?.message || "Add failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" /> Financial Terms
          <Badge variant="outline" className="text-[10px] ml-1">Editable</Badge>
        </CardTitle>
        {recomputing && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Recalculating…
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Adjust extracted values so they tie out to the executed document. Edits are preserved
          on re-scan and automatically refresh MRR/ARR/ACV/TCV.
        </p>
        {financialFields.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No financial terms extracted. Add one below.
          </p>
        ) : (
          <div className="divide-y">
            {financialFields.map((f) => {
              const isEditing = f.id in editing;
              const isAmount = AMOUNT_KEYS.has(f.field_key);
              const numeric = isAmount ? toNumber(f.field_value) : 0;
              const display =
                isAmount && numeric > 0
                  ? formatCurrency(numeric, currency)
                  : f.field_value || "—";
              return (
                <div key={f.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {humanize(f.field_key)}
                      </span>
                      {f.edited_by_user && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          <UserCheck className="h-2.5 w-2.5 mr-0.5" /> Edited
                        </Badge>
                      )}
                      {f.confidence != null && !f.edited_by_user && (
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(Number(f.confidence))}% conf.
                        </Badge>
                      )}
                    </div>
                    {!isEditing ? (
                      <div className="text-sm font-medium mt-0.5 break-words">{display}</div>
                    ) : (
                      <Input
                        autoFocus
                        className="h-8 mt-1"
                        value={editing[f.id]}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, [f.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(f);
                          if (e.key === "Escape") cancelEdit(f.id);
                        }}
                        placeholder={isAmount ? "e.g. 120000" : "value"}
                      />
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isEditing ? (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(f)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => cancelEdit(f.id)}
                          disabled={savingId === f.id}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => save(f)}
                          disabled={savingId === f.id}
                        >
                          {savingId === f.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {extractionId && availableToAdd.length > 0 && (
          <div className="rounded-md border border-dashed p-3 space-y-2 mt-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add a missing financial term
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={addKey} onValueChange={setAddKey}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Choose term" />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Value (e.g. 120000)"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addField();
                }}
              />
              <Button size="sm" onClick={addField} disabled={!addKey || adding}>
                {adding ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                Add
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EditableFinancialTermsCard;
