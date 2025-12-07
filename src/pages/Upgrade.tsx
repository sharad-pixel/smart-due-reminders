import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ExternalLink, Loader2, Lock, Zap, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PLAN_CONFIGS, ANNUAL_DISCOUNT_RATE, formatPrice, SEAT_PRICING } from "@/lib/subscriptionConfig";

const Upgrade = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { role, loading: roleLoading, canManageBilling } = useUserRole();

  useEffect(() => {
    loadCurrentSubscription();
  }, []);

  const loadCurrentSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_type, subscription_status, billing_interval')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCurrentPlan(profile.plan_type || 'free');
        setSubscriptionStatus(profile.subscription_status);
        if (profile.billing_interval === 'year') {
          setIsAnnual(true);
        }
      }
    } catch (error: any) {
      console.error('Error loading subscription:', error);
      toast.error("Failed to load subscription info");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planType: string) => {
    if (planType === 'enterprise') {
      navigate('/contact-us');
      return;
    }

    setProcessingPlan(planType);
    try {
      // If user has active subscription, open customer portal to change plan
      if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
        const { data, error } = await supabase.functions.invoke('customer-portal');
        
        if (error) throw error;
        
        if (data?.url) {
          window.open(data.url, '_blank');
          toast.success("Stripe portal opened - you can change your plan there");
        }
        return;
      }

      // New subscription checkout
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          planId: planType,
          billingInterval: isAnnual ? 'year' : 'month'
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success("Checkout opened in new tab");
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setProcessingPlan('manage');
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success("Stripe portal opened in new tab");
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || "Failed to open billing portal");
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-6xl py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Access control: Only owners and admins can manage billing
  if (!canManageBilling) {
    return (
      <Layout>
        <div className="container mx-auto max-w-4xl py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Billing & Plan Management
              </CardTitle>
              <CardDescription>
                Upgrade plans and manage your billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Restricted</AlertTitle>
                <AlertDescription>
                  Only account owners and administrators can manage billing and plans.
                  Please contact your account owner or admin to upgrade the plan.
                </AlertDescription>
              </Alert>
              <Button onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const plans = [
    { key: 'starter', ...PLAN_CONFIGS.starter, icon: Sparkles, popular: false },
    { key: 'growth', ...PLAN_CONFIGS.growth, icon: Zap, popular: true },
    { key: 'professional', ...PLAN_CONFIGS.professional, icon: Crown, popular: false },
  ];

  const discountPercent = Math.round(ANNUAL_DISCOUNT_RATE * 100);

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upgrade Your Plan</h1>
          <p className="text-muted-foreground">
            {currentPlan === 'free' 
              ? "You're on the Free plan with 15 invoices. Upgrade to unlock more."
              : `You're on the ${currentPlan} plan`}
          </p>
        </div>

        {/* Current Subscription Card */}
        {(subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Current Plan: <span className="capitalize">{currentPlan}</span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {subscriptionStatus === 'trialing' ? (
                      <Badge variant="secondary">Trial Active</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600">Active</Badge>
                    )}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleManageSubscription}
                  disabled={processingPlan === 'manage'}
                  variant="outline"
                >
                  {processingPlan === 'manage' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <Label htmlFor="billing-toggle" className={!isAnnual ? "font-semibold" : "text-muted-foreground"}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <Label htmlFor="billing-toggle" className={isAnnual ? "font-semibold" : "text-muted-foreground"}>
            Annual
          </Label>
          {isAnnual && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              Save {discountPercent}%
            </Badge>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.key;
            const Icon = plan.icon;
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
            const period = isAnnual ? '/year' : '/month';

            return (
              <Card 
                key={plan.key}
                className={`relative flex flex-col ${
                  isCurrentPlan 
                    ? "border-primary ring-2 ring-primary" 
                    : plan.popular 
                      ? "border-primary/50 shadow-lg" 
                      : ""
                }`}
              >
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Zap className="h-3 w-3 mr-1" /> Most Popular
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600 text-white">
                      Your Plan
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{formatPrice(price)}</span>
                      <span className="text-muted-foreground">{period}</span>
                    </div>
                    {isAnnual && (
                      <p className="text-xs text-green-600">
                        {formatPrice(plan.equivalentMonthly)}/mo equivalent
                      </p>
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    Up to {plan.invoiceLimit} invoices/month
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.slice(0, 6).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted/50 rounded">
                    <p>+$1.50 per invoice over limit</p>
                    <p>+{formatPrice(isAnnual ? SEAT_PRICING.annualPrice : SEAT_PRICING.monthlyPrice)}/seat{isAnnual ? '/year' : '/month'}</p>
                  </div>
                  
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={isCurrentPlan || processingPlan === plan.key}
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {processingPlan === plan.key ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : subscriptionStatus === 'active' ? (
                      "Switch Plan"
                    ) : (
                      "Start 14-Day Trial"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enterprise Card */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Enterprise / Custom
            </CardTitle>
            <CardDescription>
              For high-volume operations with custom integration needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <ul className="grid sm:grid-cols-2 gap-2">
                {PLAN_CONFIGS.enterprise.features.slice(0, 4).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() => navigate("/contact-us")}
                className="shrink-0"
              >
                Contact Sales
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Upgrade;