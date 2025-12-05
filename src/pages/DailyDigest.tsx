import { useState } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, ListTodo, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyDigest } from '@/hooks/useDailyDigest';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

const DailyDigest = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: digest, isLoading, refetch } = useDailyDigest(selectedDate);
  const { toast } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const canGoNext = selectedDate < today;

  const handlePrevDay = () => {
    setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    if (canGoNext) {
      setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
    }
  };

  const handleGenerateDigest = async () => {
    setIsGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('daily-digest-runner');
      if (error) throw error;
      toast({ title: 'Digest Generated', description: 'Your daily digest has been created.' });
      refetch();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate digest.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const getHealthColor = (label: string) => {
    switch (label) {
      case 'Healthy': return 'bg-green-500';
      case 'Caution': return 'bg-yellow-500';
      case 'Stressed': return 'bg-orange-500';
      case 'At Risk': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header with Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Collections Health Digest</h1>
          <p className="text-muted-foreground">Your daily summary of collections health and tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md min-w-[180px] justify-center">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{format(parseISO(selectedDate), 'MMM d, yyyy')}</span>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextDay} disabled={!canGoNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!digest ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Digest Available</h3>
            <p className="text-muted-foreground mb-6">
              {selectedDate === today
                ? "Today's digest will be generated soon, or you can generate it now."
                : 'No digest was generated for this date.'}
            </p>
            {selectedDate === today && (
              <Button onClick={handleGenerateDigest} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Digest Now
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Health Score Banner */}
          <Card className="overflow-hidden">
            <div className={`h-2 ${getHealthColor(digest.health_label)}`} />
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getHealthColor(digest.health_label)}`}>
                    {digest.health_score}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Collections Health: {digest.health_label}</h2>
                    <p className="text-muted-foreground">
                      Score based on AR aging, collection trends, and risk exposure
                    </p>
                  </div>
                </div>
                <Badge variant={digest.health_label === 'Healthy' ? 'default' : 'destructive'} className="text-sm px-4 py-1">
                  {digest.health_label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Tasks Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListTodo className="h-5 w-5 text-primary" />
                  Your Tasks Today
                </CardTitle>
                <CardDescription>Open and overdue collection tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold">{digest.open_tasks_count}</p>
                    <p className="text-xs text-muted-foreground">Open</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-500">{digest.overdue_tasks_count}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-500">{digest.tasks_created_today}</p>
                    <p className="text-xs text-muted-foreground">New Today</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/collections/tasks?status=open">View Tasks</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Collections Snapshot Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Collections Snapshot
                </CardTitle>
                <CardDescription>AR outstanding and recent collections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total AR Outstanding</p>
                  <p className="text-2xl font-bold">{formatCurrency(Number(digest.total_ar_outstanding))}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Collections</p>
                    <p className="text-lg font-semibold text-green-500">{formatCurrency(Number(digest.payments_collected_today))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Last 7 Days</p>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(digest.collection_trend)}
                      <p className="text-lg font-semibold">{formatCurrency(Number(digest.payments_collected_last_7_days))}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk & Focus Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Risk & Focus Areas
                </CardTitle>
                <CardDescription>High-risk accounts and AR exposure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">High-Risk Accounts</p>
                    <p className="text-2xl font-bold text-orange-500">{digest.high_risk_customers_count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">High-Risk AR</p>
                    <p className="text-lg font-semibold text-red-500">{formatCurrency(Number(digest.high_risk_ar_outstanding))}</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/debtors?risk=high">View High-Risk Accounts</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* AR Aging Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>AR Aging Breakdown</CardTitle>
              <CardDescription>Outstanding receivables by aging bucket</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Current', value: Number(digest.ar_current), color: 'bg-green-500' },
                  { label: '1-30 Days', value: Number(digest.ar_1_30), color: 'bg-blue-500' },
                  { label: '31-60 Days', value: Number(digest.ar_31_60), color: 'bg-yellow-500' },
                  { label: '61-90 Days', value: Number(digest.ar_61_90), color: 'bg-orange-500' },
                  { label: '91-120 Days', value: Number(digest.ar_91_120), color: 'bg-red-400' },
                  { label: '120+ Days', value: Number(digest.ar_120_plus), color: 'bg-red-600' },
                ].map((bucket) => {
                  const total = Number(digest.total_ar_outstanding);
                  const percentage = total > 0 ? (bucket.value / total) * 100 : 0;
                  return (
                    <div key={bucket.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{bucket.label}</span>
                        <span className="font-medium">{formatCurrency(bucket.value)} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${bucket.color} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DailyDigest;
