import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, Search, ChevronLeft, ChevronRight, Filter,
  Zap, Building2, Upload, Bot, CreditCard, FileSpreadsheet,
  ArrowDownLeft, ArrowUpRight, FileX, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import {
  usePaymentsActivity,
  useTransactionTypes,
  useSourceSystems,
  PaymentsFilters,
} from "@/hooks/usePaymentsActivity";

const getSourceIcon = (source: string | null) => {
  switch (source?.toLowerCase()) {
    case "stripe": case "stripe_sync": return <Zap className="h-3.5 w-3.5 text-purple-500" />;
    case "quickbooks": case "quickbooks_sync": return <Building2 className="h-3.5 w-3.5 text-green-600" />;
    case "csv_upload": case "data_center": return <Upload className="h-3.5 w-3.5 text-blue-500" />;
    case "ai_ingestion": return <Bot className="h-3.5 w-3.5 text-sky-500" />;
    case "recouply": case "manual": return <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

const getSourceLabel = (source: string | null) => {
  switch (source?.toLowerCase()) {
    case "stripe": case "stripe_sync": return "Stripe";
    case "quickbooks": case "quickbooks_sync": return "QuickBooks";
    case "csv_upload": case "data_center": return "CSV Upload";
    case "ai_ingestion": return "AI Scan";
    case "recouply": case "manual": return "Manual";
    default: return source || "Unknown";
  }
};

const getSourceBadgeClass = (source: string | null) => {
  switch (source?.toLowerCase()) {
    case "stripe": case "stripe_sync": return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "quickbooks": case "quickbooks_sync": return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "csv_upload": case "data_center": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "ai_ingestion": return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    case "recouply": case "manual": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "payment": return <DollarSign className="h-3.5 w-3.5 text-green-600" />;
    case "credit": return <CreditCard className="h-3.5 w-3.5 text-blue-600" />;
    case "write_off": return <FileX className="h-3.5 w-3.5 text-orange-600" />;
    case "adjustment": return <RefreshCw className="h-3.5 w-3.5 text-purple-600" />;
    case "refund": return <ArrowDownLeft className="h-3.5 w-3.5 text-red-600" />;
    case "reversal": return <ArrowUpRight className="h-3.5 w-3.5 text-gray-600" />;
    default: return <DollarSign className="h-3.5 w-3.5" />;
  }
};

const formatType = (type: string) =>
  type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export const TransactionActivityTable = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PaymentsFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = usePaymentsActivity({
    filters: { ...filters, searchQuery },
    page,
    pageSize: 25,
  });

  const { data: txTypes } = useTransactionTypes();
  const { data: sources } = useSourceSystems();

  const hasActiveFilters = !!(
    (filters.transactionType && filters.transactionType !== "all") ||
    (filters.sourceSystem && filters.sourceSystem !== "all") ||
    filters.dateFrom ||
    filters.dateTo
  );

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by account, invoice, reference..."
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
          {hasActiveFilters && <Badge variant="secondary" className="ml-2 text-xs">Active</Badge>}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={filters.sourceSystem || "all"}
                onValueChange={(v) => { setFilters(f => ({ ...f, sourceSystem: v })); setPage(1); }}
              >
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources?.map(s => (
                    <SelectItem key={s} value={s}>{getSourceLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.transactionType || "all"}
                onValueChange={(v) => { setFilters(f => ({ ...f, transactionType: v })); setPage(1); }}
              >
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {txTypes?.map(t => (
                    <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
              />
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1); }}
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-muted-foreground"
                onClick={() => { setFilters({}); setPage(1); }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : !data?.transactions.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-lg">No transactions found</p>
            <p className="text-sm mt-1">Payments from Stripe, QuickBooks, manual entries, and uploads will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(tx.transaction_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={`gap-1 ${getSourceBadgeClass(tx.source_system)}`} variant="secondary">
                        {getSourceIcon(tx.source_system)}
                        {getSourceLabel(tx.source_system)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getTypeIcon(tx.transaction_type)}
                        <span className="text-sm">{formatType(tx.transaction_type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <div className="truncate font-medium text-sm">
                        {tx.invoice?.debtors?.company_name || tx.invoice?.debtors?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tx.invoice ? (
                        <button
                          className="text-left hover:underline text-primary text-sm"
                          onClick={() => navigate(`/invoices/${tx.invoice_id}`)}
                        >
                          {tx.invoice.invoice_number || "View"}
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={tx.transaction_type === "refund" || tx.transaction_type === "reversal" ? "text-red-600" : "text-green-600"}>
                        {tx.transaction_type === "refund" || tx.transaction_type === "reversal" ? "-" : ""}
                        {formatCurrency(Math.abs(tx.amount), tx.invoice?.currency || "USD")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {tx.balance_after != null ? formatCurrency(tx.balance_after, tx.invoice?.currency || "USD") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {tx.reference_number || tx.payment_method || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.totalPages > 1 && (
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
    </div>
  );
};
