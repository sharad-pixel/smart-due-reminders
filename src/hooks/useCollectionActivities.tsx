import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LogActivityParams {
  debtor_id: string;
  invoice_id?: string;
  activity_type: string;
  direction: 'inbound' | 'outbound';
  channel: 'email' | 'sms' | 'phone' | 'note';
  subject?: string;
  message_body: string;
  response_message?: string;
  linked_draft_id?: string;
  linked_outreach_log_id?: string;
  metadata?: Record<string, any>;
}

export const useCollectionActivities = () => {
  const [isLogging, setIsLogging] = useState(false);
  const { toast } = useToast();

  const logActivity = async (params: LogActivityParams) => {
    setIsLogging(true);
    try {
      const { data, error } = await supabase.functions.invoke('log-collection-activity', {
        body: params
      });

      if (error) throw error;

      // Check if tasks were extracted
      if (data?.task_extraction?.tasks_created > 0) {
        toast({
          title: "Activity Logged",
          description: `${data.task_extraction.tasks_created} action item(s) automatically identified`,
        });
      } else {
        toast({
          title: "Activity Logged",
          description: "Collection activity recorded successfully",
        });
      }

      return data;
    } catch (error) {
      console.error('Error logging activity:', error);
      toast({
        title: "Error",
        description: "Failed to log collection activity",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLogging(false);
    }
  };

  const fetchActivities = async (filters?: {
    debtor_id?: string;
    invoice_id?: string;
    direction?: string;
    limit?: number;
  }) => {
    try {
      let query = supabase
        .from('collection_activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.debtor_id) {
        query = query.eq('debtor_id', filters.debtor_id);
      }
      if (filters?.invoice_id) {
        query = query.eq('invoice_id', filters.invoice_id);
      }
      if (filters?.direction) {
        query = query.eq('direction', filters.direction);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: "Error",
        description: "Failed to fetch activities",
        variant: "destructive",
      });
      return [];
    }
  };

  return {
    logActivity,
    fetchActivities,
    isLogging
  };
};