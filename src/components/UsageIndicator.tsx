import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UsageData {
  month: string;
  included_allowance: number;
  included_invoices_used: number;
  overage_invoices: number;
  overage_charges_total: number;
  total_invoices_used: number;
  remaining_quota: number;
  is_over_limit: boolean;
  plan_name: string;
  overage_rate: number;
}

export const UsageIndicator = () => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('get-monthly-usage');
      
      if (error) throw error;
      setUsage(data);
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

  if (loading || !usage) return null;

  const percentUsed = (usage.total_invoices_used / usage.included_allowance) * 100;
  const isNearLimit = percentUsed >= 80 && !usage.is_over_limit;

  return (
    <div className="space-y-4">
      {/* Main Usage Display */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Invoice Usage This Month</h3>
          <Badge variant={usage.is_over_limit ? "destructive" : "secondary"}>
            {usage.plan_name}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {usage.is_over_limit ? (
                <>You've used <strong>{usage.total_invoices_used}</strong> of <strong>{usage.included_allowance}</strong> included invoices</>
              ) : (
                <>You've used <strong>{usage.total_invoices_used}</strong> of <strong>{usage.included_allowance}</strong> invoices</>
              )}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                usage.is_over_limit ? 'bg-destructive' : 
                isNearLimit ? 'bg-orange-500' : 
                'bg-primary'
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>

          {usage.is_over_limit && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-destructive">
                Overages this month: {usage.overage_invoices} (${usage.overage_charges_total.toFixed(2)})
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Additional invoices are billed at ${usage.overage_rate.toFixed(2)} each
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Warning Alert - Near Limit */}
      {isNearLimit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>You're approaching your invoice limit for this month.</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/upgrade')}
            >
              Upgrade Plan
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Overage Alert */}
      {usage.is_over_limit && (
        <Alert variant="destructive">
          <TrendingUp className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="font-medium">You've exceeded your plan limit</p>
              <p className="text-sm mt-1">
                {usage.plan_name === 'Starter' && 'Upgrade to Growth (200 invoices) or Professional (500 invoices)'}
                {usage.plan_name === 'Growth' && 'Upgrade to Professional for 500 included invoices per month'}
                {usage.plan_name === 'Professional' && 'Consider our Bespoke plan for unlimited invoices'}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
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