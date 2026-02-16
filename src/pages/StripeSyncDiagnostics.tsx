import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  RefreshCw,
  Check,
  X,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Copy,
  Clock,
  Users,
  FileText,
  CreditCard,
  CheckCircle2,
  XCircle,
  Info,
  Lightbulb,
  ArrowRight,
  Zap,
} from "lucide-react";
import { format, differenceInSeconds, formatDistanceToNow } from "date-fns";
import stripeLogo from "@/assets/stripe-logo.png";
import {
  groupSyncErrors,
  getErrorTypeLabel,
  type ParsedSyncError,
} from "@/components/data-center/sync/syncErrorParser";
import type { SyncLogEntry } from "@/components/data-center/sync";

// Issue explanations with actionable guidance
const ISSUE_EXPLANATIONS: Record<
  string,
  { title: string; explanation: string; remedy: string; nextStep: string }
> = {
  unsupported_status: {
    title: "Unsupported Invoice Status",
    explanation:
      "Stripe invoices can have statuses like 'void' or 'uncollectible' that don't map directly to Recouply's status system. Voided invoices are terminal states that typically shouldn't be collected on.",
    remedy:
      "These invoices are automatically mapped to 'Canceled' in Recouply. No action is needed unless you need to track voided invoices differently.",
    nextStep: "Re-run sync to apply the corrected status mapping.",
  },
  invoice_status_error: {
    title: "Invoice Status Mapping Error",
    explanation:
      "The invoice has a status that couldn't be mapped to Recouply's supported statuses (Open, Paid, PartiallyPaid, Canceled, Disputed, Settled, InPaymentPlan).",
    remedy:
      "Check if the invoice status in Stripe is unusual. The sync will retry with corrected mappings.",
    nextStep: "Re-run sync after verifying the invoice status in Stripe.",
  },
  missing_customer: {
    title: "Missing Customer Reference",
    explanation:
      "An invoice references a customer that hasn't been synced yet. This can happen if the customer was created recently or if there was an issue with the customer sync.",
    remedy:
      "Re-running the sync will import the missing customer first, then link the invoice correctly.",
    nextStep: "Re-run sync to import the customer and retry the invoice.",
  },
  payment_error: {
    title: "Payment Sync Failed",
    explanation:
      "The payment could not be matched to an invoice. This often happens when payments are made outside the normal flow (e.g., marked as paid out-of-band, customer credits applied).",
    remedy:
      "Check if the payment in Stripe is linked to a valid invoice. Some payments (credits, adjustments) may not create standard payment objects.",
    nextStep:
      "Verify the payment in Stripe dashboard and check if it's linked to an invoice.",
  },
  missing_payments: {
    title: "Missing Payment Objects",
    explanation:
      "Some Stripe actions don't create PaymentIntent or Charge objects: marking an invoice as paid manually, applying customer credits, or out-of-band payments. The invoice shows as paid but no payment record exists.",
    remedy:
      "This is expected behavior for certain payment types. To test payment syncing, use a card payment via the hosted invoice page.",
    nextStep:
      "For testing, pay an invoice via card through Stripe's hosted invoice page.",
  },
  auth_expired: {
    title: "Authentication Expired",
    explanation:
      "Your Stripe API key may be invalid or the connection has expired.",
    remedy:
      "Re-enter your Stripe API key in Settings → Integrations to restore the connection.",
    nextStep: "Go to Settings and reconnect your Stripe account.",
  },
  timeout: {
    title: "Sync Timeout",
    explanation:
      "The sync operation took too long and was interrupted. This can happen with large datasets.",
    remedy:
      "Partial syncs will resume where they left off. Simply re-run the sync.",
    nextStep: "Re-run sync. It will resume from where it stopped.",
  },
  rate_limit: {
    title: "Rate Limit Exceeded",
    explanation:
      "Too many requests were made to Stripe's API in a short time. This is a temporary condition.",
    remedy: "Wait a few minutes and try syncing again.",
    nextStep: "Wait 2-3 minutes, then re-run sync.",
  },
};

interface StripeIntegration {
  id: string;
  user_id: string;
  is_connected: boolean;
  last_sync_at: string | null;
  sync_status: string;
  last_sync_error: string | null;
  invoices_synced_count: number;
  stripe_secret_key_encrypted: string | null;
  is_sandbox_mode?: boolean;
}


const StripeSyncDiagnostics = () => {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Stripe integration
  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ["stripe-integration-diagnostic"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: effectiveAccountId } = await supabase.rpc(
        "get_effective_account_id",
        { p_user_id: user.id }
      );
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from("stripe_integrations")
        .select("*")
        .eq("user_id", accountId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data as StripeIntegration | null;
    },
  });

  // Fetch sync logs
  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["stripe-sync-logs-diagnostic"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("stripe_sync_log")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SyncLogEntry[];
    },
    enabled: !!integration?.stripe_secret_key_encrypted,
  });

  // Fetch sync stats
  const { data: syncStats } = useQuery({
    queryKey: ["stripe-sync-stats-diagnostic"],
    queryFn: async () => {
      const [invoicesResult, customersResult, transactionsResult] =
        await Promise.all([
          supabase
            .from("invoices")
            .select("id", { count: "exact" })
            .eq("integration_source", "stripe"),
          supabase
            .from("debtors")
            .select("id", { count: "exact" })
            .not("stripe_customer_id", "is", null),
          supabase
            .from("invoice_transactions")
            .select("id", { count: "exact" })
            .contains("metadata", { source: "stripe_sync" }),
        ]);

      return {
        invoices: invoicesResult.count || 0,
        customers: customersResult.count || 0,
        transactions: transactionsResult.count || 0,
      };
    },
    enabled: !!integration?.stripe_secret_key_encrypted,
  });

  const latestSync = syncLogs?.[0] || null;
  const isSyncRunning = latestSync?.status === "running" || syncing;
  const hasStripeKey = integration?.stripe_secret_key_encrypted;
  const isTestMode = integration?.is_sandbox_mode !== false; // Default to test mode if not specified

  // Group errors from latest sync
  const groupedErrors = latestSync?.errors
    ? groupSyncErrors(latestSync.errors)
    : null;

  const handleSync = async () => {
    if (isSyncRunning) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-stripe-invoices"
      );
      if (error) throw error;

      toast.success(`Synced ${data.synced_count} invoices from Stripe!`, {
        description:
          data.transactions_logged > 0
            ? `Imported ${data.transactions_logged} transactions`
            : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["stripe-sync-logs-diagnostic"] });
      queryClient.invalidateQueries({ queryKey: ["stripe-sync-stats-diagnostic"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  const getStripeInvoiceUrl = (stripeInvoiceId: string) => {
    const baseUrl = isTestMode
      ? "https://dashboard.stripe.com/test"
      : "https://dashboard.stripe.com";
    return `${baseUrl}/invoices/${stripeInvoiceId}`;
  };

  const copyDebugInfo = () => {
    const debugInfo = {
      sync_run_id: latestSync?.id,
      timestamp: latestSync?.started_at,
      status: latestSync?.status,
      records_synced: latestSync?.records_synced,
      records_failed: latestSync?.records_failed,
      environment: isTestMode ? "test" : "live",
      errors: latestSync?.errors?.slice(0, 5),
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    toast.success("Debug info copied to clipboard");
  };

  if (integrationLoading) {
    return (
      <Layout>
        <div className="space-y-6 max-w-6xl">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (!hasStripeKey) {
    return (
      <Layout>
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Settings
              </Link>
            </Button>
          </div>
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <img
                src={stripeLogo}
                alt="Stripe"
                className="w-16 h-16 mx-auto mb-4 opacity-50"
              />
              <h2 className="text-lg font-semibold mb-2">
                Stripe Not Connected
              </h2>
              <p className="text-muted-foreground mb-4">
                Connect your Stripe account in Settings → Integrations to start
                syncing.
              </p>
              <Button asChild>
                <Link to="/settings">Go to Settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/data-center">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Data Center
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3">
              <img
                src={stripeLogo}
                alt="Stripe"
                className="w-8 h-8 rounded"
              />
              <div>
                <h1 className="text-2xl font-bold">Stripe Sync Diagnostics</h1>
                <p className="text-sm text-muted-foreground">
                  Troubleshoot sync issues and verify data integrity
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Sync Status</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    isTestMode
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-green-50 text-green-700 border-green-200"
                  }
                >
                  {isTestMode ? "Test Mode" : "Live Mode"}
                </Badge>
              </div>
              <Button
                onClick={handleSync}
                disabled={isSyncRunning}
                size="sm"
                className="gap-2"
              >
                {isSyncRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Re-run Sync
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Last Sync</p>
                <div className="flex items-center gap-2">
                  {latestSync?.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : latestSync?.status === "partial" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : latestSync?.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium capitalize">
                    {latestSync?.status || "Never"}
                  </span>
                </div>
                {latestSync?.started_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(latestSync.started_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                <p className="font-medium">
                  {latestSync?.completed_at && latestSync?.started_at
                    ? `${differenceInSeconds(
                        new Date(latestSync.completed_at),
                        new Date(latestSync.started_at)
                      )}s`
                    : latestSync?.status === "running"
                    ? "In progress..."
                    : "—"}
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">
                  Records Synced
                </p>
                <p className="font-medium text-green-700">
                  {latestSync?.records_synced || 0}
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">
                  Records Failed
                </p>
                <p
                  className={`font-medium ${
                    latestSync?.records_failed
                      ? "text-red-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {latestSync?.records_failed || 0}
                </p>
              </div>
            </div>

            {/* Total Counts */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Customers
                  </p>
                  <p className="font-semibold">{syncStats?.customers || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-purple-100">
                  <FileText className="h-4 w-4 text-purple-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Invoices
                  </p>
                  <p className="font-semibold">{syncStats?.invoices || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-green-100">
                  <CreditCard className="h-4 w-4 text-green-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Transactions
                  </p>
                  <p className="font-semibold">
                    {syncStats?.transactions || 0}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issues Panel */}
        {groupedErrors && groupedErrors.totalCount > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg text-amber-800">
                    Sync Issues ({groupedErrors.totalCount})
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyDebugInfo}
                  className="gap-2"
                >
                  <Copy className="h-3 w-3" />
                  Copy Debug Info
                </Button>
              </div>
              <CardDescription className="text-amber-700">
                {groupedErrors.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Issues Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedErrors.groups.map((group, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {getErrorTypeLabel(group.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{group.message}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {group.count}x
                      </TableCell>
                      <TableCell>
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1">
                              <ChevronDown className="h-3 w-3" />
                              Details
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="absolute z-10 mt-1 w-96 p-4 bg-background border rounded-lg shadow-lg">
                            {ISSUE_EXPLANATIONS[group.type] ? (
                              <div className="space-y-3">
                                <div>
                                  <p className="font-medium text-sm">
                                    {ISSUE_EXPLANATIONS[group.type].title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {ISSUE_EXPLANATIONS[group.type].explanation}
                                  </p>
                                </div>
                                <div className="p-2 rounded bg-blue-50 border border-blue-200">
                                  <p className="text-xs font-medium text-blue-800 flex items-center gap-1">
                                    <Lightbulb className="h-3 w-3" />
                                    Remedy
                                  </p>
                                  <p className="text-xs text-blue-700 mt-1">
                                    {ISSUE_EXPLANATIONS[group.type].remedy}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="font-medium">
                                    Recommended:{" "}
                                  </span>
                                  {ISSUE_EXPLANATIONS[group.type].nextStep}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  Raw error details:
                                </p>
                                <ul className="text-xs space-y-1">
                                  {group.details?.slice(0, 3).map((d, j) => (
                                    <li
                                      key={j}
                                      className="truncate text-muted-foreground"
                                    >
                                      {d}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Expandable Explain Sections */}
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Common Issue Explanations
                </p>
                {Object.entries(ISSUE_EXPLANATIONS)
                  .filter(([key]) =>
                    groupedErrors.groups.some((g) => g.type === key)
                  )
                  .map(([key, info]) => (
                    <Collapsible key={key}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Info className="h-3 w-3" />
                            Explain: {info.title}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="p-4 mt-2 bg-muted/30 rounded-lg border space-y-3">
                        <p className="text-sm">{info.explanation}</p>
                        <Alert className="bg-blue-50 border-blue-200">
                          <Lightbulb className="h-4 w-4 text-blue-600" />
                          <AlertTitle className="text-blue-800 text-sm">
                            How to fix
                          </AlertTitle>
                          <AlertDescription className="text-blue-700 text-sm">
                            {info.remedy}
                          </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                          <Zap className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700">
                            <strong>Next step:</strong> {info.nextStep}
                          </span>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info Block */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Debug Information</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={copyDebugInfo}
                className="gap-2"
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            </div>
            <CardDescription>
              Share this information when contacting support
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(
                {
                  sync_run_id: latestSync?.id,
                  timestamp: latestSync?.started_at,
                  status: latestSync?.status,
                  records_synced: latestSync?.records_synced,
                  records_failed: latestSync?.records_failed,
                  environment: isTestMode ? "test" : "live",
                  total_customers: syncStats?.customers,
                  total_invoices: syncStats?.invoices,
                  total_transactions: syncStats?.transactions,
                  error_types: groupedErrors?.groups.map((g) => ({
                    type: g.type,
                    count: g.count,
                  })),
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StripeSyncDiagnostics;
