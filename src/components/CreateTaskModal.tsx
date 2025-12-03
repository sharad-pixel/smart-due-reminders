import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Bot } from "lucide-react";
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

const AI_PERSONAS = ["Sam", "James", "Katy", "Troy", "Gotti", "Rocco"];

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
  const [assignmentType, setAssignmentType] = useState<"none" | "team" | "persona">("none");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [assignedPersona, setAssignedPersona] = useState<string>("");
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

      const { error } = await supabase
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
          assigned_to: assignmentType === "team" ? assignedTo : null,
          assigned_persona: assignmentType === "persona" ? assignedPersona : null,
        });

      if (error) throw error;

      toast.success("Task created successfully");
      setSummary("");
      setDetails("");
      setTaskType("MANUAL_REVIEW");
      setPriority("normal");
      setAssignmentType("none");
      setAssignedTo("");
      setAssignedPersona("");
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
            Create {level === "invoice" ? "Invoice-Level" : "Debtor-Level"} Task
          </DialogTitle>
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
            <Label htmlFor="assignmentType">Assign To</Label>
            <Select value={assignmentType} onValueChange={(value: any) => {
              setAssignmentType(value);
              setAssignedTo("");
              setAssignedPersona("");
            }}>
              <SelectTrigger id="assignmentType">
                <SelectValue placeholder="Select assignment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                <SelectItem value="team">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Team Member
                  </span>
                </SelectItem>
                <SelectItem value="persona">
                  <span className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    AI Persona
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentType === "team" && (
            <div>
              <Label htmlFor="assignedTo">Team Member</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="assignedTo">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.length === 0 ? (
                    <SelectItem value="" disabled>No team members found</SelectItem>
                  ) : (
                    teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignmentType === "persona" && (
            <div>
              <Label htmlFor="assignedPersona">AI Persona</Label>
              <Select value={assignedPersona} onValueChange={setAssignedPersona}>
                <SelectTrigger id="assignedPersona">
                  <SelectValue placeholder="Select AI persona" />
                </SelectTrigger>
                <SelectContent>
                  {AI_PERSONAS.map((persona) => (
                    <SelectItem key={persona} value={persona}>
                      {persona}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
