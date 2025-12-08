import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, ExternalLink, AlertTriangle, CheckCircle, Clock, Calendar, TrendingUp, Users, UserPlus, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLAN_CONFIGS, SEAT_PRICING, ANNUAL_DISCOUNT_RATE, formatPrice, type PlanType } from "@/lib/subscriptionConfig";
import { AccountHierarchy } from "@/components/AccountHierarchy";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

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
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  is_owner: boolean;
  profile?: {
    display_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

const Billing = () => {
  const navigate = useNavigate();
  const effectiveAccount = useEffectiveAccount();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stripeData, setStripeData] = useState<StripeSubscriptionData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [billingDiscrepancy, setBillingDiscrepancy] = useState<{
    dbSeats: number;
    stripeSeats: number;
    discrepancy: number;
    needsReconciliation: boolean;
  } | null>(null);

  useEffect(() => {
    // Wait for effective account to load before loading billing data
    if (!effectiveAccount.loading) {
      loadBillingData();
    }
  }, [effectiveAccount.loading, effectiveAccount.effectiveAccountId]);

  // Check for billing discrepancy on load
  const checkBillingDiscrepancy = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-billing-reconcile', {
        body: { action: 'preview' }
      });
      if (!error && data) {
        setBillingDiscrepancy(data);
      }
    } catch (error) {
      console.error('Error checking billing discrepancy:', error);
    }
  };

  const handleReconcileBilling = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-billing-reconcile', {
        body: { action: 'reconcile' }
      });
      if (error) throw error;
      
      if (data?.success) {
        toast.success(data.message || 'Billing synced successfully');
        setBillingDiscrepancy(null);
        loadBillingData();
      } else {
        toast.error(data?.error || 'Failed to sync billing');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync billing');
    } finally {
      setReconciling(false);
    }
  };

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

      // Fetch team members for this account (filter by account_id)
      const { data: accountUserData } = await supabase
        .from('account_users')
        .select(`
          id,
          user_id,
          role,
          status,
          is_owner,
          profiles:user_id (
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('account_id', accountId)
        .in('status', ['active', 'pending']);

      if (accountUserData) {
        const members = accountUserData.map((au: any) => ({
          id: au.id,
          user_id: au.user_id,
          role: au.role,
          status: au.status,
          is_owner: au.is_owner,
          profile: au.profiles
        }));
        setTeamMembers(members);
      }

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

      // Check for billing discrepancy after loading data
      await checkBillingDiscrepancy();
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

  const getStatusBadge = (status: string) => {
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

  if (loading) {
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

  const planConfig = profile ? getPlanConfig(profile.plan_type) : null;
  
  // Derive invoice limit from usage data (source of truth) or plan config
  const invoiceLimit = usage?.included_allowance ?? planConfig?.invoiceLimit ?? 15;
  const isUnlimited = invoiceLimit === -1 || invoiceLimit === 'Unlimited';
  const invoicesUsed = usage?.included_invoices_used ?? 0;

  // Display effective account info for team members
  const isTeamMember = effectiveAccount.isTeamMember;
  const canManageBilling = !isTeamMember; // Only account owners can manage billing

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

        {/* Team Member Notice */}
        {isTeamMember && (
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
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {(effectiveAccount.ownerName || effectiveAccount.ownerEmail || 'O')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{effectiveAccount.ownerName || 'Account Owner'}</p>
                  <p className="text-sm text-muted-foreground">{effectiveAccount.ownerCompanyName || effectiveAccount.ownerEmail}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize">
                      {effectiveAccount.ownerPlanType || 'free'} plan
                    </Badge>
                    {effectiveAccount.ownerSubscriptionStatus === 'active' ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{effectiveAccount.ownerSubscriptionStatus || 'inactive'}</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      Your role: {effectiveAccount.memberRole || 'member'}
                    </Badge>
                  </div>
                </div>
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

        {/* Billing Discrepancy Warning */}
        {billingDiscrepancy?.needsReconciliation && (
          <Alert className="mb-6 border-amber-500/50 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-700">
                Billing discrepancy detected: {billingDiscrepancy.dbSeats} seats in database but {billingDiscrepancy.stripeSeats} in Stripe.
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleReconcileBilling}
                disabled={reconciling}
                className="ml-4 border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${reconciling ? 'animate-spin' : ''}`} />
                {reconciling ? 'Syncing...' : 'Sync Billing'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Current Plan
                {profile && getStatusBadge(profile.subscription_status)}
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
                      {profile?.billing_interval === 'year' ? (
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
                        {profile?.billing_interval === 'year' ? 'Annual' : 'Monthly'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>Team Seats:</strong>{' '}
                        {billingDiscrepancy?.dbSeats ?? teamMembers.filter(m => !m.is_owner && m.status === 'active').length} seat(s)
                        {billingDiscrepancy && billingDiscrepancy.stripeSeats !== billingDiscrepancy.dbSeats && (
                          <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-600">
                            Stripe: {billingDiscrepancy.stripeSeats}
                          </Badge>
                        )}
                      </span>
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
                        <strong>Term End:</strong> {formatDate(stripeData?.current_period_end || profile?.current_period_end || '')}
                      </p>
                    )}
                    {/* Monthly Charges Breakdown */}
                    <div className="pt-3 mt-3 border-t space-y-1">
                      <p className="font-semibold text-foreground">Monthly Charges</p>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Plan ({planConfig?.displayName || 'Free'})</span>
                        <span>{planConfig ? formatPrice(profile?.billing_interval === 'year' ? planConfig.equivalentMonthly : planConfig.monthlyPrice) : '$0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Team Seats ({billingDiscrepancy?.dbSeats ?? teamMembers.filter(m => !m.is_owner && m.status === 'active').length})</span>
                        <span>
                          {formatPrice(
                            (billingDiscrepancy?.dbSeats ?? teamMembers.filter(m => !m.is_owner && m.status === 'active').length) * 
                            (profile?.billing_interval === 'year' 
                              ? Math.round(SEAT_PRICING.annualPrice / 12) 
                              : SEAT_PRICING.monthlyPrice)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold pt-1 border-t border-dashed">
                        <span>Total</span>
                        <span className="text-primary">
                          {formatPrice(
                            (planConfig ? (profile?.billing_interval === 'year' ? planConfig.equivalentMonthly : planConfig.monthlyPrice) : 0) +
                            ((billingDiscrepancy?.dbSeats ?? teamMembers.filter(m => !m.is_owner && m.status === 'active').length) * 
                              (profile?.billing_interval === 'year' 
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
                          Upgrade to Paid Plan
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

          {/* Usage */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Usage
              </CardTitle>
              <CardDescription>
                Track your invoice usage for the current billing period
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Colorful Gauge */}
                <UsageGauge 
                  used={invoicesUsed}
                  limit={typeof invoiceLimit === 'number' ? invoiceLimit : 0}
                  isUnlimited={isUnlimited}
                />
                
                {/* Stats */}
                <div className="flex-1 w-full">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-2xl font-bold text-blue-600">
                        {isUnlimited ? '∞' : invoiceLimit}
                      </p>
                      <p className="text-sm text-muted-foreground">Plan Limit</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-2xl font-bold text-green-600">{invoicesUsed}</p>
                      <p className="text-sm text-muted-foreground">Used</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-2xl font-bold text-amber-600">{usage?.overage_invoices ?? 0}</p>
                      <p className="text-sm text-muted-foreground">Overage</p>
                    </div>
                  </div>
                  
                  {!isUnlimited && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining this period</span>
                        <span className="font-medium">
                          {usage?.remaining_quota ?? (typeof invoiceLimit === 'number' ? invoiceLimit - invoicesUsed : 0)} invoices
                        </span>
                      </div>
                    </div>
                  )}

                  {(usage?.overage_invoices ?? 0) > 0 && (
                    <Alert className="mt-4 border-amber-500/50 bg-amber-500/5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-amber-700">
                        You have {usage?.overage_invoices} overage invoice(s) this period. 
                        These will be billed at ${(usage?.overage_rate ?? 1.5).toFixed(2)} each 
                        (${((usage?.overage_invoices ?? 0) * (usage?.overage_rate ?? 1.5)).toFixed(2)} total).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                <Button 
                  variant="outline" 
                  onClick={handleReconcileBilling}
                  disabled={reconciling || !profile?.stripe_subscription_id || !canManageBilling}
                  title={!canManageBilling ? "Only the account owner can sync billing" : undefined}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${reconciling ? 'animate-spin' : ''}`} />
                  {reconciling ? 'Syncing...' : 'Sync Billing'}
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
