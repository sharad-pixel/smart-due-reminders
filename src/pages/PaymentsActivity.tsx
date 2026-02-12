import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, ArrowLeft, TrendingUp, Calendar, CreditCard, 
  Building2, Zap, LinkIcon, FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePaymentsSummary } from '@/hooks/usePaymentsActivity';
import { PaymentReconciliationTable } from '@/components/payments/PaymentReconciliationTable';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const getSourceIcon = (source: string | null) => {
  if (!source) return null;
  switch (source.toLowerCase()) {
    case 'stripe': return <Zap className="h-3 w-3 text-purple-500" />;
    case 'quickbooks': return <Building2 className="h-3 w-3 text-green-600" />;
    default: return null;
  }
};

const PaymentsActivity = () => {
  const navigate = useNavigate();
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const { data: summary, isLoading: summaryLoading } = usePaymentsSummary();

  // Fetch payment uploads from Data Center
  const { data: paymentUploads } = useQuery({
    queryKey: ["payment-uploads"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("data_center_uploads")
        .select("id, file_name, file_type, status, row_count, processed_count, matched_count, created_at, processed_at")
        .eq("user_id", user.id)
        .eq("file_type", "payments")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Payments & Reconciliation</h1>
            <p className="text-muted-foreground">Track payments, match details, and manage reconciliation</p>
          </div>
        </div>

        {/* Summary Cards */}
        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" /> Today
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.totalCollectedToday || 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-medium">
                  <Calendar className="h-4 w-4" /> Last 7 Days
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.totalCollectedLast7Days || 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/10 border-purple-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-sm font-medium">
                  <Calendar className="h-4 w-4" /> Last 30 Days
                </div>
                <div className="text-2xl font-bold mt-2">{formatCurrency(summary?.totalCollectedLast30Days || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                  <CreditCard className="h-4 w-4" /> Avg Payment
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

        {/* Tabs: All Payments / By Upload */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <DollarSign className="h-4 w-4" /> All Payments
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> By Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  Payment Reconciliation
                </CardTitle>
                <CardDescription>
                  View match details, edit payments, re-assign or unmatch invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentReconciliationTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uploads">
            <div className="space-y-4">
              {/* Upload List */}
              {!selectedUploadId ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Uploads</CardTitle>
                    <CardDescription>Click an upload to see row-level match details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!paymentUploads || paymentUploads.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No payment uploads yet</p>
                        <p className="text-sm mt-1">Upload payments via Data Center to see details here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {paymentUploads.map((upload: any) => (
                          <button
                            key={upload.id}
                            className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between gap-4"
                            onClick={() => setSelectedUploadId(upload.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <DollarSign className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{upload.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(upload.created_at), "MMM d, yyyy h:mm a")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <p className="font-medium">{upload.matched_count || 0}/{upload.row_count || 0} rows</p>
                                <p className="text-xs text-muted-foreground">{upload.matched_count || 0} matched</p>
                              </div>
                              <Badge variant={upload.status === "processed" ? "default" : upload.status === "needs_review" ? "outline" : "secondary"}>
                                {upload.status === "processed" ? "Completed" : upload.status === "needs_review" ? "Needs Review" : upload.status}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedUploadId(null)}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Back to Uploads
                    </Button>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload Payment Details</CardTitle>
                      <CardDescription>
                        Row-level match details for this upload
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PaymentReconciliationTable uploadId={selectedUploadId} />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PaymentsActivity;
