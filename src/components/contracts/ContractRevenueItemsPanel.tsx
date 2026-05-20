import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Library, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { REVENUE_TYPES, RECOGNITION_METHODS, type RevenueLibraryItem } from "@/hooks/useRevenueLibrary";

interface Props {
  importId: string;
  accountId: string;
}

interface AttachedRow {
  id: string;
  account_id: string;
  import_id: string;
  library_item_id: string;
  quantity: number;
  allocated_price: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  library_item: RevenueLibraryItem | null;
}

export default function ContractRevenueItemsPanel({ importId, accountId }: Props) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [price, setPrice] = useState<string>("");

  const attached = useQuery({
    queryKey: ["contract-revenue-items", importId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_revenue_items")
        .select("*, library_item:revenue_library_items(*)")
        .eq("import_id", importId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AttachedRow[];
    },
  });

  const library = useQuery({
    queryKey: ["revenue-library", accountId, "active-only"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_library_items")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as RevenueLibraryItem[];
    },
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Pick an item");
      const { error } = await supabase.from("contract_revenue_items").insert({
        account_id: accountId,
        import_id: importId,
        library_item_id: selectedId,
        quantity: Number(quantity) || 1,
        allocated_price: price === "" ? null : Number(price),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-revenue-items", importId] });
      toast.success("Attached to contract");
      setPickerOpen(false);
      setSelectedId("");
      setQuantity("1");
      setPrice("");
    },
    onError: (e: any) => toast.error(e.message || "Failed to attach"),
  });

  const detach = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_revenue_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-revenue-items", importId] });
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(e.message || "Failed to remove"),
  });

  const total = useMemo(
    () =>
      (attached.data || []).reduce(
        (s, r) =>
          s + Number(r.allocated_price ?? r.library_item?.standalone_selling_price ?? 0) * Number(r.quantity || 1),
        0,
      ),
    [attached.data],
  );

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" /> Revenue items (ASC 606)
          </CardTitle>
          <CardDescription>
            Performance obligations attached from your{" "}
            <Link to="/revenue-library" className="text-primary underline">Revenue Library</Link>.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Attach item
        </Button>
      </CardHeader>
      <CardContent>
        {attached.isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Loading…</div>
        ) : (attached.data || []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No revenue items attached yet. Attach products or services to drive the ASC 606 assessment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recognition</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attached.data || []).map((r) => {
                  const li = r.library_item;
                  const unit = Number(r.allocated_price ?? li?.standalone_selling_price ?? 0);
                  const line = unit * Number(r.quantity || 1);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{li?.name || "—"}</div>
                        {li?.performance_obligation && (
                          <div className="text-xs text-muted-foreground">{li.performance_obligation}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {REVENUE_TYPES.find((t) => t.value === li?.revenue_type)?.label || li?.revenue_type || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {RECOGNITION_METHODS.find((m) => m.value === li?.recognition_method)?.label || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {li?.currency || "USD"} {line.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => detach.mutate(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">Total contract value</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach revenue item</DialogTitle>
            <DialogDescription>Pick a product or service from your Revenue Library.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Library item</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Select item…" /></SelectTrigger>
                <SelectContent>
                  {(library.data || []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}{i.sku ? ` · ${i.sku}` : ""}
                    </SelectItem>
                  ))}
                  {library.data && library.data.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No active items.{" "}
                      <Link to="/revenue-library" className="text-primary underline">Create one</Link>.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <Label>Allocated price (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Defaults to SSP"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={() => attach.mutate()} disabled={!selectedId || attach.isPending}>Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
