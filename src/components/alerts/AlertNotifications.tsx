import { useState } from 'react';
import { Bell, Check, CheckCheck, X, AlertTriangle, AlertCircle, Info, CheckCircle, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserAlerts, UserAlert } from '@/hooks/useUserAlerts';
import { useNotifications, UserNotification } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const severityConfig = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-600',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
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
        <div className={cn('p-2 rounded-full shrink-0 h-fit', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.textColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm truncate',
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

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onClick
}: {
  notification: UserNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: UserNotification) => void;
}) {
  return (
    <div
      className={cn(
        'p-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50 group',
        !notification.is_read && 'bg-muted/30'
      )}
      onClick={() => onClick(notification)}
    >
      <div className="flex gap-3">
        {!notification.is_read && (
          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
        )}
        {notification.is_read && (
          <div className="w-2 h-2 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm',
              !notification.is_read && 'font-semibold'
            )}>
              {notification.title}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
              title="Delete"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>
            {notification.is_read && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Check className="h-3 w-3" />
                Read
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertNotifications() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  
  // System alerts (email issues, etc.)
  const { 
    alerts, 
    unreadCount: alertUnreadCount, 
    loading: alertsLoading, 
    markAsRead: markAlertRead, 
    markAllAsRead: markAllAlertsRead, 
    dismissAlert,
    dismissAllAlerts 
  } = useUserAlerts();

  // User notifications (mentions, etc.)
  const {
    notifications,
    unreadCount: notificationUnreadCount,
    isLoading: notificationsLoading,
    markAsRead: markNotificationRead,
    markAllAsRead: markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications
  } = useNotifications();

  const totalUnreadCount = alertUnreadCount + notificationUnreadCount;

  const handleAlertClick = (alert: UserAlert) => {
    if (!alert.is_read) {
      markAlertRead(alert.id);
    }
    setOpen(false);
    if (alert.action_url) {
      navigate(alert.action_url);
    }
  };

  const handleNotificationClick = async (notification: UserNotification) => {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
    }
    setOpen(false);
    
    if (notification.source_type === 'task' && notification.source_id) {
      navigate(`/tasks?taskId=${notification.source_id}`);
    } else if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between p-3 border-b">
            <h4 className="font-semibold">Notifications</h4>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2 h-6">
                All {totalUnreadCount > 0 && `(${totalUnreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs px-2 h-6">
                Alerts {alertUnreadCount > 0 && `(${alertUnreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="mentions" className="text-xs px-2 h-6">
                Mentions {notificationUnreadCount > 0 && `(${notificationUnreadCount})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* All Tab */}
          <TabsContent value="all" className="m-0">
            <ScrollArea className="max-h-[400px]">
              {alertsLoading || notificationsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : alerts.length === 0 && notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                  <p className="text-xs mt-1">You're all caught up!</p>
                </div>
              ) : (
                <>
                  {alerts.slice(0, 3).map(alert => (
                    <AlertItem
                      key={`alert-${alert.id}`}
                      alert={alert}
                      onMarkRead={markAlertRead}
                      onDismiss={dismissAlert}
                      onClick={handleAlertClick}
                    />
                  ))}
                  {notifications.slice(0, 3).map(notification => (
                    <NotificationItem
                      key={`notif-${notification.id}`}
                      notification={notification}
                      onMarkRead={markNotificationRead}
                      onDelete={deleteNotification}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="m-0">
            <div className="flex items-center justify-end gap-1 px-3 py-2 border-b">
              {alertUnreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAlertsRead}
                  className="text-xs h-7"
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
                  className="text-xs h-7"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[350px]">
              {alertsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No system alerts</p>
                </div>
              ) : (
                alerts.slice(0, 5).map(alert => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onMarkRead={markAlertRead}
                    onDismiss={dismissAlert}
                    onClick={handleAlertClick}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>

          {/* Mentions Tab */}
          <TabsContent value="mentions" className="m-0">
            <div className="flex items-center justify-end gap-1 px-3 py-2 border-b">
              {notificationUnreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllNotificationsRead}
                  className="text-xs h-7"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllNotifications}
                  className="text-xs h-7 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[350px]">
              {notificationsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No mentions</p>
                  <p className="text-xs mt-1">You'll be notified when someone mentions you</p>
                </div>
              ) : (
                notifications.slice(0, 5).map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markNotificationRead}
                    onDelete={deleteNotification}
                    onClick={handleNotificationClick}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => {
              setOpen(false);
              navigate('/alerts');
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
