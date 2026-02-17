import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, ExternalLink, AlertTriangle, CheckCircle, Clock, Calendar, TrendingUp, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLAN_CONFIGS, SEAT_PRICING, ANNUAL_DISCOUNT_RATE, formatPrice } from "@/lib/subscriptionConfig";
import { AccountHierarchy } from "@/components/AccountHierarchy";
import { useAccountHierarchy } from "@/hooks/useAccountHierarchy";
import ConsumptionTracker from "@/components/ConsumptionTracker";
import { UsageIndicator } from "@/components/UsageIndicator";
import { TrialCountdown } from "@/components/TrialCountdown";
import UsageBillingLog from "@/components/UsageBillingLog";
// Colorful gauge component
const UsageGauge = ({ 
  used, 
  limit, 
  isUnlimited = false 
}: { 
  used: number; 
  limit: number; 
  isUnlimited?: boolean;
}) => {
  const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Color based on usage level
  const getColor = () => {
    if (isUnlimited) return { stroke: 'hsl(var(--primary))', text: 'text-primary', bg: 'bg-primary/10' };
    if (percentage >= 90) return { stroke: 'hsl(0, 84%, 60%)', text: 'text-red-500', bg: 'bg-red-500/10' };
    if (percentage >= 75) return { stroke: 'hsl(38, 92%, 50%)', text: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (percentage >= 50) return { stroke: 'hsl(48, 96%, 53%)', text: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    return { stroke: 'hsl(142, 76%, 36%)', text: 'text-green-500', bg: 'bg-green-500/10' };
  };
  
  const colors = getColor();
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          {/* Progress circle with gradient effect */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isUnlimited ? 0 : strokeDashoffset}
            className="transition-all duration-700 ease-out"
            style={{
              filter: 'drop-shadow(0 0 6px currentColor)',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colors.text}`}>
            {isUnlimited ? '∞' : `${Math.round(percentage)}%`}
          </span>
          <span className="text-xs text-muted-foreground">used</span>
        </div>
      </div>
      <div className={`mt-4 px-4 py-2 rounded-full ${colors.bg}`}>
        <span className={`text-sm font-medium ${colors.text}`}>
          {isUnlimited ? 'Unlimited' : `${used} / ${limit} invoices`}
        </span>
      </div>
    </div>
  );
};

interface UsageData {
  plan_name: string;
  included_allowance: number | string;
  included_invoices_used: number;
  overage_invoices: number;
  total_invoices_used: number;
  remaining_quota: number | string;
  is_over_limit: boolean;
  overage_rate: number;
}

interface ProfileData {
  plan_type: string;
  invoice_limit: number;
  billing_interval: string;
  subscription_status: string;
  current_period_end: string;
  stripe_subscription_id: string;
  is_account_locked?: boolean;
  account_locked_at?: string;
  payment_failure_notice_sent_at?: string;
}

interface StripeSubscriptionData {
  subscribed: boolean;
  plan_type: string;
  billing_interval: string;
  subscription_status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  from_database?: boolean;
}

const Billing = () => {
  usePageTitle("Billing");
  const navigate = useNavigate();
  
  // Use the comprehensive account hierarchy hook
  const accountHierarchy = useAccountHierarchy();
  
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stripeData, setStripeData] = useState<StripeSubscriptionData | null>(null);

  useEffect(() => {
    // Wait for account hierarchy to load before loading billing data
    if (!accountHierarchy.loading && accountHierarchy.effectiveAccountId) {
      loadBillingData();
    }
  }, [accountHierarchy.loading, accountHierarchy.effectiveAccountId]);

  const loadBillingData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Get effective account ID for team members
      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { 
        p_user_id: session.user.id 
      });
      const accountId = effectiveAccountId || session.user.id;

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_type, invoice_limit, billing_interval, subscription_status, current_period_end, stripe_subscription_id, is_account_locked, account_locked_at, payment_failure_notice_sent_at')
        .eq('id', accountId)
        .single();

      if (profileData) {
        setProfile(profileData as ProfileData);
      }

      // Team member data is now fetched via useAccountHierarchy hook

      // Fetch usage
      const { data: usageData, error: usageError } = await supabase.functions.invoke('get-monthly-usage');
      if (!usageError && usageData) {
        setUsage(usageData);
      }

      // Sync subscription data from Stripe to get accurate term dates
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-subscription');
      console.log('sync-subscription response:', { syncData, syncError });
      if (!syncError && syncData) {
        setStripeData(syncData);
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd?: boolean) => {
    if (cancelAtPeriodEnd && status === 'active') {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Cancels at Period End</Badge>;
    }
    switch (status) {
      case 'active':
      case 'trialing':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Inactive</Badge>;
    }
  };

  const getPlanConfig = (planType: string) => {
    return PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS] || null;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading || accountHierarchy.loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </Layout>
    );
  }

  // Use hierarchy data for permissions and display
  const isTeamMember = !accountHierarchy.isAccountOwner;
  const canManageBilling = accountHierarchy.permissions.canManageBilling;
  const parentAccount = accountHierarchy.parentAccount;
  const billableSeats = accountHierarchy.billing.billableSeats;

    // CRITICAL: Always prioritize DATABASE values (profile) as source of truth
    // Only use stripeData when it has a valid subscription (not from_database fallback)
    // This prevents showing "Free" when user has an active paid plan in the database
    const hasValidStripeSync = stripeData && stripeData.subscribed && !stripeData.from_database;
    
    const effectivePlanType = isTeamMember 
      ? (accountHierarchy.billing.planType || parentAccount?.planType || 'free')
      : (profile?.plan_type || stripeData?.plan_type || 'free');
    const effectiveSubscriptionStatus = isTeamMember
      ? (accountHierarchy.billing.subscriptionStatus || parentAccount?.subscriptionStatus || 'inactive')
      : (profile?.subscription_status || stripeData?.subscription_status || 'inactive');
    const effectiveBillingInterval = isTeamMember
      ? (accountHierarchy.billing.billingInterval || parentAccount?.billingInterval || 'month')
      : (profile?.billing_interval || stripeData?.billing_interval || 'month');

  const planConfig = getPlanConfig(effectivePlanType);
  
  // Derive invoice limit from usage data (source of truth) or plan config
  const invoiceLimit = usage?.included_allowance ?? planConfig?.invoiceLimit ?? 15;
  const isUnlimited = invoiceLimit === -1 || invoiceLimit === 'Unlimited';
  const invoicesUsed = usage?.included_invoices_used ?? 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          {profile?.stripe_subscription_id && canManageBilling && (
            <Button onClick={openCustomerPortal} disabled={portalLoading}>
              <CreditCard className="w-4 h-4 mr-2" />
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Team Member Notice - Using Account Hierarchy Data */}
        {isTeamMember && parentAccount && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Connected to Parent Account
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  {parentAccount.avatarUrl && (
                    <AvatarImage src={parentAccount.avatarUrl} />
                  )}
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {(parentAccount.name || parentAccount.email || 'O')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{parentAccount.name || 'Account Owner'}</p>
                  <p className="text-sm text-muted-foreground">{parentAccount.companyName || parentAccount.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize">
                      {parentAccount.planType || 'free'} plan
                    </Badge>
                    {parentAccount.subscriptionStatus === 'active' ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{parentAccount.subscriptionStatus || 'inactive'}</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      Your role: {accountHierarchy.memberRole || 'member'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-background/50 text-sm space-y-1">
                <p><strong>Billable Seats:</strong> {accountHierarchy.billing.billableSeats}</p>
                <p><strong>Active Members:</strong> {accountHierarchy.billing.activeMembers}</p>
                <p><strong>Pending Invites:</strong> {accountHierarchy.billing.pendingInvites}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                You're viewing billing information for the parent account. Only the account owner can manage billing and subscriptions.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Account Locked Alert */}
        {profile?.is_account_locked && (
          <Alert variant="destructive" className="mb-6 border-2 border-red-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Your account has been locked</strong> due to failed payment. 
              Please update your payment method immediately to restore access.
              <Button variant="link" className="p-0 ml-2 text-red-100" onClick={openCustomerPortal}>
                Restore Access Now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Past Due Warning */}
        {profile?.subscription_status === 'past_due' && !profile?.is_account_locked && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your payment is past due. Please update your payment method within 3 days to avoid account lockout.
              <Button variant="link" className="p-0 ml-2" onClick={openCustomerPortal}>
                Update Payment Method
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Trial Countdown - Shows only for trial/free users */}
        <div className="mb-6">
          <TrialCountdown variant="card" />
        </div>

        {/* Usage & Term Overview Card */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Usage & Billing Term
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UsageIndicator />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Plan
              {getStatusBadge(effectiveSubscriptionStatus, stripeData?.cancel_at_period_end)}
            </CardTitle>
              <CardDescription>
                Your subscription details and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">
                    {planConfig?.displayName || 'Free'}
                  </h3>
                  {planConfig && (
                    <div className="mb-4">
                      {effectiveBillingInterval === 'year' ? (
                        <>
                          <p className="text-2xl font-semibold text-primary">
                            {formatPrice(planConfig.annualPrice)}/year
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Equivalent to {formatPrice(planConfig.equivalentMonthly)}/month
                          </p>
                          <Badge className="mt-1 bg-green-100 text-green-800">
                            {Math.round(ANNUAL_DISCOUNT_RATE * 100)}% annual discount applied
                          </Badge>
                        </>
                      ) : (
                        <p className="text-2xl font-semibold text-primary">
                          {formatPrice(planConfig.monthlyPrice)}/month
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>Billing Cycle:</strong>{' '}
                        {effectiveBillingInterval === 'year' ? 'Annual' : 'Monthly'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>Team Seats:</strong>{' '}
                        {billableSeats} billable seat(s)
                        <span className="text-muted-foreground ml-1">
                          (owner seat included free)
                        </span>
                      </span>
                    </div>
                    {/* Detailed seat breakdown */}
                    <div className="pl-6 text-muted-foreground text-xs space-y-0.5">
                      <div>Active members: {accountHierarchy.billing.activeMembers} (includes owner)</div>
                      <div>Pending invites: {accountHierarchy.billing.pendingInvites}</div>
                      {accountHierarchy.billing.disabledMembers > 0 && (
                        <div>Disabled: {accountHierarchy.billing.disabledMembers}</div>
                      )}
                    </div>
                    <p>
                      <strong>Invoice Limit:</strong>{' '}
                      {isUnlimited ? 'Unlimited' : `${invoiceLimit} invoices/month`}
                    </p>
                    {stripeData?.current_period_start && (
                      <p>
                        <strong>Term Start:</strong> {formatDate(stripeData.current_period_start)}
                      </p>
                    )}
                    {(stripeData?.current_period_end || profile?.current_period_end) && (
                      <p>
                        <strong>{stripeData?.cancel_at_period_end ? 'Access Ends:' : 'Term End:'}</strong>{' '}
                        {formatDate(stripeData?.current_period_end || profile?.current_period_end || '')}
                      </p>
                    )}
                    {stripeData?.cancel_at_period_end && (
                      <Alert className="mt-2 border-amber-500/50 bg-amber-500/5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertDescription className="text-amber-700 text-sm">
                          Your subscription is set to cancel at the end of this billing period. 
                          You'll retain access until {formatDate(stripeData?.current_period_end || profile?.current_period_end || '')}.
                        </AlertDescription>
                      </Alert>
                    )}
                    {/* Monthly Charges Breakdown */}
                    <div className="pt-3 mt-3 border-t space-y-1">
                      <p className="font-semibold text-foreground">Monthly Charges</p>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Plan ({planConfig?.displayName || 'Free'})</span>
                        <span>{planConfig ? formatPrice(effectiveBillingInterval === 'year' ? planConfig.equivalentMonthly : planConfig.monthlyPrice) : '$0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Team Seats ({billableSeats})</span>
                        <span>
                          {formatPrice(
                            billableSeats * 
                            (effectiveBillingInterval === 'year' 
                              ? Math.round(SEAT_PRICING.annualPrice / 12) 
                              : SEAT_PRICING.monthlyPrice)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold pt-1 border-t border-dashed">
                        <span>Total</span>
                        <span className="text-primary">
                          {formatPrice(
                            (planConfig ? (effectiveBillingInterval === 'year' ? planConfig.equivalentMonthly : planConfig.monthlyPrice) : 0) +
                            (billableSeats * 
                              (effectiveBillingInterval === 'year' 
                                ? Math.round(SEAT_PRICING.annualPrice / 12) 
                                : SEAT_PRICING.monthlyPrice))
                          )}/mo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  {canManageBilling ? (
                    <>
                      {!profile?.stripe_subscription_id ? (
                        <Button onClick={() => navigate('/upgrade')} className="w-full">
                          Upgrade Plan
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => navigate('/upgrade')} className="w-full">
                          View Other Plans
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                      Only the account owner can manage subscription plans.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consumption & Upcoming Charges */}
          <ConsumptionTracker />

          {/* Monthly Usage Billing Log */}
          <UsageBillingLog />

          {/* Account Hierarchy - Visual Tree */}
          <AccountHierarchy />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              {isTeamMember && (
                <CardDescription>
                  Some actions are only available to the account owner.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  onClick={openCustomerPortal} 
                  disabled={!profile?.stripe_subscription_id || portalLoading || !canManageBilling}
                  title={!canManageBilling ? "Only the account owner can update payment methods" : undefined}
                >
                  Update Payment Method
                </Button>
                <Button 
                  variant="outline" 
                  onClick={openCustomerPortal} 
                  disabled={!profile?.stripe_subscription_id || portalLoading || !canManageBilling}
                  title={!canManageBilling ? "Only the account owner can view billing history" : undefined}
                >
                  View Billing History
                </Button>
                <Button 
                  variant="outline" 
                  onClick={openCustomerPortal} 
                  disabled={!profile?.stripe_subscription_id || portalLoading || !canManageBilling}
                  title={!canManageBilling ? "Only the account owner can download invoices" : undefined}
                >
                  Download Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Billing;
