import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchCollectionTasks as fetchTasksService,
  updateCollectionTaskStatus,
  updateCollectionTask as updateTaskService,
  archiveCollectionTask,
  unarchiveCollectionTask,
  type TaskFilters,
} from '@/lib/supabase/collection-tasks';

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

  const fetchTasks = async (filters?: TaskFilters) => {
    setIsLoading(true);
    try {
      const data = await fetchTasksService(filters || {});
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
      await updateCollectionTaskStatus(taskId, status);
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
      await updateTaskService(taskId, updates as any);
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

  const archiveTask = async (taskId: string) => {
    try {
      await archiveCollectionTask(taskId);
      toast({
        title: "Task Archived",
        description: "Task archived successfully",
      });
    } catch (error) {
      console.error('Error archiving task:', error);
      toast({
        title: "Error",
        description: "Failed to archive task",
        variant: "destructive",
      });
      throw error;
    }
  };

  const unarchiveTask = async (taskId: string) => {
    try {
      await unarchiveCollectionTask(taskId);
      toast({
        title: "Task Restored",
        description: "Task restored successfully",
      });
    } catch (error) {
      console.error('Error restoring task:', error);
      toast({
        title: "Error",
        description: "Failed to restore task",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    fetchTasks,
    updateTaskStatus,
    updateTask,
    archiveTask,
    unarchiveTask,
    isLoading
  };
};
