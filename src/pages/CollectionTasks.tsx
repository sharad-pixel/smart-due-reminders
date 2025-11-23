import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollectionTasks, CollectionTask } from "@/hooks/useCollectionTasks";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CheckSquare, Filter, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function CollectionTasks() {
  const [searchParams] = useSearchParams();
  const debtorIdFromUrl = searchParams.get('debtor');
  
  const { fetchTasks, updateTaskStatus, deleteTask, isLoading } = useCollectionTasks();
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTasks();
  }, [statusFilter, priorityFilter, taskTypeFilter, debtorIdFromUrl]);

  const loadTasks = async () => {
    const filters: any = {};
    
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    if (priorityFilter !== 'all') {
      filters.priority = priorityFilter;
    }
    if (taskTypeFilter !== 'all') {
      filters.task_type = taskTypeFilter;
    }
    if (debtorIdFromUrl) {
      filters.debtor_id = debtorIdFromUrl;
    }

    const data = await fetchTasks(filters);
    setTasks(data);
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    await updateTaskStatus(taskId, status);
    loadTasks();
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    loadTasks();
  };

  const handleViewDetails = (task: CollectionTask) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  // Filter tasks by search query
  const filteredTasks = tasks.filter(task => 
    searchQuery === '' || 
    task.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.details?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group tasks by status for Kanban view
  const openTasks = filteredTasks.filter(t => t.status === 'open');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

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
  ];

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CheckSquare className="h-8 w-8" />
              Collection Tasks
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-extracted action items from customer responses
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm">
              {openTasks.length} Open
            </Badge>
            <Badge variant="outline" className="text-sm">
              {inProgressTasks.length} In Progress
            </Badge>
            <Badge variant="outline" className="text-sm">
              {doneTasks.length} Done
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
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
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Open Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Open</h3>
                <Badge variant="secondary">{openTasks.length}</Badge>
              </div>
              <div className="space-y-3">
                {openTasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No open tasks
                    </CardContent>
                  </Card>
                ) : (
                  openTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onViewDetails={handleViewDetails}
                    />
                  ))
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">In Progress</h3>
                <Badge variant="secondary">{inProgressTasks.length}</Badge>
              </div>
              <div className="space-y-3">
                {inProgressTasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No tasks in progress
                    </CardContent>
                  </Card>
                ) : (
                  inProgressTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onViewDetails={handleViewDetails}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Done Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Done</h3>
                <Badge variant="secondary">{doneTasks.length}</Badge>
              </div>
              <div className="space-y-3">
                {doneTasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No completed tasks
                    </CardContent>
                  </Card>
                ) : (
                  doneTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onViewDetails={handleViewDetails}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      </div>
    </Layout>
  );
}