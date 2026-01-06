import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserAlert {
  id: string;
  user_id: string;
  organization_id: string | null;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  invoice_id: string | null;
  debtor_id: string | null;
  action_url: string | null;
  action_label: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useUserAlerts() {
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAlerts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAlerts([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }

      const typedAlerts = (data || []) as UserAlert[];
      setAlerts(typedAlerts);
      setUnreadCount(typedAlerts.filter(a => !a.is_read).length);
    } catch (err) {
      console.error('Error in fetchAlerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('user_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, is_read: true } : a
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_alerts')
      .update({ is_read: true })
      .eq('is_read', false);

    if (!error) {
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      setUnreadCount(0);
    }
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    // Get alert before dismissing to check if unread
    const alertToRemove = alerts.find(a => a.id === alertId);
    
    const { error } = await supabase
      .from('user_alerts')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      if (alertToRemove && !alertToRemove.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [alerts]);

  const dismissAllAlerts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_alerts')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('is_dismissed', false);

    if (!error) {
      setAlerts([]);
      setUnreadCount(0);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('user-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_alerts'
        },
        (payload) => {
          const newAlert = payload.new as UserAlert;
          setAlerts(prev => [newAlert, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for new alerts
          toast({
            title: newAlert.title,
            description: newAlert.message,
            variant: newAlert.severity === 'error' ? 'destructive' : 'default',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return {
    alerts,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    dismissAlert,
    dismissAllAlerts,
    refetch: fetchAlerts,
  };
}
