import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package, Loader2, RefreshCw, Download, Upload, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useStripeConnected } from "@/hooks/useStripeConnected";
import { useProductCatalog, ProductCatalogItem } from "@/hooks/useProductCatalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STANDARD_UNITS = [
  "each", "hour", "day", "week", "month", "year",
  "license", "user", "seat", "project", "unit",
  "service", "subscription", "package", "report",
  "call", "session", "page", "box", "case",
];

// Stripe-aligned tax categories (product tax codes)
const TAX_CATEGORIES = [
  { value: "txcd_10000000", label: "General — Services" },
  { value: "txcd_10101000", label: "General — Tangible Goods" },
  { value: "txcd_10103000", label: "SaaS — Business use" },
  { value: "txcd_10103001", label: "SaaS — Personal use" },
  { value: "txcd_10202000", label: "Digital goods" },
  { value: "txcd_20030000", label: "Professional services" },
  { value: "txcd_99999999", label: "Nontaxable / Not configured" },
];

const BILLING_PERIODS: Array<{ value: string; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

interface FormState {
  id?: string;
  description: string;
  product_description: string;
  unit_type: string;
  unit_cost: string;
  currency: string;
  active: boolean;
  status_effective_date: string; // YYYY-MM-DD
  // Stripe-consistent fields
  pricing_model: "recurring" | "one_off";
  billing_period: string; // '' when one_off
  tax_behavior: "auto" | "inclusive" | "exclusive";
  tax_category: string;
  price_description: string;
  lookup_key: string;
  image_url: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm: FormState = {
  description: "",
  product_description: "",
  unit_type: "each",
  unit_cost: "0",
  currency: "USD",
  active: true,
  status_effective_date: todayIso(),
  pricing_model: "one_off",
  billing_period: "monthly",
  tax_behavior: "auto",
  tax_category: "txcd_10000000",
  price_description: "",
  lookup_key: "",
  image_url: "",
};

const isStandardUnit = (u: string) => STANDARD_UNITS.includes(u);

export const ProductCatalogManager = () => {
  const qc = useQueryClient();
  const { list, remove } = useProductCatalog();
  const items = list.data || [];
  const { connected: stripeConnected } = useStripeConnected();
  const [syncingStripe, setSyncingStripe] = useState(false);

  const syncFromStripe = async () => {
    setSyncingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-stripe-catalog", { body: {} });
      if (error) throw error;
      toast.success(`Stripe sync: ${data?.imported ?? 0} imported, ${data?.updated ?? 0} updated`);
      qc.invalidateQueries({ queryKey: ["product-catalog"] });
    } catch (e: any) {
      toast.error(e.message || "Stripe sync failed");
    } finally {
      setSyncingStripe(false);
    }
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customUnit, setCustomUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const downloadTemplate = () => {
    const csv = [
      "description,product_description,unit_type,unit_cost,currency,active",
      "Monthly subscription — Pro plan,Includes unlimited seats & support,month,49.00,USD,true",
      "Implementation services,One-time onboarding engagement,hour,150.00,USD,true",
      "Annual license,Full-year access to platform,year,1200.00,USD,true",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-catalog-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): Array<Record<string, string>> => {
    // Strip UTF-8 BOM if present
    const clean = text.replace(/^\uFEFF/, "");
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; }
        } else if (c === "," && !inQ) {
          out.push(cur); cur = "";
        } else { cur += c; }
      }
      out.push(cur);
      return out.map((v) => v.trim());
    };
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/^\ufeff/, ""));
    return lines.slice(1).map((line) => {
      const cols = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return row;
    });
  };

  const parseBool = (v: string): boolean => {
    const s = (v || "").trim().toLowerCase();
    if (["false", "0", "no", "inactive", "off"].includes(s)) return false;
    return true; // default active
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("No rows found in file");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const description = (r.description || r.name || "").trim();
        if (!description) { skipped++; continue; }
        const unit_type = ((r.unit_type || r.unit || "each").trim() || "each");
        const currency = ((r.currency || "USD").trim().toUpperCase()) || "USD";
        const unit_cost = Number(r.unit_cost || r.price || 0) || 0;
        const product_description = ((r.product_description || r.details || "").trim()).slice(0, 50);
        const active = r.active === undefined || r.active === "" ? true : parseBool(r.active);

        // Check for existing (case-insensitive on description + unit_type)
        const { data: existing } = await supabase
          .from("product_catalog")
          .select("id")
          .eq("user_id", user.id)
          .ilike("description", description)
          .eq("unit_type", unit_type)
          .maybeSingle();

        if (existing) {
          const { error: uerr } = await supabase
            .from("product_catalog")
            .update({
              unit_cost,
              currency,
              product_description: product_description || null,
              active,
              status_effective_date: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (uerr) errors.push(`Row ${i + 2}: ${uerr.message}`);
          else updated++;
        } else {
          const { error: ierr } = await supabase.from("product_catalog").insert({
            user_id: user.id,
            description,
            unit_type,
            unit_cost,
            currency,
            product_description: product_description || null,
            active,
            status_effective_date: new Date().toISOString(),
          });
          if (ierr) {
            // 23505 = unique violation; treat as skipped duplicate
            if ((ierr as any).code === "23505") skipped++;
            else errors.push(`Row ${i + 2}: ${ierr.message}`);
          } else inserted++;
        }
      }

      qc.invalidateQueries({ queryKey: ["product-catalog"] });
      const parts: string[] = [];
      if (inserted) parts.push(`${inserted} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skipped) parts.push(`${skipped} skipped`);
      toast.success(`Bulk upload complete — ${parts.join(", ") || "nothing to import"}`);
      if (errors.length) {
        toast.error(`${errors.length} row error(s): ${errors.slice(0, 2).join(" | ")}`);
        console.error("Bulk upload errors:", errors);
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk upload failed");
    } finally {
      setUploading(false);
    }
  };


  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    const matchesSearch =
      i.description.toLowerCase().includes(s) ||
      (i.product_description || "").toLowerCase().includes(s);
    const matchesStatus = showInactive || i.active !== false;
    return matchesSearch && matchesStatus;
  });

  const selectUnitValue = isStandardUnit(form.unit_type) ? form.unit_type : "custom";

  const openCreate = () => {
    setForm(emptyForm);
    setCustomUnit("");
    setOpen(true);
  };

  const openEdit = (item: ProductCatalogItem) => {
    const standard = isStandardUnit(item.unit_type);
    setForm({
      id: item.id,
      description: item.description,
      product_description: item.product_description || "",
      unit_type: item.unit_type,
      unit_cost: String(item.unit_cost),
      currency: item.currency || "USD",
      active: item.active !== false,
      status_effective_date: item.status_effective_date
        ? String(item.status_effective_date).slice(0, 10)
        : todayIso(),
      pricing_model: (item.pricing_model as "recurring" | "one_off") || "one_off",
      billing_period: item.billing_period || "monthly",
      tax_behavior: (item.tax_behavior as "auto" | "inclusive" | "exclusive") || "auto",
      tax_category: item.tax_category || "txcd_10000000",
      price_description: item.price_description || "",
      lookup_key: item.lookup_key || "",
      image_url: item.image_url || "",
    });
    setCustomUnit(standard ? "" : item.unit_type);
    setOpen(true);
  };

  const handleUnitChange = (value: string) => {
    if (value === "custom") {
      setForm((f) => ({ ...f, unit_type: customUnit || "" }));
    } else {
      setForm((f) => ({ ...f, unit_type: value }));
      setCustomUnit("");
    }
  };

  const handleCustomUnitChange = (value: string) => {
    setCustomUnit(value);
    setForm((f) => ({ ...f, unit_type: value }));
  };

  const handleSave = async () => {
    const desc = form.description.trim();
    if (!desc) {
      toast.error("Description is required");
      return;
    }
    const cost = Number(form.unit_cost);
    if (isNaN(cost) || cost < 0) {
      toast.error("Unit cost must be a valid number");
      return;
    }
    if (form.product_description.length > 50) {
      toast.error("Product description is limited to 50 characters");
      return;
    }
    const unit = form.unit_type.trim() || "each";
    const effectiveIso = form.status_effective_date
      ? new Date(form.status_effective_date).toISOString()
      : new Date().toISOString();

    // Validate lookup_key (Stripe: letters, numbers, underscore, hyphen)
    const lookupKey = form.lookup_key.trim();
    if (lookupKey && !/^[A-Za-z0-9_\-]+$/.test(lookupKey)) {
      toast.error("Lookup key must contain only letters, numbers, underscores or hyphens");
      return;
    }
    const priceDescription = form.price_description.trim();
    const imageUrl = form.image_url.trim();
    const isRecurring = form.pricing_model === "recurring";

    const payload: Record<string, any> = {
      description: desc,
      product_description: form.product_description.trim() || null,
      unit_type: unit,
      unit_cost: cost,
      currency: form.currency || "USD",
      active: form.active,
      status_effective_date: effectiveIso,
      pricing_model: form.pricing_model,
      billing_period: isRecurring ? form.billing_period || "monthly" : null,
      tax_behavior: form.tax_behavior,
      tax_category: form.tax_category || null,
      price_description: priceDescription || null,
      lookup_key: lookupKey || null,
      image_url: imageUrl || null,
    };

    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("product_catalog")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from("product_catalog").insert({
          user_id: user.id,
          ...payload,
        } as any);
        if (error) throw error;
        toast.success("Product added");
      }
      qc.invalidateQueries({ queryKey: ["product-catalog"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Product Catalog</h2>
            <p className="text-xs text-muted-foreground">
              Manage saved products and services to reuse on Recouply-created invoices
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stripeConnected && (
            <Button size="sm" variant="outline" onClick={syncFromStripe} disabled={syncingStripe}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncingStripe ? "animate-spin" : ""}`} />
              Sync from Stripe
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleBulkUpload}
              disabled={uploading}
            />
            <Button size="sm" variant="outline" asChild disabled={uploading}>
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Bulk Upload
              </span>
            </Button>
          </label>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Product" : "Add a product"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>Name / Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Monthly subscription — Pro plan"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Product description</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.product_description.length}/50
                  </span>
                </div>
                <Textarea
                  value={form.product_description}
                  onChange={(e) =>
                    setForm({ ...form, product_description: e.target.value.slice(0, 50) })
                  }
                  placeholder="Short description shown on invoices (50 chars)"
                  maxLength={50}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Unit type</Label>
                  <Select value={selectUnitValue} onValueChange={handleUnitChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectUnitValue === "custom" && (
                    <Input
                      value={customUnit}
                      onChange={(e) => handleCustomUnitChange(e.target.value)}
                      placeholder="Enter custom unit"
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Unit cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value.toUpperCase() })
                    }
                    maxLength={3}
                  />
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-2">
                <Label>Image URL <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://... — shown at checkout & on invoices"
                />
              </div>

              {/* Tax category */}
              <div className="space-y-2">
                <Label>Product tax category</Label>
                <Select
                  value={form.tax_category}
                  onValueChange={(v) => setForm({ ...form, tax_category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_CATEGORIES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Used for automatic tax calculation (Stripe Tax code).
                </p>
              </div>

              {/* Pricing model */}
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Pricing</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, pricing_model: "recurring" })}
                    className={`rounded-md border p-2 text-left text-sm ${
                      form.pricing_model === "recurring"
                        ? "border-primary ring-1 ring-primary"
                        : "border-input"
                    }`}
                  >
                    <div className="font-medium">Recurring</div>
                    <div className="text-xs text-muted-foreground">Charge an ongoing fee</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, pricing_model: "one_off" })}
                    className={`rounded-md border p-2 text-left text-sm ${
                      form.pricing_model === "one_off"
                        ? "border-primary ring-1 ring-primary"
                        : "border-input"
                    }`}
                  >
                    <div className="font-medium">One-off</div>
                    <div className="text-xs text-muted-foreground">Charge a one-time fee</div>
                  </button>
                </div>

                {form.pricing_model === "recurring" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Billing period</Label>
                    <Select
                      value={form.billing_period}
                      onValueChange={(v) => setForm({ ...form, billing_period: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_PERIODS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">Include tax in price</Label>
                  <Select
                    value={form.tax_behavior}
                    onValueChange={(v: any) => setForm({ ...form, tax_behavior: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="inclusive">Yes (inclusive)</SelectItem>
                      <SelectItem value="exclusive">No (exclusive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced */}
              <div className="rounded-md border p-3 space-y-3">
                <Label className="text-sm">Advanced</Label>
                <div className="space-y-2">
                  <Label className="text-xs">Price description</Label>
                  <Input
                    value={form.price_description}
                    onChange={(e) => setForm({ ...form, price_description: e.target.value })}
                    placeholder="Internal label — not shown to customers"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Lookup key</Label>
                  <Input
                    value={form.lookup_key}
                    onChange={(e) => setForm({ ...form, lookup_key: e.target.value })}
                    placeholder="e.g. standard_monthly"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Unique key to reference this price programmatically (letters, numbers, _ or -).
                  </p>
                </div>
              </div>


              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Status</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive products stop appearing in new invoice pickers but remain on any
                      existing invoices that already reference them.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={form.active ? "default" : "secondary"}>
                      {form.active ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={form.active}
                      onCheckedChange={(v) => setForm({ ...form, active: v })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Effective date</Label>
                  <Input
                    type="date"
                    value={form.status_effective_date}
                    onChange={(e) =>
                      setForm({ ...form, status_effective_date: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {stripeConnected ? (
            <>
              <span className="font-medium">Stripe connected:</span> Click <span className="font-medium">Sync from Stripe</span> to import your existing products and prices directly from your Stripe account — no manual entry required. New products stay in sync as you re-run.
            </>
          ) : (
            <>
              <span className="font-medium">Not using Stripe?</span> Add products one at a time with <span className="font-medium">Add Product</span>, or download the <span className="font-medium">Template</span> CSV and use <span className="font-medium">Bulk Upload</span> to load your entire catalog at once. Columns: <code>description, product_description, unit_type, unit_cost, currency, active</code>. Rows that match an existing product (case-insensitive name + unit) will be updated in place.
            </>
          )}
        </AlertDescription>
      </Alert>

      <Card>

        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Show inactive
            </label>
          </div>

          {list.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {items.length === 0
                ? "No products saved yet. Add one to reuse on invoices."
                : "No products match your search."}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Times Used</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => {
                    const isActive = item.active !== false;
                    const effective = item.status_effective_date
                      ? new Date(item.status_effective_date).toLocaleDateString()
                      : "—";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[320px]">
                          <div className="font-medium">{item.description}</div>
                          {item.product_description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {item.product_description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.unit_type}</TableCell>
                        <TableCell className="text-right">
                          {item.currency} {Number(item.unit_cost).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {effective}
                        </TableCell>
                        <TableCell>
                          {item.source === "stripe" ? (
                            <Badge variant="outline" className="text-[10px]">Stripe</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Manual</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.times_used || 0}
                          {item.last_used_at && (
                            <div className="text-[10px]">
                              last {new Date(item.last_used_at).toLocaleDateString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remove "${item.description}" from catalog?\n\nExisting invoices that reference it will keep their line items unchanged.`,
                                  )
                                ) {
                                  remove.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
