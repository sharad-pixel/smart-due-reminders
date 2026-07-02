import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { Sparkles, Plus } from "lucide-react";
import { useState } from "react";

interface Props {
  contractId: string;
  revenueItems: any[];
  currency?: string;
}

export function StripeProductMappingCard({ contractId, revenueItems, currency }: Props) {
  const [busy, setBusy] = useState(false);

  const { data: mappings, refetch } = useQuery({
    queryKey: ["contract-stripe-mappings", contractId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_stripe_product_map")
        .select("*")
        .eq("contract_id", contractId);
      return data ?? [];
    },
  });

  const mappingFor = (itemId: string) => mappings?.find((m: any) => m.contract_revenue_item_id === itemId);

  async function suggestAll() {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("stripe-catalog-match", {
        body: { contract_id: contractId },
      });
      if (error) throw error;
      toast.success("Suggested mappings updated");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch suggestions");
    } finally {
      setBusy(false);
    }
  }

  async function createStripeProduct(item: any) {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("stripe-catalog-match", {
        body: { contract_id: contractId, create_for_item_id: item.id },
      });
      if (error) throw error;
      toast.success("Stripe product created");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to create product");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Stripe Product Mapping</span>
          <Button size="sm" variant="outline" onClick={suggestAll} disabled={busy}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Auto-match
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Contract Product</TableHead>
              <TableHead className="text-xs">Amount</TableHead>
              <TableHead className="text-xs">Stripe Product</TableHead>
              <TableHead className="text-xs">Stripe Price</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revenueItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-xs text-muted-foreground text-center py-6">
                  No contract products extracted yet.
                </TableCell>
              </TableRow>
            )}
            {revenueItems.map((item: any) => {
              const m = mappingFor(item.id);
              const status = m?.mapping_status ?? "not_mapped";
              return (
                <TableRow key={item.id}>
                  <TableCell className="text-xs font-medium">{item.description || item.name || item.product_name || "—"}</TableCell>
                  <TableCell className="text-xs">{item.amount != null ? formatCurrency(Number(item.amount), currency) : "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{m?.stripe_product_id ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{m?.stripe_price_id ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={status === "mapped" ? "default" : status === "multiple_matches" ? "outline" : "secondary"} className="text-[10px]">
                      {status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => createStripeProduct(item)} disabled={busy}>
                      <Plus className="h-3 w-3 mr-1" /> Create in Stripe
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
