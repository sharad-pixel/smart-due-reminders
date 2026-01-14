import { useState } from 'react';
import Layout from '@/components/Layout';
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
  Zap,
  ArrowLeft,
  Clock,
  User
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

const formatTimestamp = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return format(d, 'MMM d, yyyy h:mm a');
  } catch {
    return '—';
  }
};

const PaymentsActivity = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PaymentsFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 25;

  const { data: paymentsData, isLoading: paymentsLoading } = usePaymentsActivity({
    filters,
    page,
    pageSize,
  });

  const { data: summary, isLoading: summaryLoading } = usePaymentsSummary();
  const { data: transactionTypes = [] } = useTransactionTypes();
  const { data: dynamicSources = [] } = useSourceSystems();
  
  // Always include stripe and quickbooks as source options
  const sourceSystems = [...new Set(['stripe', 'quickbooks', ...dynamicSources])];

  const handleFilterChange = (key: keyof PaymentsFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'all');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Payments & Settlements</h1>
              <p className="text-muted-foreground mt-1">
                Complete payment activity log with source tracking and timestamps
              </p>
            </div>
          </div>
          <Button
            variant="outline"
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
        </div>

        {/* Summary Cards */}
        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Today
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.totalCollectedToday || 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  Last 7 Days
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.totalCollectedLast7Days || 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/10 border-purple-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  Last 30 Days
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.totalCollectedLast30Days || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                  <CreditCard className="h-4 w-4" />
                  Avg Payment
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.averagePaymentAmount || 0)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Source Breakdown */}
        {summary?.bySource && Object.keys(summary.bySource).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.bySource).map(([source, amount]) => (
              <Badge key={source} variant="outline" className="py-1.5 px-3">
                {getSourceIcon(source)}
                <span className="ml-1 capitalize">{source}</span>
                <span className="ml-2 font-semibold">{formatCurrency(amount)}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
            </CardContent>
          </Card>
        )}

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Log</CardTitle>
            <CardDescription>
              All payment transactions with source, timestamp, and user activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : paymentsData?.transactions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium text-lg">No payments recorded yet</p>
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
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Reference</TableHead>
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
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <div className="text-sm">{formatTxDate(tx.transaction_date)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {tx.created_at ? format(new Date(tx.created_at), 'h:mm a') : '—'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[180px]">
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
                          <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                            <div className="truncate">{tx.reference_number || '—'}</div>
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
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, paymentsData.totalCount)} of {paymentsData.totalCount}
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
      </div>
    </Layout>
  );
};

export default PaymentsActivity;
