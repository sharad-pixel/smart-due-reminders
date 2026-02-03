import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemConfig {
  maintenanceMode: boolean;
  signupsEnabled: boolean;
  maxInvoicesPerFreeUser: number;
  emailNotificationsEnabled: boolean;
}

const DEFAULT_CONFIG: SystemConfig = {
  maintenanceMode: false,
  signupsEnabled: true,
  maxInvoicesPerFreeUser: 5,
  emailNotificationsEnabled: true,
};

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('key, value');

      if (error) throw error;

      if (data) {
        const configMap: Record<string, any> = {};
        data.forEach((row) => {
          configMap[row.key] = row.value;
        });

        setConfig({
          maintenanceMode: configMap['maintenance_mode'] === true || configMap['maintenance_mode'] === 'true',
          signupsEnabled: configMap['signups_enabled'] !== false && configMap['signups_enabled'] !== 'false',
          maxInvoicesPerFreeUser: typeof configMap['max_invoices_per_free_user'] === 'number' 
            ? configMap['max_invoices_per_free_user'] 
            : parseInt(configMap['max_invoices_per_free_user']) || 5,
          emailNotificationsEnabled: configMap['email_notifications_enabled'] !== false && configMap['email_notifications_enabled'] !== 'false',
        });
      }
    } catch (err: any) {
      console.error('Error fetching system config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: string, value: any): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key,
          value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) throw error;
      
      // Refresh config after update
      await fetchConfig();
      return true;
    } catch (err: any) {
      console.error('Error updating system config:', err);
      setError(err.message);
      return false;
    }
  };

  const saveAllConfig = async (newConfig: SystemConfig): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates = [
        { key: 'maintenance_mode', value: newConfig.maintenanceMode },
        { key: 'signups_enabled', value: newConfig.signupsEnabled },
        { key: 'max_invoices_per_free_user', value: newConfig.maxInvoicesPerFreeUser },
        { key: 'email_notifications_enabled', value: newConfig.emailNotificationsEnabled },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('system_config')
          .upsert({
            key: update.key,
            value: update.value,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key',
          });

        if (error) throw error;
      }

      await fetchConfig();
      return true;
    } catch (err: any) {
      console.error('Error saving system config:', err);
      setError(err.message);
      return false;
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    updateConfig,
    saveAllConfig,
    refetch: fetchConfig,
  };
}

// Lightweight hook just for checking maintenance mode (no auth required)
export function useMaintenanceCheck() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { data, error } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        if (!error && data) {
          setIsMaintenanceMode(data.value === true || data.value === 'true');
        }
      } catch (err) {
        console.error('Error checking maintenance mode:', err);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenance();
  }, []);

  return { isMaintenanceMode, loading };
}
