import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, CheckCircle2, Loader2, ExternalLink, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface UnbilledRow {
  id: string;
  page_count: number;
  total_cents: number;
  created_at: string;
  file_name: string | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  page_count: number;
  status: string;
  hosted_invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
  error: string | null;
}

function useUnbilledUsage() {
  return useQuery({
    queryKey: ["ingestion-unbilled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocr_usage_events")
        .select("id, page_count, total_cents, created_at, file_name")
        .eq("stripe_reported", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as UnbilledRow[];
    },
  });
}

function usePaymentHistory() {
  return useQuery({
    queryKey: ["ingestion-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocr_invoice_payments")
        .select("id, amount, page_count, status, hosted_invoice_url, paid_at, created_at, error")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as PaymentRow[];
    },
  });
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtAmt = (amt: number) => `$${Number(amt).toFixed(2)}`;

export default function IngestionBalanceCard() {
  const qc = useQueryClient();
  const { data: unbilled = [], isLoading } = useUnbilledUsage();
  const { data: payments = [] } = usePaymentHistory();
  const [historyOpen, setHistoryOpen] = useState(false);

  const totals = useMemo(() => {
    const cents = unbilled.reduce((s, r) => s + (r.total_cents || 0), 0);
    const pages = unbilled.reduce((s, r) => s + (r.page_count || 0), 0);
    const lastScan = unbilled[0]?.created_at;
    return { cents, pages, scans: unbilled.length, lastScan };
  }, [unbilled]);

  const pay = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-ingestion-pay-balance", { body: {} });
      if (error) {
        let msg = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
        throw new Error(msg || "Payment failed");
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      if (d?.status === "paid") toast.success(`Paid ${fmtAmt(d.amount)}`);
      else if (d?.requires_action && d?.hosted_invoice_url) {
        toast.info("Complete payment in the new tab");
        window.open(d.hosted_invoice_url, "_blank");
      } else if (d?.checkout_url) {
        toast.info("Add a payment method to continue");
        window.open(d.checkout_url, "_blank");
      }
      qc.invalidateQueries({ queryKey: ["ingestion-unbilled"] });
      qc.invalidateQueries({ queryKey: ["ingestion-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dueAmount = totals.cents;
  const isClear = dueAmount === 0;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-0">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg ${isClear ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
                {isClear ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  AI Smart Ingestion balance
                </div>
                <div className="text-3xl font-semibold mt-0.5">
                  {isLoading ? "—" : isClear ? "All caught up" : fmt(dueAmount)}
                </div>
                {!isClear && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {totals.pages} page{totals.pages === 1 ? "" : "s"} · {totals.scans} scan{totals.scans === 1 ? "" : "s"}
                    {totals.lastScan && ` · last scan ${new Date(totals.lastScan).toLocaleDateString()}`}
                  </div>
                )}
                {isClear && (
                  <div className="text-sm text-muted-foreground mt-1">
                    No outstanding ingestion charges. New scans will appear here.
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">Billing history</Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md">
                  <SheetHeader><SheetTitle>Ingestion payment history</SheetTitle></SheetHeader>
                  <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-3">
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No payments yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {payments.map((p) => (
                          <div key={p.id} className="flex items-start justify-between border rounded-md p-3 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium">{fmtAmt(p.amount)} · {p.page_count} pages</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(p.paid_at || p.created_at).toLocaleString()}
                              </div>
                              {p.error && (
                                <div className="text-xs text-destructive mt-1 flex items-start gap-1">
                                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{p.error}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                                {p.status}
                              </Badge>
                              {p.hosted_invoice_url && (
                                <a href={p.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-primary">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              <Button
                onClick={() => pay.mutate()}
                disabled={isClear || pay.isPending || isLoading}
                size="lg"
                className="gap-2"
              >
                {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {isClear ? "Nothing due" : `Pay ${fmt(dueAmount)} now`}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
