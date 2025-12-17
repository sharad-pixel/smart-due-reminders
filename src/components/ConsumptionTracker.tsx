import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCw,
  Receipt,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/subscriptionConfig";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ConsumptionData {
  invoices: {
    used: number;
    limit: number;
    overage: number;
    overageCharges: number;
    remaining: number;
    percentUsed: number;
    planName: string;
    overageRate: number;
  };
  period: string;
}

interface UpcomingCharges {
  hasUpcoming: boolean;
  amountDue: number;
  nextPaymentDate: string | null;
  breakdown: {
    baseSubscription: number;
    seatCharges: number;
    overageCharges: number;
    prorations: number;
  };
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
}

const ConsumptionTracker = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [consumption, setConsumption] = useState<ConsumptionData | null>(null);
  const [upcomingCharges, setUpcomingCharges] = useState<UpcomingCharges | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch usage data
      const { data: usageData, error: usageError } = await supabase.functions.invoke('get-monthly-usage');
      
      if (!usageError && usageData) {
        const limit = usageData.included_allowance || 0;
        const used = usageData.included_invoices_used || 0;
        const overage = usageData.overage_invoices || 0;
        const overageRate = usageData.overage_rate || 1.99;
        
        // Calculate overage charges: $1.99 per invoice over the plan limit
        const calculatedOverageCharges = overage * overageRate;
        
        setConsumption({
          invoices: {
            used,
            limit,
            overage,
            overageCharges: usageData.overage_charges_total || calculatedOverageCharges,
            remaining: usageData.remaining_quota || 0,
            percentUsed: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
            planName: usageData.plan_name || 'Unknown',
            overageRate,
          },
          period: usageData.month || new Date().toISOString().slice(0, 7),
        });
      }

      // Fetch upcoming charges
      const { data: chargesData, error: chargesError } = await supabase.functions.invoke('get-upcoming-charges');
      
      if (!chargesError && chargesData?.has_upcoming_invoice) {
        setUpcomingCharges({
          hasUpcoming: true,
          amountDue: chargesData.upcoming_invoice.amount_due,
          nextPaymentDate: chargesData.upcoming_invoice.next_payment_attempt,
          breakdown: {
            baseSubscription: chargesData.breakdown.base_subscription.total,
            seatCharges: chargesData.breakdown.seat_charges.total,
            overageCharges: chargesData.breakdown.overage_charges.total,
            prorations: chargesData.breakdown.prorations.total,
          },
          lineItems: [
            ...chargesData.breakdown.base_subscription.items,
            ...chargesData.breakdown.seat_charges.items,
            ...chargesData.breakdown.overage_charges.items,
            ...chargesData.breakdown.prorations.items,
          ],
        });
      } else {
        setUpcomingCharges({
          hasUpcoming: false,
          amountDue: 0,
          nextPaymentDate: null,
          breakdown: {
            baseSubscription: 0,
            seatCharges: 0,
            overageCharges: 0,
            prorations: 0,
          },
          lineItems: [],
        });
      }
    } catch (error) {
      console.error('Error fetching consumption data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 75) return 'text-amber-600';
    if (percent >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '[&>div]:bg-red-500';
    if (percent >= 75) return '[&>div]:bg-amber-500';
    if (percent >= 50) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-green-500';
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Consumption & Upcoming Charges
            </CardTitle>
            <CardDescription>
              Track your usage and view upcoming billing charges
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Consumption */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Invoice Usage</h3>
            {consumption && (
              <Badge variant="secondary" className="ml-2 capitalize">
                {consumption.invoices.planName} Plan
              </Badge>
            )}
            <Badge variant="outline" className="ml-auto">
              {consumption?.period ? formatPeriod(consumption.period) : 'Current Period'}
            </Badge>
          </div>
          
          {consumption && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  {consumption.invoices.used} of {consumption.invoices.limit} included invoices used
                </span>
                <span className={`font-semibold ${getUsageColor(consumption.invoices.percentUsed)}`}>
                  {Math.round(consumption.invoices.percentUsed)}%
                </span>
              </div>
              
              <Progress 
                value={consumption.invoices.percentUsed} 
                className={`h-3 ${getProgressColor(consumption.invoices.percentUsed)}`}
              />
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold text-primary">{consumption.invoices.limit}</p>
                  <p className="text-xs text-muted-foreground">Plan Limit</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <p className="text-2xl font-bold text-green-600">{consumption.invoices.used}</p>
                  <p className="text-xs text-muted-foreground">Included Used</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{consumption.invoices.remaining}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
              </div>

              {/* Overage Section - Enhanced */}
              {consumption.invoices.overage > 0 ? (
                <div className="mt-4 p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-800">Invoice Overages</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-amber-100/50 rounded-lg">
                      <p className="text-3xl font-bold text-amber-700">{consumption.invoices.overage}</p>
                      <p className="text-xs text-amber-600">Overage Invoices</p>
                    </div>
                    <div className="text-center p-3 bg-amber-100/50 rounded-lg">
                      <p className="text-3xl font-bold text-amber-700">
                        {formatPrice(consumption.invoices.overageCharges)}
                      </p>
                      <p className="text-xs text-amber-600">Overage Charges</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-amber-700 text-center">
                    <span className="font-medium">{consumption.invoices.overage} invoices</span> × 
                    <span className="font-medium ml-1">${consumption.invoices.overageRate.toFixed(2)}/invoice</span> = 
                    <span className="font-bold ml-1">{formatPrice(consumption.invoices.overageCharges)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 rounded-lg border border-green-500/30 bg-green-500/5 text-center">
                  <p className="text-sm text-green-700">
                    ✓ No overages this period — all invoices within plan limit
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Upcoming Charges */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Upcoming Invoice</h3>
          </div>

          {upcomingCharges?.hasUpcoming ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Next Payment</span>
                  </div>
                  {upcomingCharges.nextPaymentDate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(upcomingCharges.nextPaymentDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  )}
                </div>
                <p className="text-4xl font-bold text-primary">
                  {formatPrice(upcomingCharges.amountDue)}
                </p>
              </div>

              {/* Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Subscription</span>
                  <span>{formatPrice(upcomingCharges.breakdown.baseSubscription)}</span>
                </div>
                {upcomingCharges.breakdown.seatCharges > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Team Seats</span>
                    <span>{formatPrice(upcomingCharges.breakdown.seatCharges)}</span>
                  </div>
                )}
                {upcomingCharges.breakdown.overageCharges > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Invoice Overages</span>
                    <span>{formatPrice(upcomingCharges.breakdown.overageCharges)}</span>
                  </div>
                )}
                {upcomingCharges.breakdown.prorations !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prorations/Credits</span>
                    <span className={upcomingCharges.breakdown.prorations < 0 ? 'text-green-600' : ''}>
                      {upcomingCharges.breakdown.prorations < 0 ? '-' : ''}
                      {formatPrice(Math.abs(upcomingCharges.breakdown.prorations))}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total Due</span>
                  <span className="text-primary">{formatPrice(upcomingCharges.amountDue)}</span>
                </div>
              </div>

              {/* Detailed Line Items */}
              {upcomingCharges.lineItems.length > 0 && (
                <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      View Detailed Line Items
                      {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      {upcomingCharges.lineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[70%]">
                            {item.description}
                            {item.quantity > 1 && ` (×${item.quantity})`}
                          </span>
                          <span className={item.amount < 0 ? 'text-green-600' : ''}>
                            {item.amount < 0 ? '-' : ''}{formatPrice(Math.abs(item.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ) : (
            <div className="p-6 text-center rounded-lg border bg-muted/30">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No upcoming invoice</p>
              <p className="text-xs text-muted-foreground mt-1">
                You're on the free plan or don't have an active subscription
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConsumptionTracker;
