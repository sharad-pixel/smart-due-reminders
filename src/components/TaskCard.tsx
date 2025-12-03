import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertTriangle, Info, User } from "lucide-react";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { format } from "date-fns";

interface TaskCardProps {
  task: CollectionTask;
  onStatusChange: (taskId: string, status: string) => void;
  onViewDetails: (task: CollectionTask) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'destructive';
    case 'high': return 'destructive';
    case 'normal': return 'default';
    case 'low': return 'secondary';
    default: return 'default';
  }
};

const getTaskTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    w9_request: 'W9 Request',
    payment_plan_needed: 'Payment Plan Needed',
    incorrect_po: 'Incorrect PO',
    dispute_charges: 'Dispute Charges',
    invoice_copy_request: 'Invoice Copy Request',
    billing_address_update: 'Address Update',
    payment_method_update: 'Payment Method Update',
    service_not_delivered: 'Service Not Delivered',
    overpayment_inquiry: 'Overpayment Question',
    paid_verification: 'Payment Verification',
    extension_request: 'Extension Request',
    callback_required: 'Callback Required'
  };
  return labels[type] || type;
};

export const TaskCard = ({ task, onStatusChange, onViewDetails }: TaskCardProps) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {task.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {task.status === 'in_progress' && <Clock className="h-4 w-4 text-blue-500" />}
            {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {getTaskTypeLabel(task.task_type)}
          </CardTitle>
          <Badge variant={getPriorityColor(task.priority)} className="text-xs">
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{task.summary}</p>
        
        {task.due_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {(task.assigned_persona || task.assigned_to) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>
              {task.assigned_persona && <Badge variant="outline" className="text-xs mr-1">{task.assigned_persona}</Badge>}
              {task.assigned_to && 'Assigned'}
            </span>
          </div>
        )}

        {task.recommended_action && (
          <div className="flex items-start gap-2 text-xs bg-muted p-2 rounded">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{task.recommended_action}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {task.status === 'open' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(task.id, 'in_progress')}
              className="flex-1"
            >
              Start
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button
              size="sm"
              onClick={() => onStatusChange(task.id, 'done')}
              className="flex-1"
            >
              Complete
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewDetails(task)}
            className="flex-1"
          >
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};