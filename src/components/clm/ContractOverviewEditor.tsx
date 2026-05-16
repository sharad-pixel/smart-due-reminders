import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, Package, Pencil, Save, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateShort, formatCurrency } from "@/lib/formatters";

interface Props {
  contract: any;
  onSaved: () => void;
}

const daysBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
};

const formatDuration = (days: number | null) => {
  if (days == null) return "—";
  if (days < 0) return "Expired";
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months`;
  return `${(days / 365).toFixed(1)} years`;
};

export const ContractOverviewEditor = ({ contract, onSaved }: Props) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [form, setForm] = useState({
    contract_name: "",
    contract_type: "",
    industry: "",
    product_description: "",
    effective_date: "",
    term_end_date: "",
    contract_value: "",
  });

  useEffect(() => {
    setForm({
      contract_name: contract.contract_name || "",
      contract_type: contract.contract_type || "",
      industry: contract.industry || "",
      product_description: contract.product_description || "",
      effective_date: contract.effective_date || "",
      term_end_date: contract.term_end_date || "",
      contract_value: contract.contract_value != null ? String(contract.contract_value) : "",
    });
  }, [contract]);

  const reclassify = async () => {
    setReclassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId: contract.id, action: "reclassify_lines" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Re-classified ${data?.updated || 0} line${(data?.updated || 0) === 1 ? "" : "s"}`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Re-classify failed");
    } finally {
      setReclassifying(false);
    }
  };

  const termDays = daysBetween(contract.effective_date, contract.term_end_date);
  const daysRemaining = contract.term_end_date
    ? daysBetween(new Date().toISOString().slice(0, 10), contract.term_end_date)
    : null;

  const remainingTone =
    daysRemaining == null
      ? "bg-muted text-muted-foreground"
      : daysRemaining < 0
      ? "bg-red-50 text-red-700 border-red-200"
      : daysRemaining <= 30
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  const save = async () => {
    setSaving(true);
    try {
      const value = form.contract_value.trim() === "" ? null : Number(form.contract_value);
      if (value != null && !Number.isFinite(value)) {
        toast.error("Contract value must be a number");
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("live_contract_imports")
        .update({
          contract_name: form.contract_name.trim() || null,
          contract_type: form.contract_type.trim() || null,
          industry: form.industry.trim() || null,
          product_description: form.product_description.trim() || null,
          effective_date: form.effective_date || null,
          term_end_date: form.term_end_date || null,
          contract_value: value,
        } as any)
        .eq("id", contract.id);
      if (error) throw error;
      toast.success("Contract overview saved");
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Contract Overview
        </CardTitle>
        {!editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reclassify} disabled={reclassifying}>
              {reclassifying ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Re-classify line items
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Term banner */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" /> Term
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">
              {contract.effective_date ? formatDateShort(contract.effective_date) : "—"}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">
              {contract.term_end_date ? formatDateShort(contract.term_end_date) : "Open ended"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {formatDuration(termDays)}
            </Badge>
            {daysRemaining != null && (
              <Badge variant="outline" className={`text-[10px] ${remainingTone}`}>
                {daysRemaining < 0
                  ? `Expired ${Math.abs(daysRemaining)}d ago`
                  : `${daysRemaining}d remaining`}
              </Badge>
            )}
          </div>
        </div>

        {!editing ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Name</dt>
              <dd className="font-medium">{contract.contract_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Type</dt>
              <dd className="font-medium capitalize">
                {contract.contract_type ? String(contract.contract_type).replace(/_/g, " ") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Industry</dt>
              <dd className="font-medium">
                {contract.industry || <span className="text-muted-foreground italic">Not set — drives line-item category fallback</span>}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                Product / Service Description
              </dt>
              <dd className="font-medium whitespace-pre-line">
                {contract.product_description || (
                  <span className="text-muted-foreground italic">Not captured yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Contract Value</dt>
              <dd className="font-medium">
                {contract.contract_value != null
                  ? formatCurrency(Number(contract.contract_value), "USD")
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ov-name">Name</Label>
              <Input
                id="ov-name"
                value={form.contract_name}
                onChange={(e) => setForm({ ...form, contract_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-type">Type</Label>
              <Input
                id="ov-type"
                placeholder="MSA, SOW, Subscription…"
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-ind">Industry</Label>
              <Input
                id="ov-ind"
                placeholder="SaaS / Software, Professional Services, Hardware…"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-eff">Effective date</Label>
              <Input
                id="ov-eff"
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-end">Term end date</Label>
              <Input
                id="ov-end"
                type="date"
                value={form.term_end_date}
                onChange={(e) => setForm({ ...form, term_end_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ov-desc">Product / Service Description</Label>
              <Textarea
                id="ov-desc"
                rows={3}
                placeholder="Describe what's being delivered under this contract"
                value={form.product_description}
                onChange={(e) => setForm({ ...form, product_description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-val">Contract value</Label>
              <Input
                id="ov-val"
                type="number"
                step="0.01"
                placeholder="Total negotiated value"
                value={form.contract_value}
                onChange={(e) => setForm({ ...form, contract_value: e.target.value })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractOverviewEditor;
