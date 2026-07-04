import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Bookmark, BookmarkCheck } from "lucide-react";
import { ProductCatalogPicker } from "./ProductCatalogPicker";
import { useProductCatalog } from "@/hooks/useProductCatalog";
import { cn } from "@/lib/utils";

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  line_type: "item" | "tax";
  unit_type?: string;
  // Extended product catalog fields
  product_id?: string | null;
  product_description?: string | null;
  pricing_model?: "recurring" | "one_off" | null;
  billing_period?: string | null;
  tax_behavior?: "auto" | "inclusive" | "exclusive" | null;
  tax_category?: string | null;
  lookup_key?: string | null;
  stripe_price_id?: string | null;
  stripe_product_id?: string | null;
}

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled?: boolean;
}

const STANDARD_UNITS = [
  "each", "hour", "day", "week", "month", "year",
  "license", "user", "seat", "project", "unit",
  "service", "subscription", "package", "report",
  "call", "session", "page", "box", "case",
];

const isStandardUnit = (u: string) => STANDARD_UNITS.includes(u);

export const LineItemsTable = ({ items, onChange, disabled }: LineItemsTableProps) => {
  const { saveProduct } = useProductCatalog();
  const [savedRows, setSavedRows] = useState<Record<number, boolean>>({});

  const addLineItem = () => {
    onChange([
      ...items,
      { description: "", quantity: 1, unit_price: 0, line_total: 0, line_type: "item", unit_type: "each" },
    ]);
  };

  const addFromCatalog = (item: any) => {
    onChange([
      ...items,
      {
        description: item.description,
        quantity: 1,
        unit_price: Number(item.unit_cost),
        line_total: Number(item.unit_cost),
        line_type: "item",
        unit_type: item.unit_type,
        product_id: item.id ?? null,
        product_description: item.product_description ?? null,
        pricing_model: item.pricing_model ?? null,
        billing_period: item.billing_period ?? null,
        tax_behavior: item.tax_behavior ?? null,
        tax_category: item.tax_category ?? null,
        lookup_key: item.lookup_key ?? null,
        stripe_price_id: item.stripe_price_id ?? null,
      },
    ]);
    // mark this new row as already-saved
    setSavedRows((s) => ({ ...s, [items.length]: true }));
  };

  const removeLineItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setSavedRows((s) => {
      const next: Record<number, boolean> = {};
      Object.entries(s).forEach(([k, v]) => {
        const i = Number(k);
        if (i < index) next[i] = v;
        else if (i > index) next[i - 1] = v;
      });
      return next;
    });
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value } as LineItem;

    if (field === "quantity" || field === "unit_price") {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }

    onChange(updated);

    // Editing description / unit_type / unit_price after saving means it's a new variant
    if (field === "description" || field === "unit_type" || field === "unit_price") {
      setSavedRows((s) => ({ ...s, [index]: false }));
    }
  };

  const handleSaveToCatalog = async (index: number) => {
    const item = items[index];
    if (!item.description.trim() || !item.unit_price) return;
    try {
      await saveProduct.mutateAsync({
        description: item.description,
        unit_type: item.unit_type || "each",
        unit_cost: item.unit_price,
      });
      setSavedRows((s) => ({ ...s, [index]: true }));
    } catch {
      // toast already handled
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Line Items</Label>
        <div className="flex items-center gap-2">
          <ProductCatalogPicker onSelect={addFromCatalog} disabled={disabled} />
          <Button type="button" size="sm" variant="outline" onClick={addLineItem} disabled={disabled}>
            <Plus className="h-4 w-4 mr-1" />
            Add Line
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium w-24">Type</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium w-28">Unit</th>
              <th className="text-right p-3 font-medium w-20">Qty</th>
              <th className="text-right p-3 font-medium w-28">Unit Cost</th>
              <th className="text-right p-3 font-medium w-28">Total</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-6 text-muted-foreground">
                  No line items. Click "Add Line" or pick from your saved catalog.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const isItem = item.line_type === "item";
                const canSave = isItem && item.description.trim().length > 0 && item.unit_price > 0;
                const saved = !!savedRows[index];
                return (
                  <tr key={index} className="border-t">
                    <td className="p-2">
                      <Select
                        value={item.line_type}
                        onValueChange={(val) => updateLineItem(index, "line_type", val)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="item">Item</SelectItem>
                          <SelectItem value="tax">Tax</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder={isItem ? "Item or service" : "Tax description"}
                        disabled={disabled}
                      />
                      {isItem && item.product_description && (
                        <div className="text-xs text-muted-foreground mt-1 truncate" title={item.product_description}>
                          {item.product_description}
                        </div>
                      )}
                      {isItem && (item.pricing_model || item.lookup_key || item.stripe_price_id) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.pricing_model === "recurring" && (
                            <span className="inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-medium">
                              Recurring{item.billing_period ? ` · ${item.billing_period}` : ""}
                            </span>
                          )}
                          {item.pricing_model === "one_off" && (
                            <span className="inline-flex items-center rounded-md bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium">
                              One-off
                            </span>
                          )}
                          {item.tax_behavior && item.tax_behavior !== "auto" && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium">
                              Tax {item.tax_behavior}
                            </span>
                          )}
                          {item.stripe_price_id && (
                            <span className="inline-flex items-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-medium">
                              Stripe linked
                            </span>
                          )}
                          {item.lookup_key && (
                            <span className="inline-flex items-center rounded-md bg-muted text-muted-foreground border px-1.5 py-0.5 text-[10px] font-mono">
                              {item.lookup_key}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {isItem ? (
                        <div className="space-y-1">
                          <Select
                            value={isStandardUnit(item.unit_type || "") ? (item.unit_type || "each") : "custom"}
                            onValueChange={(val) => {
                              if (val === "custom") {
                                updateLineItem(index, "unit_type", "");
                              } else {
                                updateLineItem(index, "unit_type", val);
                              }
                            }}
                            disabled={disabled}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {STANDARD_UNITS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                              <SelectItem value="custom">Custom…</SelectItem>
                            </SelectContent>
                          </Select>
                          {!isStandardUnit(item.unit_type || "") && (
                            <Input
                              value={item.unit_type || ""}
                              onChange={(e) => updateLineItem(index, "unit_type", e.target.value)}
                              placeholder="Enter custom unit"
                              disabled={disabled}
                              className="text-xs"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        disabled={disabled}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        disabled={disabled}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2 text-right font-medium">${item.line_total.toFixed(2)}</td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-1">
                        {isItem && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveToCatalog(index)}
                            disabled={disabled || !canSave || saved || saveProduct.isPending}
                            title={saved ? "Saved to catalog" : "Save to catalog"}
                          >
                            {saved ? (
                              <BookmarkCheck className={cn("h-4 w-4 text-emerald-600")} />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLineItem(index)}
                          disabled={disabled}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-muted font-medium">
              <tr>
                <td colSpan={5} className="text-right p-3">
                  Subtotal:
                </td>
                <td className="text-right p-3">${subtotal.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
