import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CheckSquare, Filter, Loader2, Search, DollarSign, AlertCircle, Phone, HelpCircle, Mail } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { PersonaAvatar } from "@/components/PersonaAvatar";

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

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Team members for filter
  const [teamMembers, setTeamMembers] = useState<{id: string; name: string}[]>([]);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [statusFilter, priorityFilter, taskTypeFilter, assignedFilter, debtorIdFromUrl]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email');
    
    if (data) {
      setTeamMembers(data.map(p => ({
        id: p.id,
        name: p.name || p.email
      })));
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
      
      // Fetch assigned user names separately
      const tasksWithUserNames = await Promise.all(
        (data || []).map(async (task: any) => {
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', task.assigned_to)
              .single();
            return {
              ...task,
              assigned_user_name: profile?.name || profile?.email || null
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

  const handleViewDetails = (task: TaskWithRelations) => {
    // Cast to CollectionTask for the modal
    setSelectedTask({
      ...task,
      priority: task.priority as 'low' | 'normal' | 'high' | 'urgent',
      status: task.status as 'open' | 'in_progress' | 'done' | 'cancelled',
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
    });
    setShowDetailModal(true);
  };

  // Filter tasks by search query
  const filteredTasks = tasks.filter(task => 
    searchQuery === '' || 
    task.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.debtors?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.debtors?.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.invoices?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(task)}
                      >
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
      </div>
    </Layout>
  );
}
