import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Download, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  notification_type: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export function DataRetentionBanner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('data_retention_notifications')
      .select('*')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setNotifications(data);
    }
  };

  const dismissNotification = async (id: string) => {
    await supabase
      .from('data_retention_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    
    setDismissed(prev => [...prev, id]);
  };

  const visibleNotifications = notifications.filter(n => !dismissed.includes(n.id));
  const warningNotifications = visibleNotifications.filter(n => n.notification_type === 'deletion_warning');

  if (visibleNotifications.length === 0) {
    return (
      <Alert className="mb-4 bg-muted/50 border-border">
        <Clock className="h-4 w-4" />
        <AlertTitle className="text-sm font-medium">Data Retention Policy</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Uploads are automatically archived after 24 hours and permanently deleted after 14 days. 
          Download your data and audit trails for record keeping before deletion.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      {warningNotifications.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">⚠️ Data Deletion Warning</AlertTitle>
          <AlertDescription className="text-xs">
            {warningNotifications.length} upload(s) will be permanently deleted in 7 days. 
            <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-destructive-foreground underline">
              <Download className="h-3 w-3 mr-1" />
              Download history with audit trails now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {visibleNotifications.slice(0, 3).map(notification => (
        <Alert 
          key={notification.id} 
          className={notification.notification_type === 'deletion_warning' 
            ? 'border-destructive/50 bg-destructive/10' 
            : 'bg-muted/50 border-border'
          }
        >
          <div className="flex items-start justify-between w-full">
            <div className="flex-1">
              <AlertDescription className="text-xs">
                {notification.message}
              </AlertDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 ml-2"
              onClick={() => dismissNotification(notification.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Alert>
      ))}

      <Alert className="bg-muted/50 border-border">
        <Clock className="h-4 w-4" />
        <AlertTitle className="text-sm font-medium">Data Retention Policy</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Uploads are automatically archived after 24 hours and permanently deleted after 14 days. 
          Download your data and audit trails for record keeping before deletion.
        </AlertDescription>
      </Alert>
    </div>
  );
}
