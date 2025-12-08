import { useState, useEffect } from "react";
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
import { PLAN_CONFIGS, SEAT_PRICING, ANNUAL_DISCOUNT_RATE, formatPrice, type PlanType } from "@/lib/subscriptionConfig";

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
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profile?: {
    display_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

const Billing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_type, invoice_limit, billing_interval, subscription_status, current_period_end, stripe_subscription_id')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch team members for this account
      const { data: accountUserData } = await supabase
        .from('account_users')
        .select(`
          id,
          user_id,
          role,
          status,
          profiles:user_id (
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('status', 'active');

      if (accountUserData) {
        const members = accountUserData.map((au: any) => ({
          id: au.id,
          user_id: au.user_id,
          role: au.role,
          status: au.status,
          profile: au.profiles
        }));
        setTeamMembers(members);
      }

      // Fetch usage
      const { data: usageData, error: usageError } = await supabase.functions.invoke('get-monthly-usage');
      if (!usageError && usageData) {
        setUsage(usageData);
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          {profile?.stripe_subscription_id && (
            <Button onClick={openCustomerPortal} disabled={portalLoading}>
              <CreditCard className="w-4 h-4 mr-2" />
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {profile?.subscription_status === 'past_due' && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your payment is past due. Please update your payment method to continue using all features.
              <Button variant="link" className="p-0 ml-2" onClick={openCustomerPortal}>
                Update Payment Method
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
                    <p>
                      <strong>Invoice Limit:</strong>{' '}
                      {isUnlimited ? 'Unlimited' : `${invoiceLimit} invoices/month`}
                    </p>
                    {profile?.current_period_end && (
                      <p>
                        <strong>Term End:</strong> {formatDate(profile.current_period_end)}
                      </p>
                    )}
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground">
                        <strong>Team Seat Pricing:</strong>{' '}
                        {profile?.billing_interval === 'year' 
                          ? `${formatPrice(SEAT_PRICING.annualPrice)}/user/year (${Math.round(ANNUAL_DISCOUNT_RATE * 100)}% off)`
                          : `${formatPrice(SEAT_PRICING.monthlyPrice)}/user/month`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              <div className="flex flex-col justify-center">
                  {!profile?.stripe_subscription_id ? (
                    <Button onClick={() => navigate('/upgrade')} className="w-full">
                      Upgrade to Paid Plan
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => navigate('/upgrade')} className="w-full">
                      View Other Plans
                    </Button>
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

          {/* Team Members on Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Members
              </CardTitle>
              <CardDescription>
                Users on your account ({teamMembers.length} active seat{teamMembers.length !== 1 ? 's' : ''})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamMembers.length > 0 ? (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {(member.profile?.display_name || member.profile?.email || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.profile?.display_name || 'Team Member'}</p>
                          <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{member.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No additional team members on this account
                </p>
              )}
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/settings')}
              >
                Manage Team
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button variant="outline" onClick={openCustomerPortal} disabled={!profile?.stripe_subscription_id || portalLoading}>
                  Update Payment Method
                </Button>
                <Button variant="outline" onClick={openCustomerPortal} disabled={!profile?.stripe_subscription_id || portalLoading}>
                  View Billing History
                </Button>
                <Button variant="outline" onClick={openCustomerPortal} disabled={!profile?.stripe_subscription_id || portalLoading}>
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
