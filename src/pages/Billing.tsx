import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, ExternalLink, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLAN_CONFIGS, type PlanType } from "@/lib/subscriptionConfig";

interface UsageData {
  plan: string;
  invoiceAllowance: number | string;
  includedUsed: number;
  overageCount: number;
  totalUsed: number;
  remaining: number | string;
  isOverLimit: boolean;
  overageRate: number;
  subscriptionStatus: string;
}

interface ProfileData {
  plan_type: string;
  invoice_limit: number;
  billing_interval: string;
  subscription_status: string;
  current_period_end: string;
  stripe_subscription_id: string;
}

const Billing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

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

      // Fetch profile - use any to bypass type checking for dynamic columns
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_type, invoice_limit, billing_interval, subscription_status, current_period_end, stripe_subscription_id')
        .eq('id', session.user.id)
        .single() as { data: ProfileData | null; error: any };

      if (profileData) {
        setProfile(profileData);
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
  const usagePercent = usage && typeof usage.invoiceAllowance === 'number' 
    ? Math.min(100, (usage.includedUsed / usage.invoiceAllowance) * 100)
    : 0;

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
                    <p className="text-muted-foreground mb-4">
                      ${profile?.billing_interval === 'year' 
                        ? Math.round(planConfig.annualPrice / 12) 
                        : planConfig.monthlyPrice}/month
                      {profile?.billing_interval === 'year' && (
                        <span className="text-green-600 ml-2">(billed annually)</span>
                      )}
                    </p>
                  )}
                  <div className="space-y-2 text-sm">
                    <p><strong>Invoice Limit:</strong> {profile?.invoice_limit === -1 ? 'Unlimited' : `${profile?.invoice_limit || 5} invoices/month`}</p>
                    <p><strong>Billing Cycle:</strong> {profile?.billing_interval === 'year' ? 'Annual' : 'Monthly'}</p>
                    {profile?.current_period_end && (
                      <p><strong>Next Billing Date:</strong> {formatDate(profile.current_period_end)}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  {!profile?.stripe_subscription_id ? (
                    <Button onClick={() => navigate('/pricing')} className="w-full">
                      Upgrade to Paid Plan
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => navigate('/pricing')} className="w-full">
                      View Other Plans
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Usage</CardTitle>
              <CardDescription>
                Track your invoice usage for the current billing period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usage ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">
                        Invoices Used: {usage.includedUsed} / {usage.invoiceAllowance}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {typeof usage.remaining === 'number' ? `${usage.remaining} remaining` : usage.remaining}
                      </span>
                    </div>
                    <Progress value={usagePercent} className="h-3" />
                  </div>

                  {usage.overageCount > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        You have {usage.overageCount} overage invoice(s) this period. 
                        These will be billed at ${usage.overageRate.toFixed(2)} each (${(usage.overageCount * usage.overageRate).toFixed(2)} total).
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{usage.includedUsed}</p>
                      <p className="text-sm text-muted-foreground">Included</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{usage.overageCount}</p>
                      <p className="text-sm text-muted-foreground">Overage</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{usage.totalUsed}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No usage data available</p>
              )}
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
