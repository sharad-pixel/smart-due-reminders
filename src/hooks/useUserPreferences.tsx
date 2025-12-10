import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PagePreferences {
  [key: string]: any;
}

export function useUserPreferences(pagePath: string) {
  const [preferences, setPreferences] = useState<PagePreferences>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoaded(true);
          return;
        }
        
        setUserId(user.id);

        // Try to load from saved_views as a "preferences" type view
        const { data, error } = await supabase
          .from('saved_views')
          .select('view_config')
          .eq('page_path', `${pagePath}__preferences`)
          .eq('user_id', user.id)
          .single();

        if (data && !error) {
          setPreferences((data.view_config as PagePreferences) || {});
        }
      } catch (error) {
        // No preferences saved yet, that's fine
        console.log('No saved preferences found for', pagePath);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, [pagePath]);

  // Save preferences whenever they change (debounced)
  const savePreferences = useCallback(async (newPrefs: PagePreferences) => {
    if (!userId) return;

    try {
      // Upsert the preferences
      const { error } = await supabase
        .from('saved_views')
        .upsert({
          user_id: userId,
          name: '__auto_preferences__',
          page_path: `${pagePath}__preferences`,
          view_config: newPrefs,
          is_default: false
        }, {
          onConflict: 'user_id,page_path,name'
        });

      if (error) {
        console.error('Error saving preferences:', error);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }, [userId, pagePath]);

  // Update a single preference
  const setPreference = useCallback((key: string, value: any) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, [key]: value };
      savePreferences(newPrefs);
      return newPrefs;
    });
  }, [savePreferences]);

  // Get a preference with default value
  const getPreference = useCallback(<T,>(key: string, defaultValue: T): T => {
    return preferences[key] !== undefined ? preferences[key] : defaultValue;
  }, [preferences]);

  return {
    preferences,
    setPreference,
    getPreference,
    isLoaded
  };
}
