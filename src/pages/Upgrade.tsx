import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ExternalLink, Loader2, Lock, Zap, Crown, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PLAN_CONFIGS, ANNUAL_DISCOUNT_RATE, formatPrice, SEAT_PRICING } from "@/lib/subscriptionConfig";

const Upgrade = () => {
  const navigate = useNavigate();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { role, loading: roleLoading, canManageBilling } = useUserRole();
  const { 
    plan: currentPlan, 
    subscriptionStatus, 
    hasUsedTrial,
    isTrial,
    trialEndsAt,
    isAccountOwner,
    canUpgrade,
    isLoading: subscriptionLoading,
    billingInterval,
    refresh: refreshSubscription
  } = useSubscription();

  useEffect(() => {
    if (billingInterval === 'year') {
      setIsAnnual(true);
    }
  }, [billingInterval]);

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
        
        // Show appropriate message based on trial eligibility
        if (data.hasTrial) {
          toast.success("Checkout opened - Start your 14-day free trial!");
        } else {
          toast.success("Checkout opened in new tab");
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setProcessingPlan(null);
      // Refresh subscription status after checkout attempt
      setTimeout(() => refreshSubscription(), 2000);
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

  if (subscriptionLoading || roleLoading) {
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

  // Team members can't upgrade - only account owners
  if (!isAccountOwner || !canUpgrade) {
    return (
      <Layout>
        <div className="container mx-auto max-w-4xl py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Subscription Management
              </CardTitle>
              <CardDescription>
                Manage your team's subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Team Member Account</AlertTitle>
                <AlertDescription>
                  You're part of a team account. Subscription management is handled by your account owner.
                  Please contact your account administrator to upgrade or change the plan.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate("/team")}>
                  View Team
                </Button>
              </div>
            </CardContent>
          </Card>
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
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Restricted</AlertTitle>
                <AlertDescription>
                  Only account owners and administrators can manage billing and plans.
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
  const isOnFreePlan = currentPlan === 'free';
  const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

  // Calculate trial end date for display
  const trialEndDate = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : null;

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {isOnFreePlan ? "Upgrade Your Plan" : "Manage Your Plan"}
          </h1>
          <p className="text-muted-foreground">
            {isOnFreePlan 
              ? `You're on the Free plan with ${15} invoices. Upgrade to unlock more.`
              : `You're on the ${currentPlan} plan`}
          </p>
        </div>

        {/* Trial eligibility notice */}
        {isOnFreePlan && !hasUsedTrial && (
          <Alert className="mb-6 border-green-500/50 bg-green-50 dark:bg-green-950/20">
            <Sparkles className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700 dark:text-green-400">14-Day Free Trial Available!</AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-300">
              Start any paid plan with a 14-day free trial. No charge until your trial ends.
            </AlertDescription>
          </Alert>
        )}

        {/* Trial already used notice */}
        {isOnFreePlan && hasUsedTrial && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Trial Previously Used</AlertTitle>
            <AlertDescription>
              You've already used your free trial. Upgrading will start billing immediately.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Subscription Card */}
        {hasActiveSubscription && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Current Plan: <span className="capitalize">{currentPlan}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    {isTrial ? (
                      <>
                        <Badge variant="secondary">Trial Active</Badge>
                        {trialEndDate && <span className="text-sm">Ends {trialEndDate}</span>}
                      </>
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
                    ) : hasActiveSubscription ? (
                      "Switch Plan"
                    ) : hasUsedTrial ? (
                      "Subscribe Now"
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