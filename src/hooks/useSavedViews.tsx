import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ViewConfig {
  filters?: Record<string, any>;
  sorting?: { column: string; direction: 'asc' | 'desc' };
  columns?: string[];
  widgets?: { id: string; visible: boolean; order: number }[];
}

export interface SavedView {
  id: string;
  name: string;
  page_path: string;
  view_config: ViewConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useSavedViews(pagePath: string) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedViews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('page_path', pagePath)
        .order('name');

      if (error) throw error;

      const views = (data || []) as SavedView[];
      setSavedViews(views);
      
      // Auto-load default view
      const defaultView = views.find(v => v.is_default);
      if (defaultView) {
        setActiveView(defaultView);
      }
    } catch (error) {
      console.error('Error fetching saved views:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedViews();
  }, [pagePath]);

  const saveView = async (name: string, config: ViewConfig, setAsDefault = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save views');
        return null;
      }

      // If setting as default, unset other defaults
      if (setAsDefault) {
        await supabase
          .from('saved_views')
          .update({ is_default: false })
          .eq('page_path', pagePath)
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          user_id: user.id,
          name,
          page_path: pagePath,
          view_config: config as any,
          is_default: setAsDefault
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('A view with this name already exists');
        } else {
          throw error;
        }
        return null;
      }

      toast.success('View saved');
      await fetchSavedViews();
      return data as SavedView;
    } catch (error) {
      console.error('Error saving view:', error);
      toast.error('Failed to save view');
      return null;
    }
  };

  const updateView = async (viewId: string, config: ViewConfig) => {
    try {
      const { error } = await supabase
        .from('saved_views')
        .update({ view_config: config as any })
        .eq('id', viewId);

      if (error) throw error;

      toast.success('View updated');
      await fetchSavedViews();
    } catch (error) {
      console.error('Error updating view:', error);
      toast.error('Failed to update view');
    }
  };

  const deleteView = async (viewId: string) => {
    try {
      const { error } = await supabase
        .from('saved_views')
        .delete()
        .eq('id', viewId);

      if (error) throw error;

      if (activeView?.id === viewId) {
        setActiveView(null);
      }

      toast.success('View deleted');
      await fetchSavedViews();
    } catch (error) {
      console.error('Error deleting view:', error);
      toast.error('Failed to delete view');
    }
  };

  const setDefaultView = async (viewId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Unset all defaults
      await supabase
        .from('saved_views')
        .update({ is_default: false })
        .eq('page_path', pagePath)
        .eq('user_id', user.id);

      // Set new default
      await supabase
        .from('saved_views')
        .update({ is_default: true })
        .eq('id', viewId);

      toast.success('Default view set');
      await fetchSavedViews();
    } catch (error) {
      console.error('Error setting default view:', error);
      toast.error('Failed to set default view');
    }
  };

  const loadView = (view: SavedView) => {
    setActiveView(view);
  };

  const clearActiveView = () => {
    setActiveView(null);
  };

  return {
    savedViews,
    activeView,
    isLoading,
    saveView,
    updateView,
    deleteView,
    setDefaultView,
    loadView,
    clearActiveView,
    refreshViews: fetchSavedViews
  };
}
