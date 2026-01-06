import { CheckCircle, AlertTriangle, Ban, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EmailStatusBadgeProps {
  status: string | null | undefined;
  bounceReason?: string | null;
  showLabel?: boolean;
  size?: 'sm' | 'default';
}

const statusConfig = {
  valid: {
    icon: CheckCircle,
    label: 'Valid',
    tooltip: 'Email verified - delivery confirmed',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  bounced: {
    icon: AlertTriangle,
    label: 'Bounced',
    tooltip: 'Email bounced - outreach paused',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  complained: {
    icon: Ban,
    label: 'Opted Out',
    tooltip: 'Marked as spam - outreach stopped',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Unknown',
    tooltip: 'Email not yet verified',
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

export function EmailStatusBadge({ 
  status, 
  bounceReason, 
  showLabel = false,
  size = 'default' 
}: EmailStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
  const Icon = config.icon;

  const tooltipText = bounceReason 
    ? `${config.tooltip}\n${bounceReason}` 
    : config.tooltip;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'cursor-help',
              config.className,
              size === 'sm' && 'text-xs px-1.5 py-0'
            )}
          >
            <Icon className={cn('h-3 w-3', showLabel && 'mr-1')} />
            {showLabel && config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
