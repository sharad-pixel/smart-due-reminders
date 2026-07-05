import { useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Library, Search } from "lucide-react";
import {
  useRevenueLibrary, REVENUE_TYPES, RECOGNITION_METHODS,
  type RevenueLibraryItem, type RevenueLibraryInput,
} from "@/hooks/useRevenueLibrary";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";


const EMPTY: RevenueLibraryInput = {
  name: "",
  sku: "",
  description: "",
  revenue_type: "one_time",
  performance_obligation: "",
  recognition_method: "point_in_time",
  standalone_selling_price: null,
  currency: "USD",
  default_term_months: null,
  billing_frequency: "",
  tax_category: "",
  gl_account_code: "",
  is_active: true,
};

export default function RevenueLibrary() {
  usePageTitle("Revenue Library");
  const { list, upsert, remove } = useRevenueLibrary();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RevenueLibraryItem | null>(null);
  const [form, setForm] = useState<RevenueLibraryInput>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<RevenueLibraryItem | null>(null);

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku || "").toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q),
    );
  }, [list.data, search]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setEditorOpen(true);
  };

  const openEdit = (item: RevenueLibraryItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku || "",
      description: item.description || "",
      revenue_type: item.revenue_type,
      performance_obligation: item.performance_obligation || "",
      recognition_method: item.recognition_method,
      standalone_selling_price: item.standalone_selling_price,
      currency: item.currency,
      default_term_months: item.default_term_months,
      billing_frequency: item.billing_frequency || "",
      tax_category: item.tax_category || "",
      gl_account_code: item.gl_account_code || "",
      is_active: item.is_active,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({ ...form, id: editing?.id });
    setEditorOpen(false);
  };

  return (
    <Layout>
      <SEO title="Revenue Library | Recouply" description="Build your catalog of products and services for ASC 606 contract assessments." />
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Library className="h-6 w-6 text-primary" /> Revenue Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Define your products and services with ASC 606 attributes — performance obligations,
              recognition method, and standalone selling price. Attach items to live contracts to
              auto-populate ASC 606 assessments.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> New item
          </Button>
        </div>

        <Asc606ReferenceBanner />

        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-100">
          <div className="font-medium mb-1">Why SSP and revenue attributes matter</div>
          <p className="leading-relaxed">
            When you run an ASC 606 Assessment on a contract, the backend cross-references your
            Revenue Library items against the{" "}
            <span className="font-medium">PwC — Revenue from contracts with customers</span>{" "}
            (June 2026) guide to apply Steps 1–5. Standalone Selling Price (SSP), performance
            obligations, and the recognition method are the minimum attributes required for a
            complete assessment — missing values become open issues in the report.
          </p>
        </div>


        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">Catalog</CardTitle>
                <CardDescription>{(list.data || []).length} item(s)</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU, description"
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {list.isLoading ? (
              <div className="text-sm text-muted-foreground py-6">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                {list.data?.length ? "No items match your search." : "No revenue items yet — click 'New item' to add your first product or service."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Revenue type</TableHead>
                      <TableHead>Recognition</TableHead>
                      <TableHead className="text-right">SSP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div>{item.name}</div>
                          {item.performance_obligation && (
                            <div className="text-xs text-muted-foreground">{item.performance_obligation}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.sku || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {REVENUE_TYPES.find((t) => t.value === item.revenue_type)?.label || item.revenue_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {RECOGNITION_METHODS.find((r) => r.value === item.recognition_method)?.label || item.recognition_method}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.standalone_selling_price != null
                            ? `${item.currency} ${Number(item.standalone_selling_price).toLocaleString()}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {item.is_active ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setConfirmDelete(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit revenue item" : "New revenue item"}</DialogTitle>
            <DialogDescription>
              ASC 606 attributes will be used when this item is attached to a contract assessment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input
                value={form.currency || "USD"}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <Label>Revenue type</Label>
              <Select
                value={form.revenue_type}
                onValueChange={(v) => setForm({ ...form, revenue_type: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVENUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recognition method</Label>
              <Select
                value={form.recognition_method}
                onValueChange={(v) => setForm({ ...form, recognition_method: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECOGNITION_METHODS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Performance obligation</Label>
              <Input
                value={form.performance_obligation || ""}
                onChange={(e) => setForm({ ...form, performance_obligation: e.target.value })}
                placeholder="e.g., Deliver SaaS access for 12 months"
              />
            </div>

            <div>
              <Label>Standalone selling price (SSP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.standalone_selling_price ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    standalone_selling_price: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Default term (months)</Label>
              <Input
                type="number"
                value={form.default_term_months ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    default_term_months: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label>Billing frequency</Label>
              <Input
                value={form.billing_frequency || ""}
                onChange={(e) => setForm({ ...form, billing_frequency: e.target.value })}
                placeholder="monthly, annual, milestone…"
              />
            </div>
            <div>
              <Label>Tax category</Label>
              <Input
                value={form.tax_category || ""}
                onChange={(e) => setForm({ ...form, tax_category: e.target.value })}
              />
            </div>

            <div>
              <Label>GL / Revenue account code</Label>
              <Input
                value={form.gl_account_code || ""}
                onChange={(e) => setForm({ ...form, gl_account_code: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !form.name.trim()}>
              {editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from your library. If it's attached to a contract, deletion will fail —
              detach it from those contracts first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (confirmDelete) {
                  await remove.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
