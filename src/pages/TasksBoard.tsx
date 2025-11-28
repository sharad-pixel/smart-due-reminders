import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ListTodo, FileText, User, DollarSign, AlertCircle, Phone, HelpCircle, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  debtor_id: string;
  invoice_id: string | null;
  task_type: string;
  level: string | null;
  summary: string;
  details: string | null;
  status: string;
  priority: string;
  source: string | null;
  from_email: string | null;
  subject: string | null;
  created_at: string;
  debtors: {
    name: string;
    company_name: string;
  };
  invoices: {
    invoice_number: string;
  } | null;
}

const TasksBoard = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select(`
          *,
          debtors!inner(name, company_name),
          invoices(invoice_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task status updated");
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const filterTasks = (filterType: string) => {
    switch (filterType) {
      case "invoice":
        return tasks.filter(t => t.level === "invoice");
      case "debtor":
        return tasks.filter(t => t.level === "debtor");
      case "payment_plan":
        return tasks.filter(t => t.task_type === "SETUP_PAYMENT_PLAN");
      case "dispute":
        return tasks.filter(t => t.task_type === "REVIEW_DISPUTE");
      case "call":
        return tasks.filter(t => t.task_type === "CALL_CUSTOMER");
      case "manual":
        return tasks.filter(t => t.task_type === "MANUAL_REVIEW");
      default:
        return tasks;
    }
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case "SETUP_PAYMENT_PLAN":
        return <DollarSign className="h-4 w-4" />;
      case "REVIEW_DISPUTE":
        return <AlertCircle className="h-4 w-4" />;
      case "CALL_CUSTOMER":
        return <Phone className="h-4 w-4" />;
      case "MANUAL_REVIEW":
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <ListTodo className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "in_progress":
        return "secondary";
      case "done":
        return "outline";
      default:
        return "default";
    }
  };

  const getLevelBadge = (level: string | null) => {
    if (level === "invoice") {
      return (
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          Invoice
        </Badge>
      );
    } else if (level === "debtor") {
      return (
        <Badge variant="outline" className="gap-1">
          <User className="h-3 w-3" />
          Debtor
        </Badge>
      );
    }
    return null;
  };

  const getSourceBadge = (source: string | null) => {
    if (source === "email_reply") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Mail className="h-3 w-3" />
          Email Reply
        </Badge>
      );
    }
    return null;
  };

  const handleRowClick = (task: Task) => {
    if (task.invoice_id) {
      navigate(`/invoices/${task.invoice_id}`);
    } else if (task.debtor_id) {
      navigate(`/debtors/${task.debtor_id}`);
    }
  };

  const renderTasksTable = (filteredTasks: Task[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (filteredTasks.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Created</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Debtor</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-32">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(task)}
            >
              <TableCell className="text-sm text-muted-foreground">
                {new Date(task.created_at).toLocaleString()}
              </TableCell>
              <TableCell>{getLevelBadge(task.level)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getTaskIcon(task.task_type)}
                  <span className="text-sm">{task.task_type.replace(/_/g, " ")}</span>
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
                  <p className="font-medium text-sm">{task.debtors.name}</p>
                  <p className="text-xs text-muted-foreground">{task.debtors.company_name}</p>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {task.invoices?.invoice_number || "-"}
              </TableCell>
              <TableCell>{getSourceBadge(task.source)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Select
                  value={task.status}
                  onValueChange={(value) => handleStatusChange(task.id, value)}
                >
                  <SelectTrigger>
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
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-primary">Tasks Board</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer replies and action items across invoices and debtors
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="all">All Tasks</TabsTrigger>
            <TabsTrigger value="invoice">Invoice-Level</TabsTrigger>
            <TabsTrigger value="debtor">Debtor-Level</TabsTrigger>
            <TabsTrigger value="payment_plan">Payment Plans</TabsTrigger>
            <TabsTrigger value="dispute">Disputes</TabsTrigger>
            <TabsTrigger value="call">Call Requests</TabsTrigger>
            <TabsTrigger value="manual">Manual Review</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("all"))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice">
            <Card>
              <CardHeader>
                <CardTitle>Invoice-Level Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("invoice"))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debtor">
            <Card>
              <CardHeader>
                <CardTitle>Debtor-Level Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("debtor"))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment_plan">
            <Card>
              <CardHeader>
                <CardTitle>Payment Plan Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("payment_plan"))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dispute">
            <Card>
              <CardHeader>
                <CardTitle>Disputes</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("dispute"))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="call">
            <Card>
              <CardHeader>
                <CardTitle>Call Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("call"))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Manual Review</CardTitle>
              </CardHeader>
              <CardContent>
                {renderTasksTable(filterTasks("manual"))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default TasksBoard;
