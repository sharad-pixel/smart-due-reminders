import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { Skeleton } from '@/components/ui/skeleton';

interface SubscriptionGateProps {
  children: ReactNode;
  requiredPlan?: 'starter' | 'growth' | 'professional' | 'enterprise';
  feature?: string;
  fallback?: ReactNode;
}

export function SubscriptionGate({ 
  children, 
  requiredPlan = 'starter',
  feature,
  fallback 
}: SubscriptionGateProps) {
  const navigate = useNavigate();
  const { plan, isLoading, isSubscribed, isPastDue } = useSubscription();

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  // Handle past due subscriptions
  if (isPastDue) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Your payment is past due. Please update your payment method to continue.</span>
          <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
            Update Payment
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Plan hierarchy for access control
  const planHierarchy: Record<string, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    professional: 3,
    enterprise: 4,
  };

  const userPlanLevel = planHierarchy[plan] || 0;
  const requiredLevel = planHierarchy[requiredPlan] || 1;

  if (userPlanLevel < requiredLevel) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-6 rounded-lg border bg-card text-center">
        <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {feature ? `${feature} requires upgrade` : 'Upgrade Required'}
        </h3>
        <p className="text-muted-foreground mb-4">
          This feature requires the {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher.
        </p>
        <Button onClick={() => navigate('/upgrade')}>
          Upgrade Plan
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook for checking feature access without rendering
export function useFeatureAccess(requiredPlan: string = 'starter'): {
  hasAccess: boolean;
  isLoading: boolean;
  currentPlan: string;
} {
  const { plan, isLoading, isSubscribed } = useSubscription();

  const planHierarchy: Record<string, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    professional: 3,
    enterprise: 4,
  };

  const userPlanLevel = planHierarchy[plan] || 0;
  const requiredLevel = planHierarchy[requiredPlan] || 1;

  return {
    hasAccess: userPlanLevel >= requiredLevel,
    isLoading,
    currentPlan: plan,
  };
}
