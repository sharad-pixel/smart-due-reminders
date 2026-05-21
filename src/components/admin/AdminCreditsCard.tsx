import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  accountId: string;
}

interface LedgerRow {
  id: string;
  delta: number;
  kind: string;
  service: string;
  note: string | null;
  created_at: string;
}

export default function AdminCreditsCard({ accountId }: Props) {
  const [wallet, setWallet] = useState<{ balance_credits: number; pending_overage_credits: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"adjustment" | "refund">("adjustment");
  const [service, setService] = useState("asc606");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [{ data: w }, { data: l }] = await Promise.all([
      supabase
        .from("asc606_credit_wallets")
        .select("balance_credits, pending_overage_credits")
        .eq("account_id", accountId)
        .maybeSingle(),
      supabase
        .from("asc606_credit_ledger")
        .select("id, delta, kind, service, note, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setWallet(w as any);
    setLedger((l as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (accountId) refresh();
  }, [accountId]);

  const handleIssue = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      toast.error("Enter a non-zero credit amount (negative to deduct).");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-issue-credits", {
      body: { accountId, amount: amt, note, kind, service },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to issue credits");
      return;
    }
    toast.success(`${amt > 0 ? "Issued" : "Deducted"} ${Math.abs(amt)} credit${Math.abs(amt) === 1 ? "" : "s"}`);
    setAmount("");
    setNote("");
    await refresh();
  };

  const balance = Number(wallet?.balance_credits ?? 0);
  const overage = Number(wallet?.pending_overage_credits ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Platform Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Available balance</div>
            <div className="text-2xl font-semibold">{loading ? "—" : balance.toFixed(2)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Pending overage</div>
            <div className={`text-2xl font-semibold ${overage > 0 ? "text-amber-600" : ""}`}>
              {loading ? "—" : overage.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-medium">Issue or deduct credits</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount (negative to deduct)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50 or -10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kind</Label>
              <Select value={kind} onValueChange={(v: any) => setKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc606">ASC 606</SelectItem>
                <SelectItem value="smart_ingestion">Smart Ingestion</SelectItem>
                <SelectItem value="compliance_doc_indexing">Compliance Doc Indexing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note (visible in ledger)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for issuing/deducting credits"
              rows={2}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Positive amounts retire pending overage first, then top up the balance. Negative amounts reduce the balance.
          </div>
          <Button onClick={handleIssue} disabled={submitting || !amount} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Apply
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Recent ledger</div>
          {ledger.length === 0 ? (
            <div className="text-xs text-muted-foreground">No ledger entries.</div>
          ) : (
            <div className="space-y-1 text-xs">
              {ledger.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-2 border-b pb-1">
                  <div className="min-w-0">
                    <div className="font-medium">
                      <span className={Number(row.delta) >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {Number(row.delta) >= 0 ? "+" : ""}{Number(row.delta).toFixed(2)}
                      </span>
                      {" "}· {row.kind} · {row.service}
                    </div>
                    {row.note && <div className="text-muted-foreground truncate">{row.note}</div>}
                  </div>
                  <div className="text-muted-foreground shrink-0">
                    {new Date(row.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
