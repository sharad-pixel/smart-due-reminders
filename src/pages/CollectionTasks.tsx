import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CheckSquare, Filter, Loader2, Search, DollarSign, AlertCircle, Phone, HelpCircle, Mail, Archive, ArchiveRestore, UserPlus, Lock, CalendarClock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { ExternalLink } from "lucide-react";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useUserPreferences } from "@/hooks/useUserPreferences";
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

interface TaskNote {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
  mentions?: string[];
}

interface TaskWithRelations {
  id: string;
  user_id: string;
  debtor_id: string;
  invoice_id?: string | null;
  activity_id?: string | null;
  inbound_email_id?: string | null;
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
  notes?: TaskNote[] | unknown[];
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
  const [searchParams, setSearchParams] = useSearchParams();
  const debtorIdFromUrl = searchParams.get('debtor');
  const taskIdFromUrl = searchParams.get('taskId');
  const { permissions, loading: roleLoading } = useRoleAccess();
  const { getPreference, setPreference, isLoaded: prefsLoaded } = useUserPreferences('/tasks');
  
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Filters - load from preferences
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Persisted toggle states
  const showArchived = getPreference('showArchived', false);
  const hideClosed = getPreference('hideClosed', false);
  
  const setShowArchived = (value: boolean) => setPreference('showArchived', value);
  const setHideClosed = (value: boolean) => setPreference('hideClosed', value);

  // Current user ID for "Assigned to Me" filter
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Account users for assignment (paid seats from Teams & Roles)
  const [accountUsers, setAccountUsers] = useState<{id: string; user_id: string; name: string; email: string; role: string}[]>([]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchCurrentUser();
    fetchAccountUsers();
  }, []);

  useEffect(() => {
    if (prefsLoaded) {
      loadTasks();
    }
  }, [statusFilter, priorityFilter, taskTypeFilter, assignedFilter, debtorIdFromUrl, showArchived, prefsLoaded]);

  // Open task modal if taskId is in URL (from notification click)
  useEffect(() => {
    if (taskIdFromUrl && tasks.length > 0 && !isLoading) {
      const task = tasks.find(t => t.id === taskIdFromUrl);
      if (task) {
        handleViewDetails(task);
        // Clear the taskId from URL after opening
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.delete('taskId');
          return newParams;
        });
      }
    }
  }, [taskIdFromUrl, tasks, isLoading]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [statusFilter, priorityFilter, taskTypeFilter, assignedFilter, searchQuery]);

  const fetchAccountUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get effective account ID (owner's ID for team members)
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });

      if (!effectiveAccountId) return;

      // Fetch from account_users for the effective account only
      // Exclude viewers - they cannot be assigned tasks
      const { data, error } = await supabase
        .from('account_users')
        .select('id, user_id, role, status')
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
              name: profile?.name || profile?.email || 'Unknown',
              email: profile?.email || '',
              role: au.role
            };
          })
        );
        setAccountUsers(usersWithProfiles.filter(u => u.id && u.id.trim() !== ''));
      }
    } catch (error) {
      console.error('Error fetching account users:', error);
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
        .eq('is_archived', showArchived)
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
        query = query.is('assigned_to', null);
      } else if (assignedFilter === 'me' && currentUserId) {
        query = query.eq('assigned_to', currentUserId);
      } else if (assignedFilter !== 'all') {
        query = query.eq('assigned_to', assignedFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const tasksWithUserNames = await Promise.all(
        (data || []).map(async (task: any) => {
          if (task.assigned_to) {
            // assigned_to now stores user_id from account_users
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

  const handleArchive = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          is_archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task archived");
      loadTasks();
    } catch (error) {
      console.error("Error archiving task:", error);
      toast.error("Failed to archive task");
    }
  };

  const handleUnarchive = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          is_archived: false, 
          archived_at: null 
        })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task restored");
      loadTasks();
    } catch (error) {
      console.error("Error restoring task:", error);
      toast.error("Failed to restore task");
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

  const handleBulkArchive = async () => {
    if (selectedTaskIds.size === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ 
          is_archived: !showArchived, 
          archived_at: !showArchived ? new Date().toISOString() : null 
        })
        .in("id", Array.from(selectedTaskIds));

      if (error) throw error;
      toast.success(`${selectedTaskIds.size} task(s) ${showArchived ? 'restored' : 'archived'}`);
      setSelectedTaskIds(new Set());
      setShowArchiveDialog(false);
      loadTasks();
    } catch (error) {
      console.error("Error bulk archiving tasks:", error);
      toast.error(`Failed to ${showArchived ? 'restore' : 'archive'} tasks`);
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

  const getAssignedDisplay = (task: TaskWithRelations) => {
    if (task.assigned_user_name) {
      return (
        <span className="text-sm">{task.assigned_user_name}</span>
      );
    }
    return <span className="text-sm text-muted-foreground">Unassigned</span>;
  };

  const getInboundLink = (task: TaskWithRelations) => {
    if (task.inbound_email_id) {
      // Pass invoice_id from task context so AI response can use it
      const params = new URLSearchParams({ email: task.inbound_email_id });
      if (task.invoice_id) {
        params.set('invoiceId', task.invoice_id);
      }
      return (
        <Link 
          to={`/inbound?${params.toString()}`}
          className="flex items-center gap-1 text-primary hover:underline text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          View Email
        </Link>
      );
    }
    return <span className="text-sm text-muted-foreground">-</span>;
  };

  // Count stats
  const openCount = tasks.filter(t => t.status === 'open').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2">
              <CheckSquare className="h-6 w-6 sm:h-8 sm:w-8" />
              <span className="hidden sm:inline">Collection Tasks</span>
              <span className="sm:hidden">Tasks</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground hidden sm:block">
            AI-extracted action items from customer responses
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs sm:text-sm">
              {openCount} Open
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-sm">
              {inProgressCount} In Progress
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-sm">
              {doneCount} Done
            </Badge>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedTaskIds.size > 0 && permissions.canEditTasks && (
          <Card className="border-primary">
            <CardContent className="py-2 sm:py-3 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-sm font-medium">
                  {selectedTaskIds.size} selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Select onValueChange={handleBulkStatusChange} disabled={isBulkProcessing}>
                    <SelectTrigger className="w-[110px] sm:w-[140px] h-8 text-xs sm:text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>

                  {permissions.canAssignTasks && (
                    <Select 
                      onValueChange={(value) => {
                        if (value === 'unassigned') {
                          handleBulkAssign(null, null);
                        } else {
                          handleBulkAssign(value, null);
                        }
                      }} 
                      disabled={isBulkProcessing}
                    >
                      <SelectTrigger className="w-[110px] sm:w-[160px] h-8 text-xs sm:text-sm">
                        <SelectValue placeholder="Assign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassign</SelectItem>
                        {accountUsers.map(user => (
                          <SelectItem key={user.id} value={user.user_id}>
                            <div className="flex items-center gap-2">
                              <UserPlus className="h-4 w-4" />
                              {user.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {permissions.canDeleteTasks && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowArchiveDialog(true)}
                      disabled={isBulkProcessing}
                      className="h-8 text-xs sm:text-sm"
                    >
                      {showArchived ? <ArchiveRestore className="h-4 w-4 sm:mr-1" /> : <Archive className="h-4 w-4 sm:mr-1" />}
                      <span className="hidden sm:inline">{showArchived ? 'Restore' : 'Archive'}</span>
                    </Button>
                  )}

                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedTaskIds(new Set())}
                    className="h-8 text-xs sm:text-sm"
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
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
              <div className="relative col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 sm:h-10 text-sm"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
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
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
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
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Type" />
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
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="me">Assigned to Me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {accountUsers.map(user => (
                    <SelectItem key={user.id} value={user.user_id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Toggle filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-closed"
                  checked={hideClosed}
                  onCheckedChange={setHideClosed}
                />
                <Label htmlFor="hide-closed" className="text-xs sm:text-sm cursor-pointer">
                  Hide closed
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="show-archived" className="text-xs sm:text-sm cursor-pointer flex items-center gap-1">
                  <Archive className="h-3 w-3 sm:h-4 sm:w-4" />
                  Archived
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks - Desktop Table / Mobile Cards */}
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
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
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
                        <TableHead className="w-24">Days Open</TableHead>
                        <TableHead className="w-32">Created</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="min-w-[200px]">Summary</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Inbound</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => {
                        const daysOpen = task.created_at ? differenceInDays(new Date(), new Date(task.created_at)) : 0;
                        return (
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
                            <TableCell>
                              <Badge variant={daysOpen > 7 ? "destructive" : daysOpen > 3 ? "default" : "secondary"} className="flex items-center gap-1 w-fit">
                                <CalendarClock className="h-3 w-3" />
                                {daysOpen === 0 ? 'Today' : `${daysOpen}d`}
                              </Badge>
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
                            <TableCell>{getInboundLink(task)}</TableCell>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y">
                  {filteredTasks.map((task) => {
                    const daysOpen = task.created_at ? differenceInDays(new Date(), new Date(task.created_at)) : 0;
                    return (
                      <div
                        key={task.id}
                        className={`p-4 cursor-pointer active:bg-muted/50 transition-colors ${selectedTaskIds.has(task.id) ? 'bg-muted/30' : ''}`}
                        onClick={() => handleViewDetails(task)}
                      >
                        <div className="flex items-start gap-3">
                          <div onClick={(e) => e.stopPropagation()} className="pt-1">
                            <Checkbox 
                              checked={selectedTaskIds.has(task.id)}
                              onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                              aria-label={`Select task ${task.summary}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Header row with priority and days open */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {getPriorityBadge(task.priority)}
                              <Badge variant={daysOpen > 7 ? "destructive" : daysOpen > 3 ? "default" : "secondary"} className="text-xs">
                                <CalendarClock className="h-3 w-3 mr-1" />
                                {daysOpen === 0 ? 'Today' : `${daysOpen}d`}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {getTaskIcon(task.task_type)}
                                <span>{task.task_type.replace(/_/g, " ")}</span>
                              </div>
                            </div>
                            
                            {/* Summary */}
                            <p className="text-sm font-medium line-clamp-2">{task.summary}</p>
                            
                            {/* Account & Invoice info */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {task.debtors?.name && (
                                <span className="font-medium text-foreground">{task.debtors.name}</span>
                              )}
                              {task.invoices?.invoice_number && (
                                <span className="font-mono">#{task.invoices.invoice_number}</span>
                              )}
                              {task.assigned_user_name && (
                                <span>→ {task.assigned_user_name}</span>
                              )}
                            </div>
                            
                            {/* Status selector */}
                            <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={task.status}
                                onValueChange={(value) => handleStatusChange(task.id, value)}
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="done">Done</SelectItem>
                                </SelectContent>
                              </Select>
                              {task.inbound_email_id && (
                                <Link 
                                  to={`/inbound?email=${task.inbound_email_id}${task.invoice_id ? `&invoiceId=${task.invoice_id}` : ''}`}
                                  className="flex items-center gap-1 text-primary hover:underline text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Mail className="h-3 w-3" />
                                  View Email
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          onStatusChange={handleStatusChange}
          onArchive={showArchived ? handleUnarchive : handleArchive}
          onAssign={handleAssign}
          onNoteAdded={loadTasks}
        />

        {/* Bulk Archive Confirmation */}
        <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{showArchived ? 'Restore' : 'Archive'} {selectedTaskIds.size} task(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                {showArchived 
                  ? 'These tasks will be restored to your active task list.'
                  : 'Archived tasks can be restored later from the archived view.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkArchive}
              >
                {isBulkProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {showArchived ? 'Restore' : 'Archive'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
