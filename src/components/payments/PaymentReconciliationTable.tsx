import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, LinkIcon, Unlink, Pencil, Search, ChevronLeft, ChevronRight,
  CheckCircle, AlertTriangle, HelpCircle, Filter
} from "lucide-react";
import { format } from "date-fns";
import { 
  usePaymentReconciliation, 
  useUnmatchPayment, 
  useRematchPayment, 
  useUpdatePayment,
  PaymentWithLinks,
  PaymentReconciliationFilters 
} from "@/hooks/usePaymentReconciliation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

const getCurrencyLabel = (currency: string) => {
  const labels: Record<string, string> = { USD: "USD – US Dollar", EUR: "EUR – Euro", GBP: "GBP – British Pound", CAD: "CAD – Canadian Dollar", AUD: "AUD – Australian Dollar" };
  return labels[currency] || currency;
};

const formatCurrency = (amount: number, currency: string = 'USD') =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);

const getStatusBadge = (status: string | null) => {
  switch (status) {
    case "manually_matched":
    case "auto_matched":
      return <Badge className="bg-green-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Matched</Badge>;
    case "unmatched":
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Unmatched</Badge>;
    case "needs_review":
      return <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1"><HelpCircle className="h-3 w-3" /> Review</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
};

const getMethodLabel = (method: string) => {
  switch (method) {
    case "manual_upload": return "CSV Upload";
    case "manual_rematch": return "Manual Rematch";
    case "stripe_sync": return "Stripe";
    case "quickbooks_sync": return "QuickBooks";
    default: return method;
  }
};

export const PaymentReconciliationTable = ({ uploadId }: { uploadId?: string }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PaymentReconciliationFilters>({ uploadId });
  const [showFilters, setShowFilters] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentWithLinks | null>(null);
  const [rematchPayment, setRematchPayment] = useState<PaymentWithLinks | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", date: "", reference: "", notes: "" });
  const [rematchInvoiceId, setRematchInvoiceId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = usePaymentReconciliation(
    { ...filters, searchQuery },
    page,
    25
  );
  const unmatch = useUnmatchPayment();
  const rematch = useRematchPayment();
  const update = useUpdatePayment();

  // Fetch available currencies used in payments
  const { data: availableCurrencies } = useQuery({
    queryKey: ["payment-currencies"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("payments")
        .select("currency")
        .eq("user_id", user.id)
        .not("currency", "is", null);
      const unique = [...new Set((data || []).map(r => r.currency).filter(Boolean))] as string[];
      return unique.sort();
    },
  });

  // Fetch invoices for rematch dialog
  const { data: availableInvoices } = useQuery({
    queryKey: ["invoices-for-rematch"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, amount_outstanding, status, reference_id, debtors(name, company_name)")
        .eq("user_id", user.id)
        .in("status", ["Open", "PartiallyPaid", "InPaymentPlan"])
        .order("due_date", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!rematchPayment,
  });

  const handleEdit = (payment: PaymentWithLinks) => {
    setEditForm({
      amount: String(payment.amount),
      date: payment.payment_date,
      reference: payment.reference || "",
      notes: payment.notes || "",
    });
    setEditPayment(payment);
  };

  const handleSaveEdit = () => {
    if (!editPayment) return;
    update.mutate({
      paymentId: editPayment.id,
      amount: parseFloat(editForm.amount),
      paymentDate: editForm.date,
      reference: editForm.reference,
      notes: editForm.notes,
    }, { onSuccess: () => setEditPayment(null) });
  };

  const handleUnmatch = (payment: PaymentWithLinks) => {
    const link = payment.payment_invoice_links?.[0];
    if (!link) return;
    unmatch.mutate({
      linkId: link.id,
      paymentId: payment.id,
      invoiceId: link.invoice_id,
      amountApplied: link.amount_applied,
    });
  };

  const handleRematch = () => {
    if (!rematchPayment || !rematchInvoiceId) return;
    const link = rematchPayment.payment_invoice_links?.[0];
    if (!link) return;
    rematch.mutate({
      paymentId: rematchPayment.id,
      oldLinkId: link.id,
      oldInvoiceId: link.invoice_id,
      oldAmountApplied: link.amount_applied,
      newInvoiceId: rematchInvoiceId,
      amount: rematchPayment.amount,
    }, { onSuccess: () => { setRematchPayment(null); setRematchInvoiceId(""); } });
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => v && v !== "all" && k !== "uploadId");

  // Show currency badge in filter button when active
  const activeCurrencyLabel = filters.currency && filters.currency !== "all" ? filters.currency : null;

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? "border-primary" : ""}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeCurrencyLabel && (
            <Badge variant="secondary" className="ml-2 text-xs">{activeCurrencyLabel}</Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => { setFilters(prev => ({ ...prev, status: v })); setPage(1); }}
              >
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="manually_matched">Matched</SelectItem>
                  <SelectItem value="unmatched">Unmatched</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
              {availableCurrencies && availableCurrencies.length > 1 && (
                <Select
                  value={filters.currency || "all"}
                  onValueChange={(v) => { setFilters(prev => ({ ...prev, currency: v })); setPage(1); }}
                >
                  <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Currencies</SelectItem>
                    {availableCurrencies.map(c => (
                      <SelectItem key={c} value={c}>{getCurrencyLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => { setFilters(prev => ({ ...prev, dateFrom: e.target.value })); setPage(1); }}
                placeholder="From"
              />
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => { setFilters(prev => ({ ...prev, dateTo: e.target.value })); setPage(1); }}
                placeholder="To"
              />
            </div>
            {(filters.status && filters.status !== "all") || (filters.currency && filters.currency !== "all") || filters.dateFrom || filters.dateTo ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-muted-foreground"
                onClick={() => { setFilters({ uploadId }); setPage(1); }}
              >
                Clear filters
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : data?.payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-lg">No payments found</p>
            <p className="text-sm mt-1">Upload payments via Data Center to see reconciliation details here</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Matched Invoice</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.payments.map((payment) => {
                  const link = payment.payment_invoice_links?.[0];
                  const invoice = link?.invoices;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(payment.payment_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="truncate font-medium">
                          {payment.debtors?.company_name || payment.debtors?.name || "—"}
                        </div>
                        {payment.debtors?.reference_id && (
                          <div className="text-xs text-muted-foreground">{payment.debtors.reference_id}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatCurrency(payment.amount, payment.currency || 'USD')}
                      </TableCell>
                      <TableCell>
                        {invoice ? (
                          <button
                            className="text-left hover:underline text-primary"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                          >
                            <div className="text-sm font-medium">{invoice.invoice_number || invoice.reference_id}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(link!.amount_applied, payment.currency || 'USD')} applied
                            </div>
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {payment.invoice_number_hint || "No match"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {link?.match_confidence != null ? (
                          <Badge variant={link.match_confidence >= 0.9 ? "default" : "outline"} className="text-xs">
                            {Math.round(link.match_confidence * 100)}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {link ? getMethodLabel(link.match_method) : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.reconciliation_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(payment)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {link && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRematchPayment(payment); }} title="Rematch">
                                <LinkIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleUnmatch(payment)} title="Unmatch" disabled={unmatch.isPending}>
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages} ({data.totalCount} total)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Payment Dialog */}
      <Dialog open={!!editPayment} onOpenChange={() => setEditPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={editForm.date} onChange={(e) => setEditForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={editForm.reference} onChange={(e) => setEditForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={update.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rematch Dialog */}
      <Dialog open={!!rematchPayment} onOpenChange={() => { setRematchPayment(null); setRematchInvoiceId(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Re-assign Invoice Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Payment: {formatCurrency(rematchPayment?.amount || 0)}</p>
              <p className="text-xs text-muted-foreground">
                Account: {rematchPayment?.debtors?.company_name || rematchPayment?.debtors?.name || "Unknown"}
              </p>
            </div>
            <div>
              <Label>Select New Invoice</Label>
              <Select value={rematchInvoiceId} onValueChange={setRematchInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Choose an invoice..." /></SelectTrigger>
                <SelectContent>
                  {availableInvoices?.map((inv: any) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number || inv.reference_id} — {formatCurrency(inv.amount_outstanding)} outstanding
                      {inv.debtors?.company_name ? ` (${inv.debtors.company_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRematchPayment(null); setRematchInvoiceId(""); }}>Cancel</Button>
            <Button onClick={handleRematch} disabled={!rematchInvoiceId || rematch.isPending}>
              Confirm Rematch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
