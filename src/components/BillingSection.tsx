import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Zap,
  Crown,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PLAN_CONFIGS, STRIPE_PRICES, formatPrice, SEAT_PRICING, type PlanType } from "@/lib/subscriptionConfig";

interface BillingSectionProps {
  profile: {
    id: string;
    email: string | null;
    plan_type: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  };
  canManageBilling: boolean;
  onRefresh: () => void;
}

const BillingSection = ({ profile, canManageBilling, onRefresh }: BillingSectionProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    status?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    billingInterval?: 'month' | 'year';
  } | null>(null);
  const [usageData, setUsageData] = useState<{
    includedUsed: number;
    allowance: number;
    overageCount: number;
    remaining: number;
  } | null>(null);

  const currentPlan = (profile.plan_type || 'free') as PlanType;
  const hasActiveSubscription = !!profile.stripe_subscription_id;

  // Sync subscription and usage on mount
  useEffect(() => {
    syncSubscription();
    fetchUsage();
  }, []);

  const syncSubscription = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("sync-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data) {
        setSubscriptionDetails({
          status: data.subscription_status,
          currentPeriodEnd: data.current_period_end,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          billingInterval: data.billing_interval,
        });
        
        if (data.billing_interval) {
          setBillingInterval(data.billing_interval);
        }
      }

      // Refresh parent profile data
      onRefresh();
    } catch (error) {
      console.error("Error syncing subscription:", error);
    } finally {
      setSyncing(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('get-monthly-usage');
      if (!error && data) {
        setUsageData({
          includedUsed: data.included_invoices_used || 0,
          allowance: data.included_allowance || 0,
          overageCount: data.overage_invoices || 0,
          remaining: data.remaining_quota || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const handleUpgrade = async (planType: Exclude<PlanType, 'free' | 'enterprise'>) => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to upgrade",
          variant: "destructive",
        });
        return;
      }

      const priceId = billingInterval === 'year' 
        ? STRIPE_PRICES.annual[planType]
        : STRIPE_PRICES.monthly[planType];

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          priceId,
          billingInterval,
          successUrl: `${window.location.origin}/profile?checkout=success`,
          cancelUrl: `${window.location.origin}/profile?checkout=canceled`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to manage billing",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error opening billing portal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { cancel_at_period_end: true },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Subscription Canceled",
          description: data.current_period_end 
            ? `Your subscription will remain active until ${new Date(data.current_period_end).toLocaleDateString()}`
            : "Your subscription has been canceled",
        });
        syncSubscription();
      }
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const getPlanConfig = (plan: string) => {
    if (plan === 'free' || plan === 'enterprise') return null;
    return PLAN_CONFIGS[plan as Exclude<PlanType, 'free'>];
  };

  const currentPlanConfig = getPlanConfig(currentPlan);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing & Subscription
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing details
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={syncSubscription}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Status */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">
                {currentPlanConfig?.displayName || 'Free'} Plan
              </span>
            </div>
            {hasActiveSubscription ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Free Tier</Badge>
            )}
          </div>

          {currentPlanConfig && (
            <p className="text-2xl font-bold text-primary">
              {formatPrice(billingInterval === 'year' 
                ? currentPlanConfig.equivalentMonthly 
                : currentPlanConfig.monthlyPrice)}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
              {billingInterval === 'year' && (
                <span className="text-sm font-normal text-green-600 ml-2">
                  (billed annually, 20% off)
                </span>
              )}
            </p>
          )}

          {subscriptionDetails?.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              {subscriptionDetails.cancelAtPeriodEnd 
                ? `Cancels on ${new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString()}`
                : `Renews on ${new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString()}`
              }
            </p>
          )}
        </div>

        {/* Invoice Usage Section */}
        {usageData && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Monthly Invoice Usage</span>
              </div>
              <Badge variant="outline" className="capitalize">
                {currentPlan}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {usageData.includedUsed} / {usageData.allowance} invoices
                </span>
                <span className="text-muted-foreground">
                  {usageData.remaining} remaining
                </span>
              </div>
              
              <Progress 
                value={usageData.allowance > 0 ? Math.min(100, (usageData.includedUsed / usageData.allowance) * 100) : 0} 
                className="h-2"
              />

              {usageData.overageCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    {usageData.overageCount} overage invoices (${(usageData.overageCount * 1.99).toFixed(2)})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upgrade Options - Show only if not on highest plan */}
        {currentPlan !== 'professional' && currentPlan !== 'enterprise' && canManageBilling && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Upgrade Your Plan</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="billing-toggle" className="text-sm text-muted-foreground">
                    Monthly
                  </Label>
                  <Switch
                    id="billing-toggle"
                    checked={billingInterval === 'year'}
                    onCheckedChange={(checked) => setBillingInterval(checked ? 'year' : 'month')}
                  />
                  <Label htmlFor="billing-toggle" className="text-sm text-muted-foreground flex items-center gap-1">
                    Annual
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                      Save 20%
                    </Badge>
                  </Label>
                </div>
              </div>

              <div className="grid gap-4">
                {Object.entries(PLAN_CONFIGS)
                  .filter(([key]) => key !== 'enterprise')
                  .filter(([key]) => {
                    // Show plans higher than current
                    const planOrder = ['free', 'starter', 'growth', 'professional'];
                    return planOrder.indexOf(key) > planOrder.indexOf(currentPlan);
                  })
                  .map(([key, config]) => (
                    <div 
                      key={key}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        config.highlighted 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{config.displayName}</span>
                            {config.highlighted && (
                              <Badge variant="default">Popular</Badge>
                            )}
                          </div>
                          <p className="text-xl font-bold text-primary mt-1">
                            {formatPrice(billingInterval === 'year' 
                              ? config.equivalentMonthly 
                              : config.monthlyPrice)}
                            <span className="text-sm font-normal text-muted-foreground">/month</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {config.invoiceLimit} invoices/month • {config.maxAgents} AI agents
                          </p>
                        </div>
                        <Button
                          onClick={() => handleUpgrade(key as Exclude<PlanType, 'free' | 'enterprise'>)}
                          disabled={processing}
                          className="min-w-[120px]"
                        >
                          {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Upgrade
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Additional team members: {formatPrice(SEAT_PRICING.monthlyPrice)}/user/month
              </p>
            </div>
          </>
        )}

        <Separator />

        {/* Billing Actions */}
        {canManageBilling && (
          <div className="space-y-3">
            {hasActiveSubscription && (
              <>
                <Button 
                  onClick={handleManageBilling}
                  disabled={processing}
                  variant="outline"
                  className="w-full"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage Payment Methods & Invoices
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      disabled={canceling || subscriptionDetails?.cancelAtPeriodEnd}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {subscriptionDetails?.cancelAtPeriodEnd 
                        ? "Subscription Pending Cancellation" 
                        : canceling 
                          ? "Canceling..." 
                          : "Cancel Subscription"
                      }
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Cancel Subscription
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>Are you sure you want to cancel your subscription?</p>
                        <p className="text-sm">
                          Your subscription will remain active until the end of your current billing period. 
                          After that, you'll be downgraded to the Free plan.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, Cancel Subscription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}

        {!canManageBilling && (
          <Alert>
            <AlertDescription>
              Only account owners and admins can manage billing. Contact your account owner to make changes.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingSection;
