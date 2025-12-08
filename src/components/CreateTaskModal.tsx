import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { formatTaskType } from "@/lib/taskHelpers";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId: string;
  invoiceId?: string;
  level: "invoice" | "debtor";
  onTaskCreated?: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

const TASK_TYPES = [
  "SETUP_PAYMENT_PLAN",
  "REVIEW_DISPUTE",
  "CALL_CUSTOMER",
  "UPDATE_PAYMENT_METHOD",
  "SEND_PAYMENT_LINK",
  "MANUAL_REVIEW",
];

const CreateTaskModal = ({
  open,
  onOpenChange,
  debtorId,
  invoiceId,
  level,
  onTaskCreated,
}: CreateTaskModalProps) => {
  const [creating, setCreating] = useState(false);
  const [taskType, setTaskType] = useState("MANUAL_REVIEW");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "low">("normal");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
    }
  }, [open]);

  const fetchTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email")
        .eq("user_id", user.id);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const handleCreate = async () => {
    if (!summary) {
      toast.error("Please provide a task summary");
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newTask, error } = await supabase
        .from("collection_tasks")
        .insert({
          debtor_id: debtorId,
          invoice_id: invoiceId || null,
          user_id: user.id,
          task_type: taskType,
          level: level,
          summary: summary,
          details: details || null,
          status: "open",
          priority: priority,
          source: "user_created",
          assigned_to: assignedTo && assignedTo !== "unassigned" ? assignedTo : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notification if assigned to a team member
      if (assignedTo && assignedTo !== "unassigned" && newTask) {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-task-assignment", {
            body: {
              taskId: newTask.id,
              teamMemberId: assignedTo,
            },
          });
          
          if (emailError) {
            console.error("Failed to send assignment email:", emailError);
          } else {
            // Update task with email sent timestamp
            await supabase
              .from("collection_tasks")
              .update({ assignment_email_sent_at: new Date().toISOString() })
              .eq("id", newTask.id);
          }
        } catch (emailErr) {
          console.error("Email notification error:", emailErr);
        }
      }

      toast.success("Task created successfully");
      setSummary("");
      setDetails("");
      setTaskType("MANUAL_REVIEW");
      setPriority("normal");
      setAssignedTo("");
      onOpenChange(false);
      onTaskCreated?.();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error(error.message || "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Create {level === "invoice" ? "Invoice-Level" : "Account-Level"} Task
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Tasks help you track follow-ups and actions. Assigned tasks notify team members via email.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="taskType">Task Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger id="taskType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatTaskType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="assignedTo">Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="assignedTo">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamMembers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No team members found. Add team members in Settings.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="summary">Summary *</Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of the task"
            />
          </div>

          <div>
            <Label htmlFor="details">Details</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details about this task"
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal;
