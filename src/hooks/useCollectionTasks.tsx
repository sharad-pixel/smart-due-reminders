import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TaskNote {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
  mentions?: string[];
}

export interface CollectionTask {
  id: string;
  user_id: string;
  debtor_id: string;
  invoice_id?: string;
  activity_id?: string;
  task_type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  summary: string;
  details?: string;
  ai_reasoning?: string;
  recommended_action?: string;
  assigned_to?: string;
  assigned_persona?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  assignment_email_sent_at?: string;
  inbound_email_id?: string;
  notes?: TaskNote[] | unknown[];
}

export const useCollectionTasks = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchTasks = async (filters?: {
    debtor_id?: string;
    invoice_id?: string;
    status?: string;
    priority?: string;
    task_type?: string;
  }) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('collection_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.debtor_id) {
        query = query.eq('debtor_id', filters.debtor_id);
      }
      if (filters?.invoice_id) {
        query = query.eq('invoice_id', filters.invoice_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.task_type) {
        query = query.eq('task_type', filters.task_type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CollectionTask[];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'done') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('collection_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Task Updated",
        description: `Task marked as ${status}`,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<CollectionTask>) => {
    try {
      const { error } = await supabase
        .from('collection_tasks')
        .update(updates as any)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Task Updated",
        description: "Task updated successfully",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('collection_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Task Deleted",
        description: "Task deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    fetchTasks,
    updateTaskStatus,
    updateTask,
    deleteTask,
    isLoading
  };
};