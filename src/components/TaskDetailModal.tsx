import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Mail, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskDetailModalProps {
  task: CollectionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onDelete: (taskId: string) => void;
  onAssign?: (taskId: string, assignedTo: string | null, assignedPersona: string | null) => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

const AI_PERSONAS = [
  { id: 'sam', name: 'Sam', bucket: '1-30 days' },
  { id: 'james', name: 'James', bucket: '31-60 days' },
  { id: 'katy', name: 'Katy', bucket: '61-90 days' },
  { id: 'troy', name: 'Troy', bucket: '91-120 days' },
  { id: 'gotti', name: 'Gotti', bucket: '121-150 days' },
  { id: 'rocco', name: 'Rocco', bucket: '150+ days' },
];

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

export const TaskDetailModal = ({
  task,
  open,
  onOpenChange,
  onStatusChange,
  onDelete,
  onAssign
}: TaskDetailModalProps) => {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("");
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      // Set initial values from task
      setSelectedTeamMember(task?.assigned_to || "");
      setSelectedPersona(task?.assigned_persona || "");
    }
  }, [open, task]);

  const fetchTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch team members from account_users joined with profiles
      const { data: accountUsers } = await supabase
        .from('account_users')
        .select('user_id')
        .eq('account_id', user.id)
        .eq('status', 'active');

      if (accountUsers && accountUsers.length > 0) {
        const userIds = accountUsers.map(au => au.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        if (profiles) {
          setTeamMembers(profiles.map(p => ({
            id: p.id,
            name: p.name || p.email || 'Unknown',
            email: p.email || ''
          })));
        }
      }

      // Also add current user
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .single();

      if (currentProfile) {
        setTeamMembers(prev => {
          const exists = prev.some(m => m.id === currentProfile.id);
          if (!exists) {
            return [...prev, {
              id: currentProfile.id,
              name: currentProfile.name || currentProfile.email || 'Me',
              email: currentProfile.email || ''
            }];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleAssign = async () => {
    if (!task || !onAssign) return;
    
    setIsAssigning(true);
    try {
      await onAssign(
        task.id, 
        selectedTeamMember || null, 
        selectedPersona || null
      );
      toast.success("Task assignment updated");
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error("Failed to update assignment");
    } finally {
      setIsAssigning(false);
    }
  };

  if (!task) return null;

  const handleEmailTask = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSending(true);
    try {
      const taskHtml = `
        <h2>Task: ${getTaskTypeLabel(task.task_type)}</h2>
        <p><strong>Summary:</strong> ${task.summary}</p>
        ${task.details ? `<p><strong>Details:</strong> ${task.details}</p>` : ""}
        ${task.recommended_action ? `<p><strong>Recommended Action:</strong> ${task.recommended_action}</p>` : ""}
        <p><strong>Priority:</strong> ${task.priority}</p>
        <p><strong>Status:</strong> ${task.status}</p>
        ${task.due_date ? `<p><strong>Due Date:</strong> ${format(new Date(task.due_date), "MMM d, yyyy")}</p>` : ""}
        ${task.ai_reasoning ? `<p><strong>AI Analysis:</strong> ${task.ai_reasoning}</p>` : ""}
        <p><strong>Created:</strong> ${format(new Date(task.created_at), "MMM d, yyyy h:mm a")}</p>
      `;

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
          subject: `Task Assignment: ${getTaskTypeLabel(task.task_type)} - ${task.summary}`,
          html: taskHtml,
        },
      });

      if (error) throw error;

      toast.success(`Task emailed to ${recipientEmail}`);
      setEmailDialogOpen(false);
      setRecipientEmail("");
    } catch (error: any) {
      console.error("Error emailing task:", error);
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">
                {getTaskTypeLabel(task.task_type)}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {task.summary}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={task.status === 'done' ? 'default' : 'secondary'}>
                {task.status}
              </Badge>
              <Badge>{task.priority}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {task.details && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Details</h4>
              <p className="text-sm text-muted-foreground">{task.details}</p>
            </div>
          )}

          {task.recommended_action && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Recommended Action</h4>
              <div className="bg-muted p-3 rounded text-sm">
                {task.recommended_action}
              </div>
            </div>
          )}

          {task.ai_reasoning && (
            <div>
              <h4 className="font-semibold text-sm mb-2">AI Analysis</h4>
              <p className="text-xs text-muted-foreground italic">{task.ai_reasoning}</p>
            </div>
          )}

          {/* Assignment Section */}
          {onAssign && (
            <div className="space-y-3 pt-2 border-t">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Assignment
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Team Member</Label>
                  <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {teamMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">AI Persona</Label>
                  <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                    <SelectTrigger>
                      <SelectValue placeholder="No persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No persona</SelectItem>
                      {AI_PERSONAS.map(persona => (
                        <SelectItem key={persona.id} value={persona.name}>
                          {persona.name} ({persona.bucket})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleAssign}
                disabled={isAssigning}
                className="w-full"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Assignment'
                )}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            {task.due_date && (
              <div>
                <span className="text-xs text-muted-foreground">Due Date</span>
                <p className="text-sm font-medium">
                  {format(new Date(task.due_date), 'MMM d, yyyy')}
                </p>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">Created</span>
              <p className="text-sm font-medium">
                {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            {task.completed_at && (
              <div>
                <span className="text-xs text-muted-foreground">Completed</span>
                <p className="text-sm font-medium">
                  {format(new Date(task.completed_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(true)}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email Task
            </Button>
            {task.status !== 'done' && (
              <Button
                onClick={() => {
                  onStatusChange(task.id, 'done');
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(task.id);
                onOpenChange(false);
              }}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Delete Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Email Task Dialog */}
    <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email Task</DialogTitle>
          <DialogDescription>
            Send this task details to someone via email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Recipient Email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="colleague@company.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleEmailTask} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};