import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, AlertTriangle, CheckCircle, Info, Mail, ExternalLink } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserAlerts, UserAlert } from '@/hooks/useUserAlerts';
import Layout from '@/components/Layout';

type FilterType = 'all' | 'unread' | 'email' | 'system';

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

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'error':
      return 'text-destructive bg-destructive/10';
    case 'warning':
      return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20';
    case 'success':
      return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20';
    default:
      return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
  }
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
  const { alerts, unreadCount, loading, markAsRead, markAllAsRead, dismissAlert } = useUserAlerts();
  const [filter, setFilter] = useState<FilterType>('all');
  const [visibleCount, setVisibleCount] = useState(20);

  const filteredAlerts = alerts.filter((alert) => {
    switch (filter) {
      case 'unread':
        return !alert.is_read;
      case 'email':
        return alert.alert_type.includes('email') || alert.alert_type.includes('outreach');
      case 'system':
        return alert.alert_type === 'system' || alert.alert_type === 'sync_failed';
      default:
        return true;
    }
  });

  const visibleAlerts = filteredAlerts.slice(0, visibleCount);
  const groupedAlerts = groupAlertsByDate(visibleAlerts);

  const handleAlertClick = async (alert: UserAlert) => {
    if (!alert.is_read) {
      await markAsRead(alert.id);
    }
    if (alert.action_url) {
      navigate(alert.action_url);
    }
  };

  const renderAlertGroup = (title: string, alerts: UserAlert[]) => {
    if (alerts.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">{title}</h3>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`transition-colors ${!alert.is_read ? 'bg-accent/50 border-primary/20' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity, alert.alert_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm">{alert.title}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(alert.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-3">
                      {alert.action_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlertClick(alert)}
                        >
                          {alert.action_label || 'View'}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissAlert(alert.id)}
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
          ))}
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
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} unread</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email">Email Issues</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
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
            {renderAlertGroup('Today', groupedAlerts.today)}
            {renderAlertGroup('Yesterday', groupedAlerts.yesterday)}
            {renderAlertGroup('This Week', groupedAlerts.thisWeek)}
            {renderAlertGroup('Older', groupedAlerts.older)}

            {visibleCount < filteredAlerts.length && (
              <div className="text-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                >
                  Load More ({filteredAlerts.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
