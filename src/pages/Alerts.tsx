import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, AlertTriangle, AlertCircle, CheckCircle, Info, Mail, ExternalLink, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserAlerts, UserAlert } from '@/hooks/useUserAlerts';
import { useNotifications, UserNotification } from '@/hooks/useNotifications';
import Layout from '@/components/Layout';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'unread' | 'alerts' | 'mentions';

// Consistent severity config matching AlertNotifications
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

const getSeverityIcon = (severity: string, alertType: string) => {
  if (alertType.includes('email') || alertType.includes('outreach')) {
    return <Mail className="h-5 w-5" />;
  }
  switch (severity) {
    case 'error':
      return <AlertTriangle className="h-5 w-5" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5" />;
    case 'success':
      return <CheckCircle className="h-5 w-5" />;
    default:
      return <Info className="h-5 w-5" />;
  }
};

const getSeverityStyles = (severity: string) => {
  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
  return { bgColor: config.bgColor, textColor: config.textColor, Icon: config.icon };
};

const groupAlertsByDate = (alerts: UserAlert[]) => {
  const groups: { [key: string]: UserAlert[] } = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  alerts.forEach((alert) => {
    const date = parseISO(alert.created_at);
    if (isToday(date)) {
      groups.today.push(alert);
    } else if (isYesterday(date)) {
      groups.yesterday.push(alert);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(alert);
    } else {
      groups.older.push(alert);
    }
  });

  return groups;
};

export default function Alerts() {
  const navigate = useNavigate();
  const { 
    alerts, 
    unreadCount: alertUnreadCount, 
    loading: alertsLoading, 
    markAsRead: markAlertRead, 
    markAllAsRead: markAllAlertsRead, 
    dismissAlert,
    dismissAllAlerts 
  } = useUserAlerts();
  
  const {
    notifications,
    unreadCount: notificationUnreadCount,
    isLoading: notificationsLoading,
    markAsRead: markNotificationRead,
    markAllAsRead: markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications
  } = useNotifications();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [visibleCount, setVisibleCount] = useState(20);
  
  const totalUnreadCount = alertUnreadCount + notificationUnreadCount;
  const loading = alertsLoading || notificationsLoading;

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.is_read;
    if (filter === 'mentions') return false;
    return true;
  });

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'unread') return !notif.is_read;
    if (filter === 'alerts') return false;
    return true;
  });

  const groupedAlerts = groupAlertsByDate(filteredAlerts.slice(0, visibleCount));

  const handleAlertClick = async (alert: UserAlert) => {
    if (!alert.is_read) {
      await markAlertRead(alert.id);
    }
    if (alert.action_url) {
      navigate(alert.action_url);
    }
  };

  const handleNotificationClick = async (notification: UserNotification) => {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
    }
    if (notification.source_type === 'task' && notification.source_id) {
      navigate(`/tasks?taskId=${notification.source_id}`);
    } else if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAlertsRead();
    await markAllNotificationsRead();
  };

  const renderAlertItem = (alert: UserAlert) => {
    const styles = getSeverityStyles(alert.severity);
    
    return (
      <Card
        key={alert.id}
        className={cn(
          'transition-colors cursor-pointer hover:bg-muted/50',
          !alert.is_read && 'bg-accent/50 border-primary/20'
        )}
        onClick={() => handleAlertClick(alert)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={cn('p-2 rounded-full', styles.bgColor)}>
              <styles.Icon className={cn('h-4 w-4', styles.textColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className={cn('text-sm', !alert.is_read && 'font-semibold')}>{alert.title}</h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(parseISO(alert.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{alert.message}</p>
              <div className="flex items-center gap-2 mt-3">
                {alert.action_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAlertClick(alert);
                    }}
                  >
                    {alert.action_label || 'View'}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {!alert.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAlertRead(alert.id);
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
            {!alert.is_read && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderNotificationItem = (notification: UserNotification) => {
    return (
      <Card
        key={notification.id}
        className={cn(
          'transition-colors cursor-pointer hover:bg-muted/50',
          !notification.is_read && 'bg-accent/50 border-primary/20'
        )}
        onClick={() => handleNotificationClick(notification)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
            )}
            {notification.is_read && <div className="w-2 h-2 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className={cn('text-sm', !notification.is_read && 'font-semibold')}>
                  {notification.title}
                </h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAlertGroup = (title: string, alertList: UserAlert[]) => {
    if (alertList.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
        <div className="space-y-3">
          {alertList.map(renderAlertItem)}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container max-w-4xl py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Alerts & Notifications</h1>
            {totalUnreadCount > 0 && (
              <Badge variant="secondary">{totalUnreadCount} unread</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalUnreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
            {(alerts.length > 0 || notifications.length > 0) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  await dismissAllAlerts();
                  await clearAllNotifications();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">
              All {(alerts.length + notifications.length) > 0 && `(${alerts.length + notifications.length})`}
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {totalUnreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {totalUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts {alertUnreadCount > 0 && `(${alertUnreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="mentions">
              Mentions {notificationUnreadCount > 0 && `(${notificationUnreadCount})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredAlerts.length === 0 && filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No notifications</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {filter === 'unread' ? "You're all caught up!" : 'No alerts to display'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {filter !== 'mentions' && (
              <>
                {renderAlertGroup('Today', groupedAlerts.today)}
                {renderAlertGroup('Yesterday', groupedAlerts.yesterday)}
                {renderAlertGroup('This Week', groupedAlerts.thisWeek)}
                {renderAlertGroup('Older', groupedAlerts.older)}
              </>
            )}

            {filter !== 'alerts' && filteredNotifications.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Mentions</h3>
                <div className="space-y-3">
                  {filteredNotifications.slice(0, visibleCount).map(renderNotificationItem)}
                </div>
              </div>
            )}

            {visibleCount < filteredAlerts.length + filteredNotifications.length && (
              <div className="text-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
