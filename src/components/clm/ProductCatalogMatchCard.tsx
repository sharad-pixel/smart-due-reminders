import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Sparkles, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = { importId: string };

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 2));
}
function score(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 88;
  let hit = 0;
  A.forEach((t) => B.has(t) && (hit += 1));
  return Math.round((hit / Math.max(A.size, B.size)) * 100);
}

export function ProductCatalogMatchCard({ importId }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["product-catalog-match", importId],
    queryFn: async () => {
      const [schedRes, catRes] = await Promise.all([
        supabase
          .from("contract_invoice_schedules")
          .select("id,description,billing_type,amount,currency,product_id,product_match_status,product_match_confidence")
          .eq("import_id", importId)
          .order("scheduled_date", { ascending: true }),
        supabase
          .from("product_catalog")
          .select("id,description,product_description,unit_cost,currency,pricing_model,billing_period,stripe_product_id,stripe_price_id,lookup_key")
          .eq("active", true)
          .limit(500),
      ]);
      return { schedules: schedRes.data || [], catalog: (catRes.data || []) as any[] };
    },
  });

  const suggestions = useMemo(() => {
    if (!data) return {} as Record<string, Array<{ product: any; score: number }>>;
    const map: Record<string, Array<{ product: any; score: number }>> = {};
    for (const s of data.schedules) {
      const label = s.description || s.billing_type || "";
      map[s.id] = data.catalog
        .map((p: any) => ({ product: p, score: Math.max(score(label, p.description || ""), score(label, p.lookup_key || "")) }))
        .filter((x) => x.score >= 40)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }
    return map;
  }, [data]);

  const assign = async (scheduleId: string, product: any, confidence: number) => {
    setSaving(scheduleId);
    try {
      const { error } = await supabase
        .from("contract_invoice_schedules")
        .update({
          product_id: product.id,
          stripe_product_id: product.stripe_product_id || null,
          stripe_price_id: product.stripe_price_id || null,
          pricing_model: product.pricing_model || null,
          billing_period: product.billing_period || null,
          product_match_confidence: confidence,
          product_match_status: "matched",
        })
        .eq("id", scheduleId);
      if (error) throw error;
      toast.success(`Linked to “${product.description}”`);
      qc.invalidateQueries({ queryKey: ["product-catalog-match", importId] });
      qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
    } catch (e: any) {
      toast.error(e.message || "Failed to link product");
    } finally {
      setSaving(null);
    }
  };

  const autoApplyAll = async () => {
    if (!data) return;
    const rows = data.schedules
      .filter((s) => !s.product_id)
      .map((s) => ({ s, best: suggestions[s.id]?.[0] }))
      .filter((x) => x.best && x.best.score >= 80);
    if (!rows.length) {
      toast.info("No high-confidence matches to auto-apply");
      return;
    }
    for (const r of rows) await assign(r.s.id, r.best!.product, r.best!.score);
    toast.success(`Auto-linked ${rows.length} line${rows.length === 1 ? "" : "s"}`);
  };

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Product catalog match</CardTitle></CardHeader>
        <CardContent><Loader2 className="h-4 w-4 animate-spin" /></CardContent>
      </Card>
    );
  }

  if (!data.schedules.length) return null;

  const unmatchedCount = data.schedules.filter((s) => !s.product_id).length;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" /> Product catalog match
          <Badge variant="outline" className="ml-2 text-[10px]">{data.schedules.length - unmatchedCount}/{data.schedules.length} linked</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={autoApplyAll} disabled={!!saving}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Auto-apply high confidence
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Suggested matches from your Product Catalog for each invoice line. Confirm to attach pricing, Stripe IDs and tax settings — used when invoices are generated and pushed to Stripe.
        </p>
        {data.schedules.map((s) => {
          const sug = suggestions[s.id] || [];
          const linked = !!s.product_id;
          return (
            <div key={s.id} className="border rounded p-2 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{s.description || s.billing_type || "Line"}</div>
                  <div className="text-xs text-muted-foreground">{s.currency || ""} {s.amount ?? ""} {s.billing_type ? `· ${s.billing_type}` : ""}</div>
                </div>
                {linked ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><Check className="h-3 w-3 mr-1" />Linked</Badge>
                ) : sug.length === 0 ? (
                  <Badge variant="secondary">No suggestions</Badge>
                ) : null}
              </div>
              {!linked && sug.length > 0 && (
                <div className="grid gap-1.5">
                  {sug.map(({ product, score: sc }) => {
                    const band = sc >= 85 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : sc >= 60 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-700 border-slate-200";
                    return (
                      <div key={product.id} className="flex items-center justify-between border rounded p-1.5">
                        <div className="text-xs">
                          <div className="font-medium">{product.description} {product.lookup_key ? <span className="text-muted-foreground">· {product.lookup_key}</span> : null}</div>
                          <div className="text-muted-foreground">{product.pricing_model || "one_off"}{product.billing_period ? ` · ${product.billing_period}` : ""} · {product.currency || "USD"} {product.unit_cost ?? "—"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase border rounded px-1.5 py-0.5 ${band}`}>{sc}%</span>
                          <Button size="sm" variant="outline" disabled={saving === s.id} onClick={() => assign(s.id, product, sc)}>
                            {saving === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Use"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ProductCatalogMatchCard;
