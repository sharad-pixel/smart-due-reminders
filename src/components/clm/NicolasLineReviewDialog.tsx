import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  importId: string;
  onApplied: () => void;
}

interface Addition {
  description?: string;
  amount?: number | null;
  currency?: string;
  scheduled_date?: string | null;
  product_category?: string;
  revenue_type?: string;
  rationale?: string;
}

interface Recat {
  schedule_id: string;
  current_category?: string;
  suggested_category?: string;
  current_revenue_type?: string;
  suggested_revenue_type?: string;
  rationale?: string;
}

interface ReviewResult {
  summary: string;
  suggested_additions: Addition[];
  suggested_recategorizations: Recat[];
  account_id: string;
  currency: string;
}

export function NicolasLineReviewDialog({ open, onOpenChange, importId, onApplied }: Props) {
  const qc = useQueryClient();
  const [selectedAdds, setSelectedAdds] = useState<Set<number>>(new Set());
  const [selectedRecats, setSelectedRecats] = useState<Set<number>>(new Set());

  const review = useQuery({
    queryKey: ["nicolas-line-review", importId],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("nicolas-line-review", {
        body: { importId },
      });
      if (error) throw new Error(error.message || "Review failed");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as ReviewResult;
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!review.data) return;
      const { data: imp } = await supabase
        .from("live_contract_imports")
        .select("account_id, debtor_id")
        .eq("id", importId)
        .single();
      if (!imp) throw new Error("Contract not found");

      const additions = Array.from(selectedAdds)
        .map((i) => review.data!.suggested_additions[i])
        .filter(Boolean);
      const recats = Array.from(selectedRecats)
        .map((i) => review.data!.suggested_recategorizations[i])
        .filter(Boolean);

      if (additions.length) {
        const rows = additions.map((a) => ({
          account_id: imp.account_id,
          import_id: importId,
          debtor_id: imp.debtor_id ?? null,
          scheduled_date: a.scheduled_date || new Date().toISOString().slice(0, 10),
          amount: a.amount ?? null,
          description: a.description || null,
          product_description: a.description || null,
          product_category: a.product_category || "other",
          revenue_type: a.revenue_type || "one_time",
          category_source: "ai",
          attachment_source: "nicolas_review",
          status: "forecast",
          completion_status: "pending",
          reconciliation_status: "pending",
        }));
        const { error } = await supabase.from("contract_invoice_schedules").insert(rows as any);
        if (error) throw error;
      }

      for (const r of recats) {
        const patch: any = { category_source: "ai" };
        if (r.suggested_category) patch.product_category = r.suggested_category;
        if (r.suggested_revenue_type) patch.revenue_type = r.suggested_revenue_type;
        const { error } = await supabase
          .from("contract_invoice_schedules")
          .update(patch)
          .eq("id", r.schedule_id);
        if (error) throw error;
      }

      await supabase
        .from("live_contract_imports")
        .update({ nicolas_line_review_ack_at: new Date().toISOString() } as any)
        .eq("id", importId);
    },
    onSuccess: () => {
      toast.success("Applied Nicolas's suggestions");
      qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      onApplied();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to apply"),
  });

  const dismiss = async () => {
    await supabase
      .from("live_contract_imports")
      .update({ nicolas_line_review_ack_at: new Date().toISOString() } as any)
      .eq("id", importId);
    onApplied();
    onOpenChange(false);
  };

  const r = review.data;
  const additions = r?.suggested_additions ?? [];
  const recats = r?.suggested_recategorizations ?? [];
  const totalSelected = selectedAdds.size + selectedRecats.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Nicolas — Order Form Line Review
          </DialogTitle>
          <DialogDescription>
            Nicolas re-reads the contract and flags Order Form lines that may have been missed or miscategorized — especially Fixed Fee Professional Services and one-time implementation charges.
          </DialogDescription>
        </DialogHeader>

        {review.isLoading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Nicolas is reviewing the contract…
          </div>
        )}

        {review.isError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(review.error as Error)?.message || "Review failed"}
          </div>
        )}

        {r && (
          <div className="space-y-5">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="font-medium mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Summary
              </div>
              <div className="text-muted-foreground">{r.summary || "No summary returned."}</div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Suggested additions <Badge variant="secondary">{additions.length}</Badge>
              </div>
              {additions.length === 0 ? (
                <div className="text-sm text-muted-foreground flex items-center gap-1.5 px-2 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No missing lines detected.
                </div>
              ) : (
                <div className="space-y-2">
                  {additions.map((a, i) => {
                    const checked = selectedAdds.has(i);
                    return (
                      <label
                        key={i}
                        className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedAdds);
                            if (v) next.add(i);
                            else next.delete(i);
                            setSelectedAdds(next);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{a.description || "(no description)"}</span>
                            {a.product_category && (
                              <Badge variant="outline" className="text-xs">{a.product_category}</Badge>
                            )}
                            {a.revenue_type && (
                              <Badge variant="secondary" className="text-xs">{a.revenue_type}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {a.amount != null
                              ? formatCurrency(Number(a.amount), a.currency || r.currency)
                              : "Amount: —"}
                            {a.scheduled_date ? ` · ${a.scheduled_date}` : ""}
                          </div>
                          {a.rationale && (
                            <div className="text-xs text-muted-foreground italic mt-1">"{a.rationale}"</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Recategorize existing <Badge variant="secondary">{recats.length}</Badge>
              </div>
              {recats.length === 0 ? (
                <div className="text-sm text-muted-foreground flex items-center gap-1.5 px-2 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No miscategorized lines detected.
                </div>
              ) : (
                <div className="space-y-2">
                  {recats.map((c, i) => {
                    const checked = selectedRecats.has(i);
                    return (
                      <label
                        key={i}
                        className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedRecats);
                            if (v) next.add(i);
                            else next.delete(i);
                            setSelectedRecats(next);
                          }}
                        />
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs line-through opacity-60">
                              {c.current_category || c.current_revenue_type || "—"}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="secondary" className="text-xs">
                              {c.suggested_category || c.suggested_revenue_type || "—"}
                            </Badge>
                          </div>
                          {c.rationale && (
                            <div className="text-xs text-muted-foreground italic mt-1">"{c.rationale}"</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={dismiss} disabled={apply.isPending}>
            Dismiss
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={!r || totalSelected === 0 || apply.isPending}
          >
            {apply.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Applying…</>
            ) : (
              `Apply ${totalSelected || ""} selected`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
