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
import { CollectionTask, TaskNote } from "@/hooks/useCollectionTasks";
import { format, differenceInDays } from "date-fns";
import { CheckCircle2, Archive, Mail, Loader2, UserPlus, Info, CalendarClock, MessageSquarePlus, StickyNote, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionInput, MentionUser, renderNoteWithMentions } from "@/components/MentionInput";
import { createMentionNotification } from "@/hooks/useNotifications";
import { SmartResponseSection } from "@/components/SmartResponseSection";

interface TaskDetailModalProps {
  task: CollectionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onArchive: (taskId: string) => void;
  onAssign?: (taskId: string, assignedTo: string | null, assignedPersona: string | null) => void;
  onNoteAdded?: () => void;
}

interface AccountUser {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profile_name: string | null;
  profile_email: string | null;
}

// AI Personas removed - tasks are only assigned to team members

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
  onArchive,
  onAssign,
  onNoteAdded
}: TaskDetailModalProps) => {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [accountUsers, setAccountUsers] = useState<AccountUser[]>([]);
  const [selectedAccountUser, setSelectedAccountUser] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Notes state
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [noteMentions, setNoteMentions] = useState<string[]>([]);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAccountUsers();
      fetchCurrentUser();
      // Set initial values from task
      setSelectedAccountUser(task?.assigned_to || "");
      // Load notes from task
      if (task) {
        const taskNotes = (task as any).notes;
        if (Array.isArray(taskNotes)) {
          setNotes(taskNotes);
        } else {
          setNotes([]);
        }
      }
    }
  }, [open, task]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .single();
      
      setCurrentUser({
        id: user.id,
        name: profile?.name || profile?.email || 'Unknown',
        email: profile?.email || user.email || ''
      });
    }
  };

  const fetchAccountUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get effective account ID (owner's ID for team members)
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });

      if (!effectiveAccountId) return;

      // Get account_users for the effective account only (no duplicates)
      // Exclude viewers - they cannot be assigned tasks
      const { data, error } = await supabase
        .from('account_users')
        .select(`id, user_id, role, status`)
        .eq('account_id', effectiveAccountId)
        .eq('status', 'active')
        .neq('role', 'viewer')
        .order('is_owner', { ascending: false })
        .order('role');

      if (error) {
        console.error('Error fetching account users:', error);
        return;
      }

      if (data) {
        // Deduplicate by user_id - keep only one entry per user
        const uniqueByUserId = new Map<string, typeof data[0]>();
        data.forEach(au => {
          if (au.user_id && !uniqueByUserId.has(au.user_id)) {
            uniqueByUserId.set(au.user_id, au);
          }
        });

        // Fetch profile info for each unique user
        const usersWithProfiles = await Promise.all(
          Array.from(uniqueByUserId.values()).map(async (au) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', au.user_id)
              .single();
            
            return {
              id: au.id,
              user_id: au.user_id,
              role: au.role,
              status: au.status,
              profile_name: profile?.name || null,
              profile_email: profile?.email || null
            };
          })
        );
        setAccountUsers(usersWithProfiles);
        
        // Build mention users list from account users
        const mentionableUsers: MentionUser[] = usersWithProfiles.map(u => ({
          id: u.id,
          user_id: u.user_id,
          name: u.profile_name || u.profile_email || 'Unknown',
          email: u.profile_email || ''
        }));
        setMentionUsers(mentionableUsers);
      }
    } catch (error) {
      console.error('Error fetching account users:', error);
    }
  };

  const handleAssign = async () => {
    if (!task || !onAssign) return;
    
    setIsAssigning(true);
    try {
      // Use user_id from account_users for assignment
      const selectedUser = accountUsers.find(u => u.id === selectedAccountUser);
      const assignedUserId = selectedUser?.user_id || null;
      
      await onAssign(
        task.id, 
        assignedUserId, 
        null // No persona assignment for tasks
      );
      
      // Send email notification if an account user is assigned
      if (assignedUserId && selectedUser?.profile_email) {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-task-assignment", {
            body: {
              taskId: task.id,
              accountUserId: selectedAccountUser,
              userId: assignedUserId
            }
          });
          
          if (emailError) {
            console.error('Error sending assignment email:', emailError);
          } else {
            // Update task with email sent timestamp
            await supabase
              .from("collection_tasks")
              .update({ assignment_email_sent_at: new Date().toISOString() })
              .eq("id", task.id);
            toast.success("Task assigned and notification sent");
            return;
          }
        } catch (emailErr) {
          console.error('Error invoking send-task-assignment:', emailErr);
        }
      }
      
      toast.success("Task assignment updated");
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error("Failed to update assignment");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddNote = async () => {
    if (!task || !newNote.trim() || !currentUser) return;
    
    setIsAddingNote(true);
    try {
      const noteEntry: TaskNote = {
        id: crypto.randomUUID(),
        content: newNote.trim(),
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_email: currentUser.email,
        created_at: new Date().toISOString(),
        mentions: noteMentions
      };
      
      const updatedNotes = [...notes, noteEntry];
      
      const { error } = await supabase
        .from('collection_tasks')
        .update({ notes: updatedNotes as unknown as any })
        .eq('id', task.id);
      
      if (error) throw error;
      
      // Create notifications for mentioned users (sends email + in-app notification)
      for (const mentionedUserId of noteMentions) {
        // Don't notify yourself
        if (mentionedUserId !== currentUser.id) {
          await createMentionNotification(
            mentionedUserId,
            currentUser.name,
            currentUser.id,
            task.id,
            task.summary,
            newNote.trim()
          );
        }
      }
      
      setNotes(updatedNotes);
      setNewNote("");
      setNoteMentions([]);
      toast.success("Note added");
      onNoteAdded?.();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error("Failed to add note");
    } finally {
      setIsAddingNote(false);
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

  const daysOpen = differenceInDays(new Date(), new Date(task.created_at));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto [&>button]:hidden p-4 sm:p-6">
        <DialogHeader className="pr-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-xl">
                {getTaskTypeLabel(task.task_type)}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm line-clamp-2 sm:line-clamp-none">
                {task.summary}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 -mr-2 -mt-1"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap mt-2 sm:mt-3">
            <Badge variant={daysOpen > 7 ? "destructive" : daysOpen > 3 ? "default" : "secondary"} className="flex items-center gap-1 text-xs">
              <CalendarClock className="h-3 w-3" />
              {daysOpen === 0 ? 'Today' : `${daysOpen}d`}
            </Badge>
            <Badge variant={task.status === 'done' ? 'default' : 'secondary'} className="text-xs">
              {task.status}
            </Badge>
            <Badge className="text-xs">{task.priority}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Status Change Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Status</Label>
            <Select 
              value={task.status} 
              onValueChange={(value) => onStatusChange(task.id, value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              {(task as any).inbound_email_id && (
                <a 
                  href={`/inbound?email=${(task as any).inbound_email_id}${task.invoice_id ? `&invoiceId=${task.invoice_id}` : ''}`}
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  View Source Email →
                </a>
              )}
            </div>
          )}

          {/* Smart Response Section */}
          <SmartResponseSection 
            task={task} 
            onResponseSent={() => {
              // Refresh task data
              onNoteAdded?.();
            }}
          />

          {/* Assignment Section */}
          {onAssign && (
            <div className="space-y-3 pt-2 border-t">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Assignment
              </h4>
              
              {accountUsers.length === 0 ? (
                <Alert className="bg-muted/50">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    No team members available. Add users via{" "}
                    <a href="/team" className="text-primary hover:underline font-medium">
                      Teams & Roles
                    </a>{" "}
                    to enable task assignments.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Team Member (Paid Seats)</Label>
                    <Select value={selectedAccountUser || "unassigned"} onValueChange={(val) => setSelectedAccountUser(val === "unassigned" ? "" : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {accountUsers.filter(u => u.id && u.id.trim() !== '').map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            <span className="flex items-center gap-2">
                              {user.profile_name || user.profile_email || 'Unknown'}
                              <Badge variant="outline" className="text-xs ml-1">{user.role}</Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Only users added via Teams & Roles can be assigned tasks
                    </p>
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
                </>
              )}
            </div>
          )}

          {/* Assignment Info Display */}
          {task.assigned_to && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-semibold text-sm">Current Assignment</h4>
              <div>
                <span className="text-xs text-muted-foreground">Assigned To</span>
                <p className="text-sm font-medium">
                  {accountUsers.find(u => u.user_id === task.assigned_to)?.profile_name || 
                   accountUsers.find(u => u.user_id === task.assigned_to)?.profile_email || 
                   'Unknown'}
                </p>
              </div>
              {(task as any).assignment_email_sent_at && (
                <div>
                  <span className="text-xs text-muted-foreground">Assignment Email Sent</span>
                  <p className="text-sm font-medium text-green-600">
                    {format(new Date((task as any).assignment_email_sent_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Source Email Link */}
          {(task as any).inbound_email_id && (
            <div className="pt-2 border-t">
              <h4 className="font-semibold text-sm mb-2">Source</h4>
              <a 
                href={`/inbound?email=${(task as any).inbound_email_id}${task.invoice_id ? `&invoiceId=${task.invoice_id}` : ''}`}
                className="text-sm text-primary hover:underline"
              >
                View Source Email →
              </a>
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes {notes.length > 0 && <Badge variant="secondary" className="text-xs">{notes.length}</Badge>}
            </h4>
            
            {/* Existing Notes */}
            {notes.length > 0 && (
              <div className="space-y-2">
                {(showAllNotes ? notes : notes.slice(0, 3)).map((note) => (
                  <div key={note.id} className="bg-muted/50 p-3 rounded-lg text-sm">
                    <div className="whitespace-pre-wrap">{renderNoteWithMentions(note.content)}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">{note.user_name}</span>
                      <span>•</span>
                      <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>
                ))}
                {notes.length > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowAllNotes(!showAllNotes)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showAllNotes ? `Show less` : `Show ${notes.length - 3} more note${notes.length - 3 > 1 ? 's' : ''}`}
                  </Button>
                )}
              </div>
            )}
            
            {/* Add Note Input */}
            <div className="space-y-2">
              <MentionInput
                value={newNote}
                onChange={setNewNote}
                users={mentionUsers}
                placeholder="Add a note... Use @ to mention team members"
                rows={2}
                onMentionsChange={setNoteMentions}
              />
              <Button 
                size="sm" 
                onClick={handleAddNote}
                disabled={!newNote.trim() || isAddingNote}
                className="w-full"
              >
                {isAddingNote ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Add Note
                  </>
                )}
              </Button>
            </div>
          </div>

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
              variant="outline"
              onClick={() => {
                onArchive(task.id);
                onOpenChange(false);
              }}
              className="flex-1"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive Task
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