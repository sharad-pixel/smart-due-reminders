import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SecurityAlertData {
  id: string;
  message: string;
  severity: "high" | "medium" | "low";
  timestamp: string;
}

export function SecurityAlert() {
  const [alerts, setAlerts] = useState<SecurityAlertData[]>([]);

  useEffect(() => {
    checkForAlerts();
    
    // Subscribe to security events
    const channel = supabase
      .channel('security_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_events',
          filter: 'success=eq.false'
        },
        () => {
          checkForAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkForAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for failed login attempts in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: failedLogins } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('success', false)
        .gte('created_at', oneHourAgo);

      const newAlerts: SecurityAlertData[] = [];

      if (failedLogins && failedLogins.length >= 3) {
        newAlerts.push({
          id: 'failed-logins',
          message: `${failedLogins.length} failed login attempts detected in the last hour`,
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      }

      // Check for new device logins
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false });

      if (sessions && sessions.length > 1) {
        newAlerts.push({
          id: 'new-device',
          message: 'New device login detected',
          severity: 'medium',
          timestamp: new Date().toISOString()
        });
      }

      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error checking security alerts:', error);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {alerts.map((alert) => (
        <Alert 
          key={alert.id}
          variant={alert.severity === 'high' ? 'destructive' : 'default'}
          className="pr-12"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Alert</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => dismissAlert(alert.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ))}
    </div>
  );
}
