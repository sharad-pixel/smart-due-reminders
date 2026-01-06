import { Bell, Check, CheckCheck, X, AlertTriangle, AlertCircle, Info, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserAlerts, UserAlert } from '@/hooks/useUserAlerts';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const severityConfig = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/20',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/20',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-500/20',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/20',
  },
};

function AlertItem({ 
  alert, 
  onMarkRead, 
  onDismiss, 
  onClick 
}: { 
  alert: UserAlert;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick: (alert: UserAlert) => void;
}) {
  const config = severityConfig[alert.severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'p-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50',
        !alert.is_read && 'bg-muted/30'
      )}
      onClick={() => onClick(alert)}
    >
      <div className="flex gap-3">
        <div className={cn('p-2 rounded-full shrink-0', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.textColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm font-medium truncate',
              !alert.is_read && 'font-semibold'
            )}>
              {alert.title}
            </p>
            <div className="flex gap-1 shrink-0">
              {!alert.is_read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(alert.id);
                  }}
                  title="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(alert.id);
                }}
                title="Dismiss"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {alert.message}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
            </span>
            {alert.action_url && alert.action_label && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(alert);
                }}
              >
                {alert.action_label}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertNotifications() {
  const navigate = useNavigate();
  const { 
    alerts, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    dismissAlert,
    dismissAllAlerts 
  } = useUserAlerts();

  const handleAlertClick = (alert: UserAlert) => {
    if (!alert.is_read) {
      markAsRead(alert.id);
    }
    if (alert.action_url) {
      navigate(alert.action_url);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Alerts</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {alerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissAllAlerts}
                className="text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No alerts</p>
              <p className="text-xs mt-1">You're all caught up!</p>
            </div>
          ) : (
            alerts.slice(0, 5).map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onMarkRead={markAsRead}
                onDismiss={dismissAlert}
                onClick={handleAlertClick}
              />
            ))
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => navigate('/alerts')}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
