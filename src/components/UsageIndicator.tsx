import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UsageData {
  plan: string;
  invoiceAllowance: number | string;
  includedUsed: number;
  overageCount: number;
  totalUsed: number;
  remaining: number | string;
  isOverLimit: boolean;
  overageRate: number;
  subscriptionStatus?: string;
}

interface TermData {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  billingInterval: string;
  cancelAtPeriodEnd: boolean;
}

export const UsageIndicator = () => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [term, setTerm] = useState<TermData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch usage data
      const { data, error } = await supabase.functions.invoke('get-monthly-usage');
      
      if (error) throw error;
      setUsage({
        plan: data.plan_name || 'free',
        invoiceAllowance: data.included_allowance,
        includedUsed: data.included_invoices_used,
        overageCount: data.overage_invoices,
        totalUsed: data.total_invoices_used,
        remaining: data.remaining_quota,
        isOverLimit: data.is_over_limit,
        overageRate: data.overage_rate || 1.5
      });

      // Fetch term data
      const { data: chargesData, error: chargesError } = await supabase.functions.invoke('get-upcoming-charges');
      if (!chargesError && chargesData?.subscription) {
        setTerm({
          currentPeriodStart: chargesData.subscription.current_period_start,
          currentPeriodEnd: chargesData.subscription.current_period_end,
          billingInterval: chargesData.subscription.billing_interval || 'month',
          cancelAtPeriodEnd: chargesData.subscription.cancel_at_period_end || false,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    
    // Refresh usage every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading || !usage) return null;

  const isUnlimited = usage.invoiceAllowance === 'Unlimited';
  const percentUsed = isUnlimited ? 0 : 
    typeof usage.invoiceAllowance === 'number' 
      ? (usage.includedUsed / usage.invoiceAllowance) * 100 
      : 0;
  const isNearLimit = percentUsed >= 80 && !usage.isOverLimit;

  return (
    <div className="space-y-3">
      {/* Main Usage Display */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Invoice Usage</span>
          <Badge variant={usage.isOverLimit ? "destructive" : "secondary"} className="text-xs capitalize">
            {usage.plan}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{usage.includedUsed}</strong> / {isUnlimited ? '∞' : usage.invoiceAllowance} used
            </span>
            <span>{isUnlimited ? 'Unlimited' : `${usage.remaining} left`}</span>
          </div>

          {/* Progress Bar */}
          {!isUnlimited && (
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all ${
                  usage.isOverLimit ? 'bg-destructive' : 
                  isNearLimit ? 'bg-orange-500' : 
                  'bg-primary'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          )}

          {usage.overageCount > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-destructive">
                Overages: {usage.overageCount} (${(usage.overageCount * usage.overageRate).toFixed(2)})
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Billing Term Info */}
      {term && term.currentPeriodEnd && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {term.cancelAtPeriodEnd ? 'Ends' : 'Renews'}: <strong className="text-foreground">{formatDateShort(term.currentPeriodEnd)}</strong>
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="capitalize">{term.billingInterval === 'year' ? 'Annual' : 'Monthly'}</span>
          </div>
        </div>
      )}

      {/* Warning Alert - Near Limit or Over Limit */}
      {(isNearLimit || usage.isOverLimit) && !isUnlimited && (
        <Alert variant={usage.isOverLimit ? "destructive" : "default"} className="py-2">
          <AlertCircle className="h-3 w-3" />
          <AlertDescription className="flex items-center justify-between text-xs">
            <span className="flex-1 pr-2">
              {usage.isOverLimit ? "You've exceeded your plan limit" : "Approaching limit"}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate('/upgrade')}
            >
              Upgrade
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
