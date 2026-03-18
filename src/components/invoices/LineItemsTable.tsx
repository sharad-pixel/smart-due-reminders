import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled?: boolean;
}

export const LineItemsTable = ({ items, onChange, disabled }: LineItemsTableProps) => {
  const addLineItem = () => {
    onChange([...items, { description: "", quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate line total
    if (field === "quantity" || field === "unit_price") {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }
    
    onChange(updated);
  };

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Line Items</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addLineItem}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Line
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-right p-3 font-medium w-24">Qty</th>
              <th className="text-right p-3 font-medium w-32">Unit Price</th>
              <th className="text-right p-3 font-medium w-32">Total</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-6 text-muted-foreground">
                  No line items. Click "Add Line" to get started.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Item description"
                      disabled={disabled}
                    />
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
                  <td className="p-2 text-right font-medium">
                    ${item.line_total.toFixed(2)}
                  </td>
                  <td className="p-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLineItem(index)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-muted font-medium">
              <tr>
                <td colSpan={3} className="text-right p-3">Subtotal:</td>
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
