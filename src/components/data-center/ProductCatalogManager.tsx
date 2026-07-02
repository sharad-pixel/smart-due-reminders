import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface FormState {
  id?: string;
  description: string;
  unit_type: string;
  unit_cost: string;
  currency: string;
}

const emptyForm: FormState = {
  description: "",
  unit_type: "each",
  unit_cost: "0",
  currency: "USD",
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

  const downloadTemplate = () => {
    const csv = [
      "description,unit_type,unit_cost,currency",
      "Monthly subscription — Pro plan,month,49.00,USD",
      "Implementation services,hour,150.00,USD",
      "Annual license,year,1200.00,USD",
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
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
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
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
    return lines.slice(1).map((line) => {
      const cols = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return row;
    });
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
      const payload = rows
        .map((r) => ({
          user_id: user.id,
          description: (r.description || "").trim(),
          unit_type: (r.unit_type || "each").trim() || "each",
          unit_cost: Number(r.unit_cost || 0) || 0,
          currency: ((r.currency || "USD").trim().toUpperCase()) || "USD",
        }))
        .filter((r) => r.description.length > 0);
      if (payload.length === 0) throw new Error("No valid rows (description required)");
      const { error } = await supabase.from("product_catalog").insert(payload);
      if (error) throw error;
      toast.success(`Imported ${payload.length} product${payload.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["product-catalog"] });
    } catch (err: any) {
      toast.error(err.message || "Bulk upload failed");
    } finally {
      setUploading(false);
    }
  };


  const filtered = items.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase())
  );

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
      unit_type: item.unit_type,
      unit_cost: String(item.unit_cost),
      currency: item.currency || "USD",
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
    const unit = form.unit_type.trim() || "each";

    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("product_catalog")
          .update({
            description: desc,
            unit_type: unit,
            unit_cost: cost,
            currency: form.currency || "USD",
          })
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from("product_catalog").insert({
          user_id: user.id,
          description: desc,
          unit_type: unit,
          unit_cost: cost,
          currency: form.currency || "USD",
        });
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Monthly subscription — Pro plan"
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
              <span className="font-medium">Not using Stripe?</span> Add products one at a time with <span className="font-medium">Add Product</span>, or download the <span className="font-medium">Template</span> CSV and use <span className="font-medium">Bulk Upload</span> to load your entire catalog at once (columns: description, unit_type, unit_cost, currency). Connect Stripe later to auto-import your product catalog.
            </>
          )}
        </AlertDescription>
      </Alert>

      <Card>

        <CardContent className="pt-6 space-y-4">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

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
                    <TableHead>Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Times Used</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-muted-foreground">{item.unit_type}</TableCell>
                      <TableCell className="text-right">
                        {item.currency} {Number(item.unit_cost).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.times_used || 0}
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
                              if (confirm(`Remove "${item.description}" from catalog?`)) {
                                remove.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
