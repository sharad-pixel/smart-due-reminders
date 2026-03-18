import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  fetchCollectionActivities as fetchActivitiesService,
  type ActivityFilters,
} from '@/lib/supabase/collection-activities';

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

  const fetchActivities = async (filters?: ActivityFilters) => {
    try {
      return await fetchActivitiesService(filters || {});
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
