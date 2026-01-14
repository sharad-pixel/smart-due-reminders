import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  CreditCard, 
  FileX, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight,
  TrendingUp,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Building2,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  usePaymentsActivity, 
  usePaymentsSummary, 
  useTransactionTypes,
  useSourceSystems,
  PaymentsFilters 
} from '@/hooks/usePaymentsActivity';
import { useNavigate } from 'react-router-dom';

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'payment':
      return <DollarSign className="h-4 w-4 text-green-600" />;
    case 'credit':
      return <CreditCard className="h-4 w-4 text-blue-600" />;
    case 'write_off':
      return <FileX className="h-4 w-4 text-orange-600" />;
    case 'adjustment':
      return <RefreshCw className="h-4 w-4 text-purple-600" />;
    case 'refund':
      return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    case 'reversal':
      return <ArrowUpRight className="h-4 w-4 text-gray-600" />;
    default:
      return <DollarSign className="h-4 w-4" />;
  }
};

const getTransactionBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (type) {
    case 'payment':
    case 'credit':
      return 'default';
    case 'refund':
    case 'reversal':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const formatTransactionType = (type: string) => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getSourceIcon = (source: string | null) => {
  if (!source) return null;
  switch (source.toLowerCase()) {
    case 'stripe':
      return <Zap className="h-3 w-3 text-purple-500" />;
    case 'quickbooks':
      return <Building2 className="h-3 w-3 text-green-600" />;
    default:
      return null;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatTxDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return format(d, 'MMM d, yyyy');
  } catch {
    return '—';
  }
};

export const PaymentsActivityDashboard = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PaymentsFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: paymentsData, isLoading: paymentsLoading } = usePaymentsActivity({
    filters,
    page,
    pageSize: 5,
  });

  const { data: summary, isLoading: summaryLoading } = usePaymentsSummary();
  const { data: transactionTypes = [] } = useTransactionTypes();
  const { data: dynamicSources = [] } = useSourceSystems();
  
  // Always include stripe and quickbooks as source options
  const sourceSystems = [...new Set(['stripe', 'quickbooks', ...dynamicSources])];

  const handleFilterChange = (key: keyof PaymentsFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'all');

  if (summaryLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Payments & Settlements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Payments & Settlements
            </CardTitle>
            <CardDescription className="mt-1">
              Track all payments collected via integrations and manual entry
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-primary' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {Object.values(filters).filter(v => v && v !== 'all').length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/payments')}
            >
              View All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Today
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(summary?.totalCollectedToday || 0)}</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Last 7 Days
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(summary?.totalCollectedLast7Days || 0)}</div>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Last 30 Days
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(summary?.totalCollectedLast30Days || 0)}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <CreditCard className="h-4 w-4" />
              Avg Payment
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(summary?.averagePaymentAmount || 0)}</div>
          </div>
        </div>

        {/* Source Breakdown */}
        {summary?.bySource && Object.keys(summary.bySource).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.bySource).map(([source, amount]) => (
              <Badge key={source} variant="outline" className="py-1 px-2">
                {getSourceIcon(source)}
                <span className="ml-1 capitalize">{source}</span>
                <span className="ml-2 font-semibold">{formatCurrency(amount)}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Select
                value={filters.transactionType || 'all'}
                onValueChange={(v) => handleFilterChange('transactionType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatTransactionType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.sourceSystem || 'all'}
                onValueChange={(v) => handleFilterChange('sourceSystem', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sourceSystems.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="From Date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />

              <Input
                type="date"
                placeholder="To Date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Transactions Table */}
        {paymentsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : paymentsData?.transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payments recorded yet</p>
            <p className="text-sm mt-1">
              Payments from Stripe, QuickBooks, and manual entries will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsData?.transactions.map((tx) => (
                    <TableRow 
                      key={tx.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => tx.invoice_id && navigate(`/invoices/${tx.invoice_id}`)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatTxDate(tx.transaction_date)}
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="truncate font-medium">
                          {tx.invoice?.debtors?.company_name || tx.invoice?.debtors?.name || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.invoice?.invoice_number || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getTransactionIcon(tx.transaction_type)}
                          <Badge variant={getTransactionBadgeVariant(tx.transaction_type)} className="text-xs">
                            {formatTransactionType(tx.transaction_type)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getSourceIcon(tx.source_system)}
                          <span className="text-sm capitalize text-muted-foreground">
                            {tx.source_system || 'Manual'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={
                          tx.transaction_type === 'refund' || tx.transaction_type === 'reversal'
                            ? 'text-red-600'
                            : 'text-green-600'
                        }>
                          {tx.transaction_type === 'refund' || tx.transaction_type === 'reversal' ? '-' : ''}
                          {formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {paymentsData && paymentsData.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 5) + 1} - {Math.min(page * 5, paymentsData.totalCount)} of {paymentsData.totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page} of {paymentsData.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(paymentsData.totalPages, p + 1))}
                    disabled={page === paymentsData.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentsActivityDashboard;
