import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, LucideIcon } from 'lucide-react';

interface SyncMetricCardProps {
  icon: LucideIcon;
  label: string;
  total: number;
  delta?: number;
  status?: 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

export const SyncMetricCard = ({ 
  icon: Icon, 
  label, 
  total, 
  delta,
  status = 'neutral',
  className 
}: SyncMetricCardProps) => {
  const getStatusIcon = () => {
    if (delta === undefined) return null;
    
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-amber-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getDeltaColor = () => {
    if (delta === undefined) return '';
    if (delta > 0) return 'text-green-600';
    if (status === 'error') return 'text-red-600';
    if (status === 'warning') return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <div className={cn("p-3 bg-muted/50 rounded-lg", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      
      {/* Delta from last sync */}
      {delta !== undefined && (
        <div className={cn("flex items-center gap-1 text-xs mb-0.5", getDeltaColor())}>
          {delta > 0 && <TrendingUp className="h-3 w-3" />}
          <span className="font-medium">
            {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
          </span>
          <span className="text-muted-foreground">(last sync)</span>
          {getStatusIcon()}
        </div>
      )}
      
      {/* Total */}
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold">{total.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">total</span>
      </div>
    </div>
  );
};

export default SyncMetricCard;