import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ExternalLink, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Upgrade = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processingPortal, setProcessingPortal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const { role, loading: roleLoading, canManageBilling } = useUserRole();

  useEffect(() => {
    loadPlansAndCurrentSubscription();
  }, []);

  const loadPlansAndCurrentSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      // Load all plans
      const { data: plans } = await supabase
        .from('plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      setAllPlans(plans || []);

      // Load user's current plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_id, plans(*), trial_ends_at, stripe_subscription_id')
        .eq('id', user.id)
        .single();

      if (profile?.plans) {
        setCurrentPlan(profile.plans);
      }
    } catch (error: any) {
      console.error('Error loading plans:', error);
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setProcessingPortal(true);
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
      setProcessingPortal(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-6xl py-12">
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
        <div className="container mx-auto max-w-4xl py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Billing & Subscription Management
              </CardTitle>
              <CardDescription>
                Upgrade plans and manage your subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Restricted</AlertTitle>
                <AlertDescription>
                  Only account owners and administrators can manage billing and subscriptions.
                  {role === 'member' && " Please contact your account owner or admin to upgrade the plan."}
                  {role === 'viewer' && " You have view-only access. Please contact your account owner or admin for subscription changes."}
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-border bg-muted/50 p-6">
                <h3 className="text-lg font-semibold mb-2">Your Current Role: {role}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {role === 'member' && "Members can create and manage invoices, debtors, and workflows, but cannot manage billing."}
                  {role === 'viewer' && "Viewers have read-only access to view data but cannot make changes or manage billing."}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => navigate("/dashboard")}>
                    Go to Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/team")}>
                    View Team Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const selfServePlans = allPlans.filter(p => p.name !== 'bespoke');

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Manage Your Subscription</h1>
          <p className="text-xl text-muted-foreground">
            {currentPlan 
              ? `You're currently on the ${currentPlan.name} plan`
              : "Choose a plan to get started"}
          </p>
        </div>

        {currentPlan && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle>Current Plan: {currentPlan.name}</CardTitle>
              <CardDescription>
                Manage your subscription, update payment method, or change plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleManageSubscription}
                disabled={processingPortal}
                size="lg"
              >
                {processingPortal ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opening Portal...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {selfServePlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const featureFlags = plan.feature_flags as any;

            return (
              <Card 
                key={plan.id}
                className={isCurrentPlan ? "border-primary ring-2 ring-primary" : ""}
              >
                <CardHeader>
                  {isCurrentPlan && (
                    <div className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full w-fit mb-2">
                      Your Plan
                    </div>
                  )}
                  <CardTitle className="text-2xl capitalize">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold">${plan.monthly_price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {plan.invoice_limit ? `Up to ${plan.invoice_limit} invoices/month` : "Unlimited invoices"}
                      </span>
                    </div>
                    {featureFlags.sms_auto && (
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Automated SMS</span>
                      </div>
                    )}
                    {featureFlags.cadence_automation && (
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">AI Cadence Automation</span>
                      </div>
                    )}
                    {featureFlags.crm && (
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">CRM Integration</span>
                      </div>
                    )}
                    {featureFlags.team_users && (
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Multi-user Support</span>
                      </div>
                    )}
                  </div>
                  
                  {!isCurrentPlan && (
                    <Button
                      variant={isCurrentPlan ? "outline" : "default"}
                      className="w-full"
                      onClick={handleManageSubscription}
                      disabled={!currentPlan}
                    >
                      {currentPlan ? "Switch to this plan" : "Get Started"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Need a Custom Solution?</CardTitle>
            <CardDescription>
              Our Bespoke plan is perfect for high-volume SaaS companies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate("/contact-us")}
            >
              Contact Us for Bespoke Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Upgrade;
