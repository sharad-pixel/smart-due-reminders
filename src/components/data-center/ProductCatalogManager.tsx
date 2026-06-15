import { useState } from "react";

const STANDARD_UNITS = [
  "each", "hour", "day", "week", "month", "year",
  "license", "user", "seat", "project", "unit",
  "service", "subscription", "package", "report",
  "call", "session", "page", "box", "case",
];
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { useProductCatalog, ProductCatalogItem } from "@/hooks/useProductCatalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (item: ProductCatalogItem) => {
    setForm({
      id: item.id,
      description: item.description,
      unit_type: item.unit_type,
      unit_cost: String(item.unit_cost),
      currency: item.currency || "USD",
    });
    setOpen(true);
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

    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("product_catalog")
          .update({
            description: desc,
            unit_type: form.unit_type.trim() || "each",
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
          unit_type: form.unit_type.trim() || "each",
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
                  <Input
                    value={form.unit_type}
                    onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                    placeholder="each, hour, month"
                  />
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
