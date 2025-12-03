import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CheckSquare, Filter, Loader2, Search, DollarSign, AlertCircle, Phone, HelpCircle, Mail, Trash2, UserPlus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TaskWithRelations {
  id: string;
  user_id: string;
  debtor_id: string;
  invoice_id?: string | null;
  activity_id?: string | null;
  task_type: string;
  priority: string;
  status: string;
  summary: string;
  details?: string | null;
  ai_reasoning?: string | null;
  recommended_action?: string | null;
  assigned_to?: string | null;
  assigned_persona?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  from_email?: string | null;
  source?: string | null;
  subject?: string | null;
  to_email?: string | null;
  raw_email?: string | null;
  level?: string | null;
  debtors?: {
    name: string;
    company_name: string;
  };
  invoices?: {
    invoice_number: string;
  } | null;
  assigned_user_name?: string | null;
}

export default function CollectionTasks() {
  const [searchParams] = useSearchParams();
  const debtorIdFromUrl = searchParams.get('debtor');
  
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideClosed, setHideClosed] = useState(false);

  // Team members for filter
  const [teamMembers, setTeamMembers] = useState<{id: string; name: string; email: string}[]>([]);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [statusFilter, priorityFilter, taskTypeFilter, assignedFilter, debtorIdFromUrl]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [statusFilter, priorityFilter, taskTypeFilter, assignedFilter, searchQuery]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setTeamMembers(
        data
          .filter(m => m.id && m.id.trim() !== '')
          .map(m => ({
            id: m.id,
            name: m.name,
            email: m.email
          }))
      );
    }
  };

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("collection_tasks")
        .select(`
          *,
          debtors!inner(name, company_name),
          invoices(invoice_number)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }
      if (taskTypeFilter !== 'all') {
        query = query.eq('task_type', taskTypeFilter);
      }
      if (debtorIdFromUrl) {
        query = query.eq('debtor_id', debtorIdFromUrl);
      }
      if (assignedFilter === 'unassigned') {
        query = query.is('assigned_to', null).is('assigned_persona', null);
      } else if (assignedFilter === 'persona') {
        query = query.not('assigned_persona', 'is', null);
      } else if (assignedFilter !== 'all') {
        query = query.eq('assigned_to', assignedFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const tasksWithUserNames = await Promise.all(
        (data || []).map(async (task: any) => {
          if (task.assigned_to) {
            const { data: teamMember } = await supabase
              .from('team_members')
              .select('name, email')
              .eq('id', task.assigned_to)
              .single();
            return {
              ...task,
              assigned_user_name: teamMember?.name || teamMember?.email || null
            } as TaskWithRelations;
          }
          return { ...task, assigned_user_name: null } as TaskWithRelations;
        })
      );
      
      setTasks(tasksWithUserNames);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task status updated");
      loadTasks();
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
      loadTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleAssign = async (taskId: string, assignedTo: string | null, assignedPersona: string | null) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          assigned_to: assignedTo, 
          assigned_persona: assignedPersona 
        })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task assigned");
      loadTasks();
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    }
  };

  // Bulk action handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTaskIds);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedTaskIds.size === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          status, 
          completed_at: status === 'done' ? new Date().toISOString() : null 
        })
        .in("id", Array.from(selectedTaskIds));

      if (error) throw error;
      toast.success(`${selectedTaskIds.size} task(s) updated to ${status}`);
      setSelectedTaskIds(new Set());
      loadTasks();
    } catch (error) {
      console.error("Error bulk updating tasks:", error);
      toast.error("Failed to update tasks");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssign = async (assignedTo: string | null, assignedPersona: string | null) => {
    if (selectedTaskIds.size === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          assigned_to: assignedTo, 
          assigned_persona: assignedPersona 
        })
        .in("id", Array.from(selectedTaskIds));

      if (error) throw error;
      
      // Send email notifications for team member assignments
      if (assignedTo) {
        const taskIds = Array.from(selectedTaskIds);
        for (const taskId of taskIds) {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            try {
              await supabase.functions.invoke('send-task-assignment', {
                body: {
                  taskId,
                  teamMemberId: assignedTo,
                  debtorId: task.debtor_id,
                  invoiceId: task.invoice_id,
                }
              });
            } catch (emailError) {
              console.error("Error sending assignment email:", emailError);
            }
          }
        }
      }
      
      toast.success(`${selectedTaskIds.size} task(s) assigned`);
      setSelectedTaskIds(new Set());
      loadTasks();
    } catch (error) {
      console.error("Error bulk assigning tasks:", error);
      toast.error("Failed to assign tasks");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .delete()
        .in("id", Array.from(selectedTaskIds));

      if (error) throw error;
      toast.success(`${selectedTaskIds.size} task(s) deleted`);
      setSelectedTaskIds(new Set());
      setShowDeleteDialog(false);
      loadTasks();
    } catch (error) {
      console.error("Error bulk deleting tasks:", error);
      toast.error("Failed to delete tasks");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleViewDetails = (task: TaskWithRelations) => {
    setSelectedTask({
      ...task,
      priority: task.priority as 'low' | 'normal' | 'high' | 'urgent',
      status: task.status as 'open' | 'in_progress' | 'done' | 'cancelled',
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
    });
    setShowDetailModal(true);
  };

  // Filter tasks by search query and hide closed toggle
  const filteredTasks = tasks.filter(task => {
    // Hide closed/done tasks if toggle is on
    if (hideClosed && task.status === 'done') {
      return false;
    }
    // Search filter
    return searchQuery === '' || 
      task.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.debtors?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.debtors?.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.invoices?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isAllSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.has(t.id));
  const isSomeSelected = filteredTasks.some(t => selectedTaskIds.has(t.id));

  // Task type options
  const taskTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'w9_request', label: 'W9 Request' },
    { value: 'payment_plan_needed', label: 'Payment Plan Needed' },
    { value: 'incorrect_po', label: 'Incorrect PO' },
    { value: 'dispute_charges', label: 'Dispute Charges' },
    { value: 'invoice_copy_request', label: 'Invoice Copy Request' },
    { value: 'billing_address_update', label: 'Address Update' },
    { value: 'payment_method_update', label: 'Payment Method Update' },
    { value: 'service_not_delivered', label: 'Service Not Delivered' },
    { value: 'overpayment_inquiry', label: 'Overpayment Question' },
    { value: 'paid_verification', label: 'Payment Verification' },
    { value: 'extension_request', label: 'Extension Request' },
    { value: 'callback_required', label: 'Callback Required' },
    { value: 'SETUP_PAYMENT_PLAN', label: 'Setup Payment Plan' },
    { value: 'REVIEW_DISPUTE', label: 'Review Dispute' },
    { value: 'CALL_CUSTOMER', label: 'Call Customer' },
    { value: 'MANUAL_REVIEW', label: 'Manual Review' },
  ];

  const personas = ['Sam', 'James', 'Katy', 'Troy', 'Gotti', 'Rocco'];

  const getTaskIcon = (taskType: string) => {
    const type = taskType.toUpperCase();
    if (type.includes('PAYMENT')) return <DollarSign className="h-4 w-4" />;
    if (type.includes('DISPUTE')) return <AlertCircle className="h-4 w-4" />;
    if (type.includes('CALL')) return <Phone className="h-4 w-4" />;
    if (type.includes('REVIEW') || type.includes('MANUAL')) return <HelpCircle className="h-4 w-4" />;
    return <CheckSquare className="h-4 w-4" />;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-destructive text-destructive-foreground',
      high: 'bg-orange-500 text-white',
      normal: 'bg-secondary text-secondary-foreground',
      low: 'bg-muted text-muted-foreground',
    };
    return <Badge className={colors[priority] || colors.normal}>{priority}</Badge>;
  };

  const getSourceBadge = (source: string | null | undefined) => {
    if (source === "email_reply") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Mail className="h-3 w-3" />
          Email
        </Badge>
      );
    }
    return null;
  };

  const getAssignedDisplay = (task: TaskWithRelations) => {
    if (task.assigned_persona) {
      return (
        <div className="flex items-center gap-2">
          <PersonaAvatar persona={task.assigned_persona} size="sm" />
          <span className="text-sm">{task.assigned_persona}</span>
        </div>
      );
    }
    if (task.assigned_user_name) {
      return (
        <span className="text-sm">{task.assigned_user_name}</span>
      );
    }
    return <span className="text-sm text-muted-foreground">Unassigned</span>;
  };

  // Count stats
  const openCount = tasks.filter(t => t.status === 'open').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CheckSquare className="h-8 w-8" />
              Collection Tasks
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-extracted action items from customer responses
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm">
              {openCount} Open
            </Badge>
            <Badge variant="outline" className="text-sm">
              {inProgressCount} In Progress
            </Badge>
            <Badge variant="outline" className="text-sm">
              {doneCount} Done
            </Badge>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedTaskIds.size > 0 && (
          <Card className="border-primary">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedTaskIds.size} task(s) selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Select onValueChange={handleBulkStatusChange} disabled={isBulkProcessing}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="Set Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    onValueChange={(value) => {
                      if (value === 'unassigned') {
                        handleBulkAssign(null, null);
                      } else if (personas.includes(value)) {
                        handleBulkAssign(null, value);
                      } else {
                        handleBulkAssign(value, null);
                      }
                    }} 
                    disabled={isBulkProcessing}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue placeholder="Assign To" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassign</SelectItem>
                      {personas.map(persona => (
                        <SelectItem key={persona} value={persona}>
                          <div className="flex items-center gap-2">
                            <PersonaAvatar persona={persona} size="sm" />
                            {persona}
                          </div>
                        </SelectItem>
                      ))}
                      {teamMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            {member.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isBulkProcessing}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedTaskIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Task Type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="persona">AI Persona</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Hide closed toggle */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Switch
                id="hide-closed"
                checked={hideClosed}
                onCheckedChange={setHideClosed}
              />
              <Label htmlFor="hide-closed" className="text-sm cursor-pointer">
                Hide closed tasks
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No tasks found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                          className={isSomeSelected && !isAllSelected ? "opacity-50" : ""}
                        />
                      </TableHead>
                      <TableHead className="w-36">Created</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="min-w-[200px]">Summary</TableHead>
                      <TableHead>Debtor</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedTaskIds.has(task.id) ? 'bg-muted/30' : ''}`}
                        onClick={() => handleViewDetails(task)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedTaskIds.has(task.id)}
                            onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                            aria-label={`Select task ${task.summary}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(task.created_at || '').toLocaleDateString()}
                        </TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTaskIcon(task.task_type)}
                            <span className="text-sm whitespace-nowrap">{task.task_type.replace(/_/g, " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="space-y-1">
                            <p className="text-sm line-clamp-2">{task.summary}</p>
                            {task.from_email && (
                              <p className="text-xs text-muted-foreground">From: {task.from_email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{task.debtors?.name}</p>
                            <p className="text-xs text-muted-foreground">{task.debtors?.company_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {task.invoices?.invoice_number || "-"}
                        </TableCell>
                        <TableCell>{getAssignedDisplay(task)}</TableCell>
                        <TableCell>{getSourceBadge(task.source)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={task.status}
                            onValueChange={(value) => handleStatusChange(task.id, value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onAssign={handleAssign}
        />

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedTaskIds.size} task(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. These tasks will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isBulkProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
