import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  DollarSign,
  FileText,
  Loader2,
  Building2
} from "lucide-react";
import { ReconciliationDetailModal } from "@/components/reconciliation/ReconciliationDetailModal";

interface Payment {
  id: string;
  debtor_id: string;
  payment_date: string;
  amount: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  invoice_number_hint: string | null;
  reconciliation_status: string;
  created_at: string;
  debtors?: {
    company_name: string;
    name: string;
  };
}

interface PaymentLink {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount_applied: number;
  match_confidence: number;
  match_method: string;
  status: string;
  invoices?: {
    invoice_number: string;
    amount: number;
    amount_outstanding: number;
    due_date: string;
  };
}

const Reconciliation = () => {
  const [activeTab, setActiveTab] = useState("needs_review");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ALL payments to calculate proper counts for all tabs
  const { data: allPayments, isLoading: allPaymentsLoading } = useQuery({
    queryKey: ["all-reconciliation-payments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          debtors (company_name, name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
  });

  // Filter payments based on active tab
  const payments = allPayments?.filter((p) => {
    if (activeTab === "needs_review") {
      return ["ai_suggested", "needs_review"].includes(p.reconciliation_status);
    } else if (activeTab === "account_matched") {
      // Payments matched to account but not yet to an invoice
      return p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status);
    } else if (activeTab === "unapplied") {
      // Payments NOT matched to any account
      return !p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status);
    } else if (activeTab === "matched") {
      return ["auto_matched", "manually_matched"].includes(p.reconciliation_status);
    }
    return true;
  });

  const paymentsLoading = allPaymentsLoading;

  // Fetch payment links for display
  const { data: paymentLinks } = useQuery({
    queryKey: ["payment-links", payments?.map(p => p.id)],
    queryFn: async () => {
      if (!payments || payments.length === 0) return {};
      
      const { data, error } = await supabase
        .from("payment_invoice_links")
        .select(`
          *,
          invoices (invoice_number, amount, amount_outstanding, due_date)
        `)
        .in("payment_id", payments.map(p => p.id));

      if (error) throw error;

      // Group by payment_id
      const grouped: Record<string, PaymentLink[]> = {};
      (data || []).forEach((link: PaymentLink) => {
        if (!grouped[link.payment_id]) grouped[link.payment_id] = [];
        grouped[link.payment_id].push(link);
      });
      return grouped;
    },
    enabled: !!payments && payments.length > 0,
  });

  // Run AI matching mutation - uses Lovable AI for intelligent matching
  const runMatchingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-match-payments");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({
        title: "AI Matching complete",
        description: `Matched ${data?.matched || 0} of ${data?.total || 0} payments (${data?.aiMatched || 0} via AI)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Matching failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept match mutation
  const acceptMatchMutation = useMutation({
    mutationFn: async ({ linkId, paymentId }: { linkId: string; paymentId: string }) => {
      // Update link status
      const { error: linkError } = await supabase
        .from("payment_invoice_links")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", linkId);
      if (linkError) throw linkError;

      // Update payment status
      const { error: paymentError } = await supabase
        .from("payments")
        .update({ reconciliation_status: "manually_matched" })
        .eq("id", paymentId);
      if (paymentError) throw paymentError;

      // Get link details to update invoice
      const { data: link } = await supabase
        .from("payment_invoice_links")
        .select("invoice_id, amount_applied")
        .eq("id", linkId)
        .single();

      if (link) {
        // Update invoice outstanding amount
        const { data: invoice } = await supabase
          .from("invoices")
          .select("amount_outstanding")
          .eq("id", link.invoice_id)
          .single();

        if (invoice) {
          const newOutstanding = Math.max(0, invoice.amount_outstanding - link.amount_applied);
          await supabase
            .from("invoices")
            .update({
              amount_outstanding: newOutstanding,
              status: newOutstanding === 0 ? "Paid" : "Open",
            })
            .eq("id", link.invoice_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Match confirmed" });
    },
  });

  // Reject match mutation
  const rejectMatchMutation = useMutation({
    mutationFn: async ({ linkId, paymentId }: { linkId: string; paymentId: string }) => {
      const { error: linkError } = await supabase
        .from("payment_invoice_links")
        .update({ status: "rejected" })
        .eq("id", linkId);
      if (linkError) throw linkError;

      const { error: paymentError } = await supabase
        .from("payments")
        .update({ reconciliation_status: "unapplied" })
        .eq("id", paymentId);
      if (paymentError) throw paymentError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Match rejected" });
    },
  });

  const filteredPayments = payments?.filter((p) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      p.debtors?.company_name?.toLowerCase().includes(search) ||
      p.debtors?.name?.toLowerCase().includes(search) ||
      p.reference?.toLowerCase().includes(search)
    );
  });

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge className="bg-green-100 text-green-800">High ({Math.round(confidence * 100)}%)</Badge>;
    } else if (confidence >= 0.6) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium ({Math.round(confidence * 100)}%)</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "recouply_id_exact":
        return <Badge className="bg-green-100 text-green-800">Recouply ID Match</Badge>;
      case "external_id_exact":
        return <Badge className="bg-blue-100 text-blue-800">External ID Match</Badge>;
      case "invoice_number_exact":
        return <Badge variant="default">Invoice # Match</Badge>;
      case "amount_exact":
        return <Badge variant="secondary">Amount Match</Badge>;
      case "exact":
        return <Badge variant="default">Exact Match</Badge>;
      case "heuristic":
        return <Badge variant="secondary">Heuristic</Badge>;
      case "ai_suggested":
        return <Badge className="bg-purple-100 text-purple-800">AI Suggested</Badge>;
      case "manual":
        return <Badge variant="outline">Manual</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Reconciliation</h1>
            <p className="text-muted-foreground">
              Review and confirm AI-suggested payment matches
            </p>
          </div>
          <Button
            onClick={() => runMatchingMutation.mutate()}
            disabled={runMatchingMutation.isPending}
          >
            {runMatchingMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run AI Matching
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Needs Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {allPayments?.filter(p => ["ai_suggested", "needs_review"].includes(p.reconciliation_status)).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Account Matched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {allPayments?.filter(p => p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status)).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Unmatched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {allPayments?.filter(p => !p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status)).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Fully Matched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {allPayments?.filter(p => ["auto_matched", "manually_matched"].includes(p.reconciliation_status)).length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="needs_review">
              AI Suggested
              {allPayments?.filter(p => ["ai_suggested", "needs_review"].includes(p.reconciliation_status)).length > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {allPayments.filter(p => ["ai_suggested", "needs_review"].includes(p.reconciliation_status)).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="account_matched">
              Account Matched
              {allPayments?.filter(p => p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status)).length > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {allPayments.filter(p => p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status)).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unapplied">
              Unmatched
              {allPayments?.filter(p => !p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status)).length > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {allPayments.filter(p => !p.debtor_id && ["pending", "unapplied"].includes(p.reconciliation_status)).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="matched">Fully Matched</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPayments?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No payments found</p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "needs_review"
                      ? "All AI suggestions have been reviewed"
                      : activeTab === "account_matched"
                      ? "No payments matched to accounts pending invoice matching"
                      : activeTab === "unapplied"
                      ? "No unmatched payments"
                      : "No matched payments yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPayments?.map((payment) => {
                  const links = paymentLinks?.[payment.id] || [];
                  const pendingLinks = links.filter(l => l.status === "pending");

                  return (
                    <Card key={payment.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">
                                {payment.debtors?.company_name || payment.debtors?.name || "Unknown Account"}
                              </CardTitle>
                              {payment.debtor_id && ["pending", "unapplied"].includes(payment.reconciliation_status) && (
                                <Badge className="bg-blue-100 text-blue-800">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  Account Linked
                                </Badge>
                              )}
                            </div>
                            <CardDescription>
                              {format(new Date(payment.payment_date), "MMM d, yyyy")}
                              {payment.reference && ` • Ref: ${payment.reference}`}
                              {payment.invoice_number_hint && ` • Invoice Hint: ${payment.invoice_number_hint}`}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {payment.currency} {payment.amount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {pendingLinks.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-sm font-medium text-muted-foreground">
                              Suggested Matches:
                            </p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Invoice</TableHead>
                                  <TableHead>Amount</TableHead>
                                  <TableHead>Applied</TableHead>
                                  <TableHead>Confidence</TableHead>
                                  <TableHead>Method</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pendingLinks.map((link) => (
                                  <TableRow key={link.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        {link.invoices?.invoice_number}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {payment.currency} {link.invoices?.amount_outstanding?.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      {payment.currency} {link.amount_applied.toLocaleString()}
                                    </TableCell>
                                    <TableCell>{getConfidenceBadge(link.match_confidence)}</TableCell>
                                    <TableCell>{getMethodBadge(link.match_method)}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            rejectMatchMutation.mutate({
                                              linkId: link.id,
                                              paymentId: payment.id,
                                            })
                                          }
                                          disabled={rejectMatchMutation.isPending}
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            acceptMatchMutation.mutate({
                                              linkId: link.id,
                                              paymentId: payment.id,
                                            })
                                          }
                                          disabled={acceptMatchMutation.isPending}
                                        >
                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                          Accept
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                              {activeTab === "matched"
                                ? "Payment has been matched to invoice"
                                : activeTab === "account_matched"
                                ? "Linked to account - needs invoice match"
                                : "No suggested matches found"}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setDetailModalOpen(true);
                              }}
                            >
                              {activeTab === "account_matched" ? "Match to Invoice" : "Manual Match"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedPayment && (
          <ReconciliationDetailModal
            open={detailModalOpen}
            onClose={() => {
              setDetailModalOpen(false);
              setSelectedPayment(null);
            }}
            payment={selectedPayment}
          />
        )}
      </div>
    </Layout>
  );
};

export default Reconciliation;
