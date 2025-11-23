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
    <div className="space-y-3">
      {/* Main Usage Display */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Invoice Usage</span>
          <Badge variant={usage.is_over_limit ? "destructive" : "secondary"} className="text-xs">
            {usage.plan_name}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{usage.total_invoices_used}</strong> / {usage.included_allowance} used
            </span>
            <span>{usage.remaining_quota} left</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                usage.is_over_limit ? 'bg-destructive' : 
                isNearLimit ? 'bg-orange-500' : 
                'bg-primary'
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>

          {usage.is_over_limit && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-destructive">
                Overages: {usage.overage_invoices} (${usage.overage_charges_total.toFixed(2)})
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Warning Alert - Near Limit or Over Limit */}
      {(isNearLimit || usage.is_over_limit) && (
        <Alert variant={usage.is_over_limit ? "destructive" : "default"} className="py-2">
          <AlertCircle className="h-3 w-3" />
          <AlertDescription className="flex items-center justify-between text-xs">
            <span className="flex-1 pr-2">
              {usage.is_over_limit ? "You've exceeded your plan limit" : "Approaching limit"}
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