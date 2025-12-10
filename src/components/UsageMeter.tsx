import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
}

interface UsageMeterProps {
  compact?: boolean;
}

const UsageMeter = ({ compact = false }: UsageMeterProps) => {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }


      const { data, error } = await supabase.functions.invoke('get-monthly-usage');
      if (!error && data) {
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
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage) return null;

  const isUnlimited = usage.invoiceAllowance === 'Unlimited';
  const percentUsed = isUnlimited ? 0 : 
    typeof usage.invoiceAllowance === 'number' 
      ? Math.min(100, (usage.includedUsed / usage.invoiceAllowance) * 100)
      : 0;
  const isNearLimit = percentUsed >= 80;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Invoices:</span>
        <span className={isNearLimit && !isUnlimited ? "text-amber-600 font-medium" : ""}>
          {usage.includedUsed}/{isUnlimited ? '∞' : usage.invoiceAllowance}
        </span>
        {usage.overageCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            +{usage.overageCount} overage
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Monthly Usage</span>
        </div>
        <Badge variant="outline" className="capitalize">
          {usage.plan}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            {usage.includedUsed} / {isUnlimited ? '∞' : usage.invoiceAllowance} invoices
          </span>
          {!isUnlimited && typeof usage.remaining === 'number' && (
            <span className="text-muted-foreground">
              {usage.remaining} left
            </span>
          )}
        </div>

        {!isUnlimited && (
          <Progress 
            value={percentUsed} 
            className={`h-2 ${isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
          />
        )}

        {usage.overageCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 mt-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {usage.overageCount} overage invoices (${(usage.overageCount * usage.overageRate).toFixed(2)})
            </span>
          </div>
        )}

        {isNearLimit && !isUnlimited && (
          <Button 
            variant="link" 
            className="p-0 h-auto text-sm"
            onClick={() => navigate('/upgrade')}
          >
            Upgrade for more invoices →
          </Button>
        )}
      </div>
    </div>
  );
};

export default UsageMeter;
