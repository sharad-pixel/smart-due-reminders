import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { STRIPE_PRICES, STRIPE_PRODUCTS, PLAN_CONFIGS } from "@/lib/subscriptionConfig";

// Stripe plan configuration — Credit Economy v2 (Jun 2026)
const STRIPE_PLANS = [
  {
    id: 'launch',
    name: PLAN_CONFIGS.launch.displayName,
    priceId: STRIPE_PRICES.monthly.launch,
    productId: STRIPE_PRODUCTS.launch,
    price: PLAN_CONFIGS.launch.monthlyPrice,
    description: `${PLAN_CONFIGS.launch.creditAllotment} credits/month — Live Contracts $5/contract/mo add-on`,
    features: PLAN_CONFIGS.launch.features,
  },
  {
    id: 'starter',
    name: PLAN_CONFIGS.starter.displayName,
    priceId: STRIPE_PRICES.monthly.starter,
    productId: STRIPE_PRODUCTS.starter,
    price: PLAN_CONFIGS.starter.monthlyPrice,
    description: `${PLAN_CONFIGS.starter.creditAllotment} credits/month · ${PLAN_CONFIGS.starter.includedContracts} live contracts included`,
    features: PLAN_CONFIGS.starter.features,
  },
  {
    id: 'growth',
    name: PLAN_CONFIGS.growth.displayName,
    priceId: STRIPE_PRICES.monthly.growth,
    productId: STRIPE_PRODUCTS.growth,
    price: PLAN_CONFIGS.growth.monthlyPrice,
    description: `${PLAN_CONFIGS.growth.creditAllotment} credits/month · ${PLAN_CONFIGS.growth.includedContracts} live contracts included`,
    features: PLAN_CONFIGS.growth.features,
  },
  {
    id: 'professional',
    name: PLAN_CONFIGS.professional.displayName,
    priceId: STRIPE_PRICES.monthly.professional,
    productId: STRIPE_PRODUCTS.professional,
    price: PLAN_CONFIGS.professional.monthlyPrice,
    description: `${PLAN_CONFIGS.professional.creditAllotment} credits/month · ${PLAN_CONFIGS.professional.includedContracts} live contracts included`,
    features: PLAN_CONFIGS.professional.features,
  },
];

const Checkout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [_user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserAndPlan();
  }, []);

  const loadUserAndPlan = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        toast.error("Please sign in to continue");
        navigate("/login");
        return;
      }

      setUser(currentUser);

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('id', currentUser.id)
        .single();

      if (!profile?.plan_type) {
        toast.error("No plan selected");
        navigate("/pricing");
        return;
      }

      const selectedPlan = STRIPE_PLANS.find(p => p.id === profile.plan_type);
      if (!selectedPlan) {
        toast.error("Invalid plan");
        navigate("/pricing");
        return;
      }

      setPlan(selectedPlan);
    } catch (error: any) {
      console.error('Error loading plan:', error);
      toast.error("Failed to load plan details");
      navigate("/pricing");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setProcessingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId: plan.id }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success("Checkout opened in new tab");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setProcessingCheckout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Recouply.ai</h1>
          <p className="text-muted-foreground">Complete your plan setup</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
            <CardDescription>
              You're starting a 7-day free trial of the {plan.name} plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">7-day free trial, then:</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">${plan.price}</div>
                  <div className="text-sm text-muted-foreground">/month</div>
                </div>
              </div>

              <div className="space-y-2">
                {plan.features.map((feature: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>✓ Your card will not be charged during the 7-day trial</p>
              <p>✓ Cancel anytime from your account settings</p>
              <p>✓ After trial, ${plan.price}/month unless canceled</p>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleCheckout}
              disabled={processingCheckout}
            >
              {processingCheckout ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening Checkout...
                </>
              ) : (
                "Continue to Payment"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Powered by Stripe. Your payment information is secure and encrypted.
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button
            variant="link"
            onClick={() => navigate("/pricing")}
            className="text-muted-foreground"
          >
            ← Back to Pricing
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
