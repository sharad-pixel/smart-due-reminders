import { useState } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, ListTodo, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, Newspaper, Lightbulb, ExternalLink, Sparkles, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyDigest } from '@/hooks/useDailyDigest';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';

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
      case 'Needs Attention': return 'bg-orange-500';
      case 'At Risk': return 'bg-orange-600';
      case 'Critical': return 'bg-red-500';
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
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
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
          {selectedDate === today && (
            <Button 
              variant="outline" 
              onClick={handleGenerateDigest} 
              disabled={isGenerating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
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
                  <Link to="/tasks?status=open">View Tasks</Link>
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

          {/* CFO Cash Flow News & CashOps Insights */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* CFO News & Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-primary" />
                  CFO Cash Flow News
                </CardTitle>
                <CardDescription>Latest trends shaping finance leadership</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <a 
                    href="https://fortune.com/2025/12/03/boeing-new-cfo-sees-performance-culture-return-positive-cash-flow-next-year/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Boeing CFO: 'Performance Culture' Driving Return to Positive Cash Flow</h4>
                        <p className="text-xs text-muted-foreground mt-1">New leadership emphasizes operational discipline for 2025 recovery</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">Fortune</Badge>
                  </a>

                  <a 
                    href="https://www.highradius.com/finsider/cfo-outlook-2025/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">6 Key Trends Shaping CFO Decisions in 2025</h4>
                        <p className="text-xs text-muted-foreground mt-1">2.9% inflation expected • 73% taking more risk • 30% prioritize cost-cutting</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">HighRadius</Badge>
                  </a>

                  <a 
                    href="https://ey.com/en_us/insights/strategy/cash-forecasting-difficult-and-more-urgent-than-ever"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Cash Forecasting: More Urgent Than Ever</h4>
                        <p className="text-xs text-muted-foreground mt-1">EY insights on why accurate cash forecasting remains challenging</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">EY</Badge>
                  </a>

                  <a 
                    href="https://mexicobusiness.news/finance/news/cash-king-once-again-2025-strategies-business-success"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Cash is King Once Again in 2025</h4>
                        <p className="text-xs text-muted-foreground mt-1">Strategies for business success in tight liquidity environment</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">Mexico Business</Badge>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* CashOps & AR Automation News */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  CashOps & AR Automation
                </CardTitle>
                <CardDescription>Industry updates on collections technology</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <a 
                    href="https://www.chaserhq.com/blog/automated-debt-collection"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Automated Debt Collection Reduces DSO by Up to 75%</h4>
                        <p className="text-xs text-muted-foreground mt-1">How AI-powered collection workflows accelerate cash conversion</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">Chaser</Badge>
                  </a>

                  <a 
                    href="https://fortispay.com/the-hidden-cost-of-fragmented-ar-workflows-what-tech-leaders-should-know/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Hidden Cost of Fragmented AR Workflows: $1.3M Annually</h4>
                        <p className="text-xs text-muted-foreground mt-1">59% of companies attribute poor cash flow to manual AR processes</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">Fortis</Badge>
                  </a>

                  <a 
                    href="https://www.serrala.com/blog/top-10-ar-automation-software-solutions-in-2025"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Top 10 AR Automation Software Solutions in 2025</h4>
                        <p className="text-xs text-muted-foreground mt-1">Must-have features for modern accounts receivable automation</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">Serrala</Badge>
                  </a>

                  <a 
                    href="https://www.highradius.com/resources/Blog/best-cash-application-automation-tools/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors">9 Best Cash Application Automation Tools in 2025</h4>
                        <p className="text-xs text-muted-foreground mt-1">AI-powered tools for accurate payment matching and reconciliation</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">HighRadius</Badge>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Collection Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Collection Best Practices
              </CardTitle>
              <CardDescription>Proven strategies to optimize your AR collections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-4 rounded-lg border bg-gradient-to-br from-green-500/10 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-green-600">1</span>
                    </div>
                    <h4 className="font-semibold text-sm">Clear Payment Terms</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Establish and communicate payment terms upfront. Include due dates, accepted methods, and late payment penalties in all contracts.</p>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-500/10 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600">2</span>
                    </div>
                    <h4 className="font-semibold text-sm">Invoice Promptly</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Send invoices immediately upon delivery. Timely, accurate invoicing reduces disputes and accelerates payment cycles.</p>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-500/10 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-purple-600">3</span>
                    </div>
                    <h4 className="font-semibold text-sm">Systematic Follow-ups</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Implement automated reminder sequences. Consistent follow-up at 7, 14, 30, and 60 days significantly improves collection rates.</p>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-orange-500/10 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-orange-600">4</span>
                    </div>
                    <h4 className="font-semibold text-sm">Offer Payment Flexibility</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Provide multiple payment options and consider payment plans for larger balances. Flexibility often converts reluctant payers.</p>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-red-500/10 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-red-600">5</span>
                    </div>
                    <h4 className="font-semibold text-sm">Prioritize High-Value</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Focus collection efforts on high-value, high-risk accounts first. Use scoring to identify accounts needing immediate attention.</p>
                </div>

                <div className="p-4 rounded-lg border bg-gradient-to-br from-teal-500/10 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-teal-600">6</span>
                    </div>
                    <h4 className="font-semibold text-sm">Leverage AI Automation</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Use AI-powered tools for personalized outreach, sentiment analysis, and optimal send timing to maximize response rates.</p>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Pro Tip: Monitor Your DSO</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Days Sales Outstanding (DSO) is your key health metric. Industry benchmark is 30-45 days. 
                      Every day you reduce DSO improves working capital. Companies using AR automation 
                      report up to 75% reduction in DSO and 80% faster reconciliation.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </Layout>
  );
};

export default DailyDigest;
