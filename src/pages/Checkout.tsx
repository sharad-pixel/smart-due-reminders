import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import recouplyLogoHeader from "@/assets/recouply-logo-header.png";

// Stripe plan configuration
const STRIPE_PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    priceId: 'price_1SX2cyFaeMMSBqclAGkxSliI',
    productId: 'prod_TU0eI8uJBt4uFu',
    price: 99,
    description: '50 invoices per month with AI-powered collections',
    features: [
      "Up to 50 invoices per month",
      "AI email reminders",
      "Manual SMS sending",
      "Stripe payment link embedding",
      "Dashboard analytics"
    ]
  },
  {
    id: 'growth',
    name: 'Growth Plan',
    priceId: 'price_1SX2dkFaeMMSBqclPIjUA6N2',
    productId: 'prod_TU0f7AKZA4QVKe',
    price: 199,
    description: '200 invoices per month with AI-powered collections',
    features: [
      "Up to 200 invoices per month",
      "Full AI cadence automation",
      "Automated SMS sending",
      "Promise-to-pay tracking",
      "Multi-user support"
    ]
  },
  {
    id: 'professional',
    name: 'Professional Plan',
    priceId: 'price_1SX2duFaeMMSBqclrYq4rikr',
    productId: 'prod_TU0fTQf4l1UgT9',
    price: 399,
    description: '500 invoices per month with AI-powered collections and team features',
    features: [
      "Unlimited invoices",
      "Team permissions",
      "Priority AI throughput",
      "Advanced CRM integration",
      "Dedicated support"
    ]
  }
];

const Checkout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

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
          <img 
            src={recouplyLogoHeader} 
            alt="Recouply.ai" 
            className="h-12 w-auto mx-auto mb-2"
          />
          <p className="text-muted-foreground">Complete your plan setup</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
            <CardDescription>
              You're starting a 14-day free trial of the {plan.name} plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">14-day free trial, then:</p>
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
              <p>✓ Your card will not be charged during the 14-day trial</p>
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
