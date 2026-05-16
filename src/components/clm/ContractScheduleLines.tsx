import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getInvoiceStatusColor, getInvoiceStatusLabel } from "@/lib/invoiceStatuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Receipt, Pencil, Package2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

interface Props {
  schedules: any[];
  defaultCurrency: string;
  onChanged: () => void;
}

const CATEGORY_OPTIONS: { value: string; label: string; revenue: "recurring" | "non_recurring" }[] = [
  { value: "subscription", label: "Subscription (SaaS)", revenue: "recurring" },
  { value: "platform", label: "Platform fee", revenue: "recurring" },
  { value: "license", label: "License", revenue: "recurring" },
  { value: "support", label: "Support", revenue: "recurring" },
  { value: "maintenance", label: "Maintenance", revenue: "recurring" },
  { value: "usage_minimum", label: "Usage minimum", revenue: "recurring" },
  { value: "professional_services", label: "Professional services", revenue: "non_recurring" },
  { value: "implementation", label: "Implementation", revenue: "non_recurring" },
  { value: "onboarding", label: "Onboarding", revenue: "non_recurring" },
  { value: "training", label: "Training", revenue: "non_recurring" },
  { value: "hardware", label: "Hardware", revenue: "non_recurring" },
  { value: "other", label: "Other", revenue: "non_recurring" },
];

const categoryLabel = (v: string | null | undefined) =>
  CATEGORY_OPTIONS.find((o) => o.value === v)?.label || null;

const revenueFor = (cat: string) =>
  CATEGORY_OPTIONS.find((o) => o.value === cat)?.revenue || "non_recurring";

export const ContractScheduleLines = ({ schedules, defaultCurrency, onChanged }: Props) => {
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [form, setForm] = useState({
    product_description: "",
    quantity: "",
    unit_price: "",
    amount: "",
    scheduled_date: "",
    expected_due_date: "",
    product_category: "",
    revenue_type: "",
  });
  const [saving, setSaving] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = schedules.map((s: any) => s.invoice_id).filter(Boolean);
    if (ids.length === 0) {
      setStatusMap({});
      return;
    }
    let cancelled = false;
    supabase
      .from("invoices")
      .select("id, status")
      .in("id", ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const m: Record<string, string> = {};
        data.forEach((r: any) => (m[r.id] = r.status));
        setStatusMap(m);
      });
    return () => {
      cancelled = true;
    };
  }, [schedules]);

  const open = (s: any) => {
    const qty = s.quantity != null ? Number(s.quantity) : null;
    const up = s.unit_price != null ? Number(s.unit_price) : null;
    setEditTarget(s);
    setForm({
      product_description: s.product_description || s.description || "",
      quantity: qty != null ? String(qty) : "",
      unit_price: up != null ? String(up) : "",
      amount: s.amount != null ? String(s.amount) : "",
      scheduled_date: s.scheduled_date || "",
      expected_due_date: s.expected_due_date || "",
      product_category: s.product_category || "",
      revenue_type: s.revenue_type || "",
    });
  };

  const recalcAmount = (qty: string, up: string) => {
    const q = Number(qty);
    const u = Number(up);
    if (Number.isFinite(q) && Number.isFinite(u) && q > 0 && u >= 0) {
      setForm((f) => ({ ...f, quantity: qty, unit_price: up, amount: (q * u).toFixed(2) }));
    } else {
      setForm((f) => ({ ...f, quantity: qty, unit_price: up }));
    }
  };

  const setCategory = (v: string) => {
    setForm((f) => ({ ...f, product_category: v, revenue_type: revenueFor(v) }));
  };

  const save = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const qty = form.quantity.trim() === "" ? null : Number(form.quantity);
      const up = form.unit_price.trim() === "" ? null : Number(form.unit_price);
      const amt = form.amount.trim() === "" ? null : Number(form.amount);
      const cat = form.product_category || null;
      const rev = cat ? (form.revenue_type || revenueFor(cat)) : null;
      const { error } = await supabase
        .from("contract_invoice_schedules")
        .update({
          product_description: form.product_description.trim() || null,
          description: form.product_description.trim() || editTarget.description || null,
          quantity: qty,
          unit_price: up,
          amount: amt,
          scheduled_date: form.scheduled_date || editTarget.scheduled_date,
          expected_due_date: form.expected_due_date || null,
          product_category: cat,
          revenue_type: rev,
          // Mark as user-edited so re-classify will not overwrite.
          category_source: cat ? "user" : null,
        } as any)
        .eq("id", editTarget.id);
      if (error) throw error;
      toast.success("Schedule line updated");
      setEditTarget(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" /> Invoice Schedule & Line Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled invoices.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium">Description</th>
                  <th className="text-left py-2 px-2 font-medium">Category</th>
                  <th className="text-right py-2 px-2 font-medium">Qty</th>
                  <th className="text-right py-2 px-2 font-medium">Unit price</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                  <th className="text-left py-2 px-2 font-medium">Scheduled</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 pl-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s: any) => {
                  const desc = s.product_description || s.description || s.billing_type || "Scheduled invoice";
                  const qty = s.quantity != null ? Number(s.quantity) : null;
                  const up = s.unit_price != null ? Number(s.unit_price) : null;
                  const cat = s.product_category as string | null;
                  const rev = s.revenue_type as string | null;
                  const isRecurring = rev === "recurring";
                  return (
                    <tr key={s.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium flex items-center gap-2">
                          <Package2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{desc}</span>
                        </div>
                        {s.invoice_id && (
                          <Link
                            to={`/invoices/${s.invoice_id}`}
                            className="text-[11px] text-primary underline hover:no-underline"
                          >
                            View invoice
                          </Link>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {cat ? (
                          <div className="space-y-0.5">
                            <Badge
                              className={`text-[10px] ${isRecurring ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"}`}
                            >
                              {categoryLabel(cat)}
                            </Badge>
                            {s.category_source === "industry_default" && (
                              <div className="text-[10px] text-muted-foreground">industry default</div>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            onClick={() => open(s)}
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pick a category
                          </Button>
                        )}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {qty != null ? qty : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {up != null ? formatCurrency(up, s.currency || defaultCurrency) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums font-medium">
                        {s.amount != null
                          ? formatCurrency(Number(s.amount), s.currency || defaultCurrency)
                          : "—"}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        <div>{formatDateShort(s.scheduled_date)}</div>
                        {s.expected_due_date && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            Due {formatDateShort(s.expected_due_date)}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {s.invoice_id && statusMap[s.invoice_id] ? (
                          <Badge className={`text-[10px] ${getInvoiceStatusColor(statusMap[s.invoice_id])}`}>
                            {getInvoiceStatusLabel(statusMap[s.invoice_id])}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2 pl-2">
                        <Button size="sm" variant="ghost" onClick={() => open(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit schedule line</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sl-desc">Product / service description</Label>
              <Input
                id="sl-desc"
                value={form.product_description}
                onChange={(e) => setForm({ ...form, product_description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-cat">Product category</Label>
                <Select value={form.product_category} onValueChange={setCategory}>
                  <SelectTrigger id="sl-cat">
                    <SelectValue placeholder="Pick a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-rev">Revenue type</Label>
                <Select
                  value={form.revenue_type}
                  onValueChange={(v) => setForm({ ...form, revenue_type: v })}
                >
                  <SelectTrigger id="sl-rev">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recurring (SaaS / subscription)</SelectItem>
                    <SelectItem value="non_recurring">Non-recurring (services / one-time)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  SaaS / Software qualifies as recurring revenue. Professional services do not.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-qty">Quantity</Label>
                <Input
                  id="sl-qty"
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => recalcAmount(e.target.value, form.unit_price)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-up">Unit price</Label>
                <Input
                  id="sl-up"
                  type="number"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => recalcAmount(form.quantity, e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-amt">Amount</Label>
                <Input
                  id="sl-amt"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-sched">Scheduled date</Label>
                <Input
                  id="sl-sched"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-due">Expected due date</Label>
                <Input
                  id="sl-due"
                  type="date"
                  value={form.expected_due_date}
                  onChange={(e) => setForm({ ...form, expected_due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ContractScheduleLines;
