import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, AlertTriangle, Clock } from "lucide-react";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { useNavigate } from "react-router-dom";
import { TaskDetailModal } from "./TaskDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TasksSummaryCardProps {
  tasks: CollectionTask[];
  title?: string;
  onTaskUpdate?: () => void;
}

export const TasksSummaryCard = ({ tasks, title = "Action Items", onTaskUpdate }: TasksSummaryCardProps) => {
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          status, 
          completed_at: status === "done" ? new Date().toISOString() : null 
        })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task updated");
      onTaskUpdate?.();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task deleted");
      onTaskUpdate?.();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const openTasks = tasks.filter(t => t.status === 'open');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done');

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      w9_request: 'W9 Request',
      payment_plan_needed: 'Payment Plan',
      incorrect_po: 'Incorrect PO',
      dispute_charges: 'Dispute',
      invoice_copy_request: 'Resend Invoice',
      billing_address_update: 'Address Update',
      payment_method_update: 'Payment Update',
      service_not_delivered: 'Service Issue',
      overpayment_inquiry: 'Overpayment',
      paid_verification: 'Verify Payment',
      extension_request: 'Extension',
      callback_required: 'Callback'
    };
    return labels[type] || type;
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No action items at this time
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex gap-2">
            {urgentTasks.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {urgentTasks.length} Urgent
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {openTasks.length + inProgressTasks.length} Active
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.slice(0, 5).map(task => (
          <div
            key={task.id}
            className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => {
              setSelectedTask(task);
              setModalOpen(true);
            }}
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                {task.priority === 'urgent' && (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                {task.status === 'in_progress' && (
                  <Clock className="h-4 w-4 text-blue-500" />
                )}
                <span className="font-medium text-sm">
                  {getTaskTypeLabel(task.task_type)}
                </span>
                <Badge variant="outline" className="text-xs">
                  {task.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {task.summary}
              </p>
              {task.recommended_action && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  → {task.recommended_action}
                </p>
              )}
            </div>
          </div>
        ))}
        
        {tasks.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{tasks.length - 5} more tasks
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          onClick={() => navigate('/collections/tasks')}
        >
          View All Tasks
        </Button>
      </CardContent>
    </Card>

    <TaskDetailModal
      task={selectedTask}
      open={modalOpen}
      onOpenChange={setModalOpen}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
    />
    </>
  );
};