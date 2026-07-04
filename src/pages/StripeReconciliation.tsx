import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Link2,
  RefreshCw,
  Search,
  X,
  ExternalLink,
} from "lucide-react";
import SEO from "@/components/seo/SEO";

interface Discrepancy {
  key: string;
  type: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  invoice_id?: string | null;
  stripe_invoice_id?: string | null;
  invoice_number?: string | null;
  fixable: "push" | "pull" | "link" | null;
}

interface Summary {
  total: number;
  byType: Record<string, number>;
  stripeInvoiceCount: number;
  localInvoiceCount: number;
  linkedInvoiceCount: number;
  dismissedCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  missing_in_stripe: "Missing in Stripe",
  amount_mismatch: "Amount mismatch",
  status_mismatch: "Status mismatch",
  due_date_mismatch: "Due date mismatch",
  customer_mismatch: "Customer mismatch",
  push_failed: "Push failed",
  orphan_in_stripe: "Orphan in Stripe",
};

export default function StripeReconciliation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const runScan = async () => {
    setRunning(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-invoice-reconciliation", { body: {} });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
      setDiscrepancies((data as any).discrepancies || []);
      setSummary((data as any).summary || null);
    } catch (e: any) {
      setError(e.message || "Failed to run reconciliation");
    } finally {
      setRunning(false);
      setLoading(false);
    }
  };

  useEffect(() => { runScan(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    return discrepancies.filter((d) => {
      if (filter !== "all" && d.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.detail.toLowerCase().includes(q) ||
          (d.invoice_number || "").toLowerCase().includes(q) ||
          (d.stripe_invoice_id || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [discrepancies, filter, search]);

  const runFix = async (d: Discrepancy, action: "push" | "pull") => {
    setBusyKey(d.key);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-reconciliation-fix", {
        body: { action, invoice_id: d.invoice_id, stripe_invoice_id: d.stripe_invoice_id },
      });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
      toast.success(action === "push" ? "Pushed to Stripe" : "Pulled from Stripe");
      await runScan();
    } catch (e: any) {
      toast.error(e.message || "Fix failed");
    } finally {
      setBusyKey(null);
    }
  };

  const dismiss = async (d: Discrepancy) => {
    setBusyKey(d.key);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-reconciliation-fix", {
        body: { action: "dismiss", discrepancy_key: d.key, discrepancy_type: d.type },
      });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
      setDiscrepancies((prev) => prev.filter((x) => x.key !== d.key));
      toast.success("Discrepancy dismissed");
    } catch (e: any) {
      toast.error(e.message || "Dismiss failed");
    } finally {
      setBusyKey(null);
    }
  };

  const severityBadge = (s: string) =>
    s === "error" ? (
      <Badge variant="destructive">Error</Badge>
    ) : s === "warning" ? (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Warning</Badge>
    ) : (
      <Badge variant="secondary">Info</Badge>
    );

  const typeCounts = summary?.byType || {};

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <SEO title="Stripe reconciliation | Recouply" description="Reconcile Stripe invoices with Recouply and fix discrepancies." />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button className="hover:underline" onClick={() => navigate("/data-center")}>Data Center</button>
            <span>/</span>
            <span>Stripe reconciliation</span>
          </div>
          <h1 className="text-2xl font-semibold mt-1">Stripe ↔ Recouply reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Compares invoices in both systems and surfaces every discrepancy — mismatched totals, statuses, due dates, customers, orphans, and push failures — so sync stays honest in both directions.
          </p>
        </div>
        <Button onClick={runScan} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Scanning" : "Re-run scan"}
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stripe invoices scanned</CardDescription>
            <CardTitle className="text-2xl">{summary?.stripeInvoiceCount ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Local invoices</CardDescription>
            <CardTitle className="text-2xl">{summary?.localInvoiceCount ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Linked</CardDescription>
            <CardTitle className="text-2xl">{summary?.linkedInvoiceCount ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={summary && summary.total > 0 ? "border-amber-300" : "border-green-300"}>
          <CardHeader className="pb-2">
            <CardDescription>Active discrepancies</CardDescription>
            <CardTitle className={`text-2xl ${summary && summary.total > 0 ? "text-amber-700" : "text-green-700"}`}>
              {summary?.total ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Scan failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && !loading && summary?.total === 0 && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-700" />
          <AlertTitle className="text-green-800">In sync</AlertTitle>
          <AlertDescription className="text-green-700">
            No discrepancies detected between Stripe and Recouply. {summary.dismissedCount > 0 && `(${summary.dismissedCount} previously dismissed)`}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search invoice number, Stripe ID, or message"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types ({discrepancies.length})</SelectItem>
            {Object.entries(typeCounts).map(([t, c]) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t} ({c})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No discrepancies match the current filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell>{severityBadge(d.severity)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <Badge variant="outline">{TYPE_LABELS[d.type] || d.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{d.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.detail}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.invoice_number && <div>{d.invoice_number}</div>}
                      {d.stripe_invoice_id && (
                        <a
                          href={`https://dashboard.stripe.com/invoices/${d.stripe_invoice_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:underline inline-flex items-center gap-1"
                        >
                          {d.stripe_invoice_id.slice(0, 14)}… <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {d.invoice_id && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => navigate(`/invoices/${d.invoice_id}`)}
                          >
                            Open
                          </Button>
                        )}
                        {d.fixable === "push" && d.invoice_id && (
                          <Button
                            size="sm" variant="outline"
                            disabled={busyKey === d.key}
                            onClick={() => runFix(d, "push")}
                          >
                            <ArrowUpFromLine className="h-3.5 w-3.5 mr-1" />
                            Push to Stripe
                          </Button>
                        )}
                        {d.fixable === "pull" && d.stripe_invoice_id && (
                          <Button
                            size="sm" variant="outline"
                            disabled={busyKey === d.key}
                            onClick={() => runFix(d, "pull")}
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />
                            Pull from Stripe
                          </Button>
                        )}
                        {d.fixable === "link" && (d.invoice_id || d.stripe_invoice_id) && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => {
                              if (d.invoice_id) {
                                navigate(`/invoices/${d.invoice_id}`);
                              } else if (d.stripe_invoice_id) {
                                window.open(`https://dashboard.stripe.com/invoices/${d.stripe_invoice_id}`, "_blank");
                              }
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            Fix link
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          disabled={busyKey === d.key}
                          onClick={() => dismiss(d)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Ignore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
