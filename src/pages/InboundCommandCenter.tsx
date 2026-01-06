import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInboundEmails, InboundEmail } from "@/hooks/useInboundEmails";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Inbox,
  Filter,
  Loader2,
  Mail,
  User,
  FileText,
  Calendar,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  Bot,
  Sparkles,
  ExternalLink,
  Forward,
  CheckSquare,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Trash2,
  ListTodo,
  X,
  MoreVertical,
  Search,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateBrandedEmail, BrandingSettings } from "@/lib/emailSignature";
interface EmailTask {
  id: string;
  task_type: string;
  priority: string;
  status: string;
  summary: string;
  details: string | null;
  recommended_action: string | null;
  due_date: string | null;
  created_at: string;
}

interface EmailDetailContentProps {
  email: InboundEmail;
  tasks: EmailTask[];
  loadingTasks: boolean;
  onForward: () => void;
  onClose: () => void;
  onReopen: () => void;
  onGenerateAIResponse: () => void;
  onTaskClick: (task: EmailTask) => void;
  isGeneratingAI: boolean;
  getPriorityColor: (priority: string) => string;
  getCategoryColor: (category: string) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getSentimentIcon: (sentiment: string) => React.ReactNode;
  getActionIcon: (type: string) => React.ReactNode;
}

const EmailDetailContent = ({
  email,
  tasks,
  loadingTasks,
  onForward,
  onClose,
  onReopen,
  onGenerateAIResponse,
  onTaskClick,
  isGeneratingAI,
  getPriorityColor,
  getCategoryColor,
  getStatusColor,
  getStatusIcon,
  getSentimentIcon,
  getActionIcon,
}: EmailDetailContentProps) => (
  <div className="space-y-4 md:space-y-6">
    {/* Action Buttons */}
    <div className="flex gap-2 flex-wrap">
      <Button size="sm" variant="default" onClick={onGenerateAIResponse} disabled={isGeneratingAI}>
        {isGeneratingAI ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Generate AI Response
      </Button>
      <Button size="sm" variant="outline" onClick={onForward}>
        <Forward className="h-4 w-4 mr-2" />
        Forward
      </Button>
      {(email as any).action_status !== "closed" ? (
        <Button size="sm" variant="outline" onClick={onClose}>
          <CheckSquare className="h-4 w-4 mr-2" />
          Close
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onReopen}>
          <Clock className="h-4 w-4 mr-2" />
          Reopen
        </Button>
      )}
    </div>

    <Separator />

    {/* Status & Classification */}
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Status</h3>
      <div className="flex flex-wrap gap-1.5">
        <Badge className={getStatusColor(email.status)}>
          {getStatusIcon(email.status)}
          <span className="ml-1">{email.status}</span>
        </Badge>
        {(email as any).ai_category && (
          <Badge className={getCategoryColor((email as any).ai_category)}>
            <Tag className="h-3 w-3 mr-1" />
            {(email as any).ai_category}
          </Badge>
        )}
        {(email as any).ai_priority && (
          <Badge className={getPriorityColor((email as any).ai_priority)}>
            {(email as any).ai_priority}
          </Badge>
        )}
        {(email as any).ai_sentiment && (
          <Badge variant="outline" className="gap-1">
            {getSentimentIcon((email as any).ai_sentiment)}
            {(email as any).ai_sentiment}
          </Badge>
        )}
        {(email as any).action_status && (
          <Badge variant={(email as any).action_status === "closed" ? "secondary" : "default"}>
            {(email as any).action_status}
          </Badge>
        )}
      </div>
    </div>

    <Separator />

    {/* Email Info - Mobile optimized */}
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Email Info</h3>
      <div className="space-y-1.5 text-sm">
        <div className="flex flex-col md:flex-row md:justify-between gap-0.5">
          <span className="text-muted-foreground text-xs md:text-sm">From:</span>
          <span className="font-medium break-all">{email.from_email}</span>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between gap-0.5">
          <span className="text-muted-foreground text-xs md:text-sm">To:</span>
          <span className="font-medium break-all">{email.to_emails[0]}</span>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between gap-0.5">
          <span className="text-muted-foreground text-xs md:text-sm">Received:</span>
          <span>{format(new Date(email.created_at), "PPp")}</span>
        </div>
      </div>
    </div>

    <Separator />

    {/* AI Summary */}
    {email.ai_summary && (
      <>
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-500" />
            AI Summary
          </h3>
          <p className="text-sm text-muted-foreground italic bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md">
            {email.ai_summary}
          </p>
        </div>
        <Separator />
      </>
    )}

    {/* Actions */}
    {email.ai_actions && email.ai_actions.length > 0 && (
      <>
        <div>
          <h3 className="text-sm font-medium mb-2">Extracted Actions</h3>
          <div className="space-y-2">
            {email.ai_actions.map((action, idx) => (
              <Card key={idx}>
                <CardContent className="py-2 px-3">
                  <div className="flex items-start gap-2">
                    {getActionIcon(action.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{action.type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.details}</p>
                      <p className="text-xs text-muted-foreground">
                        {(action.confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Separator />
      </>
    )}

    {/* Created Tasks */}
    {(tasks.length > 0 || loadingTasks) && (
      <>
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-blue-500" />
            Tasks ({tasks.length})
          </h3>
          {loadingTasks ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onTaskClick(task)}
                >
                  <CardContent className="py-2 px-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <Badge variant={task.status === "open" ? "default" : "secondary"} className="text-xs">
                            {task.status}
                          </Badge>
                          <Badge className={getPriorityColor(task.priority)} variant="outline">
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm line-clamp-2">{task.summary}</p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {format(new Date(task.due_date), "MMM d")}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <Separator />
      </>
    )}

    {/* Linked Records */}
    {(email.debtors || email.invoices) && (
      <>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Linked Records</h3>
          {email.debtors && (
            <Link to={`/debtors/${email.debtor_id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{(email.debtors as any).name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(email.debtors as any).company_name}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {email.invoices && (
            <Link to={`/invoices/${email.invoice_id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {(email.invoices as any).invoice_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${(email.invoices as any).amount}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
        <Separator />
      </>
    )}

    {/* Email Body */}
    <div>
      <h3 className="text-sm font-medium mb-2">Message</h3>
      <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap break-words">
        {email.text_body || email.html_body || "No content"}
      </div>
    </div>
  </div>
);

const InboundCommandCenter = () => {
  const { fetchInboundEmails, triggerAIProcessing, updateActionStatus, archiveEmail, unarchiveEmail, forwardEmails, isLoading } = useInboundEmails();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [archivedEmails, setArchivedEmails] = useState<InboundEmail[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emailTasks, setEmailTasks] = useState<EmailTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiResponseDialogOpen, setAiResponseDialogOpen] = useState(false);
  const [generatedResponse, setGeneratedResponse] = useState<{ subject: string | null; body: string } | null>(null);
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<CollectionTask | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [contextInvoiceId, setContextInvoiceId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const handleTaskClick = (task: EmailTask) => {
    // Convert EmailTask to CollectionTask format
    setSelectedTaskForDetail({
      id: task.id,
      task_type: task.task_type,
      priority: task.priority,
      status: task.status,
      summary: task.summary,
      details: task.details,
      recommended_action: task.recommended_action,
      due_date: task.due_date,
      created_at: task.created_at,
    } as CollectionTask);
    setTaskDetailOpen(true);
  };

  const createPendingResponseTask = async (email: InboundEmail) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !email.debtor_id) return;
      
      // Check if a pending response task already exists for this email
      const { data: existingTask } = await supabase
        .from("collection_tasks")
        .select("id")
        .eq("inbound_email_id", email.id)
        .eq("task_type", "pending_response")
        .eq("status", "open")
        .single();
      
      if (existingTask) return; // Task already exists
      
      const { data: { session } } = await supabase.auth.getSession();

      const { data: newTask, error: insertError } = await supabase
        .from("collection_tasks")
        .insert({
          user_id: user.id,
          debtor_id: email.debtor_id,
          invoice_id: email.invoice_id,
          inbound_email_id: email.id,
          task_type: "pending_response",
          priority: "high",
          status: "open",
          summary: `Response pending: ${email.subject || 'No subject'}`,
          details: `AI response was generated but not sent for email from ${email.from_email}. Review and send the response.`,
          source: "ai_generated",
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (newTask?.id && session?.access_token) {
        try {
          await supabase.functions.invoke('notify-task-created', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: {
              taskId: newTask.id,
              creatorUserId: user.id,
            },
          });
        } catch (notifyErr) {
          console.error('Task notification error (pending response task):', notifyErr);
        }
      }
    } catch (err) {
      console.error("Error creating pending response task:", err);
    }
  };

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actionStatusFilter, setActionStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [debtorStatusFilter, setDebtorStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [hideClosed, setHideClosed] = useState(() => {
    const saved = localStorage.getItem("inbound_hide_closed");
    return saved === "true";
  });

  // Persist hideClosed preference
  useEffect(() => {
    localStorage.setItem("inbound_hide_closed", String(hideClosed));
  }, [hideClosed]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, actionFilter, actionStatusFilter, categoryFilter, priorityFilter, debtorStatusFilter, hideClosed]);

  // Handle email query parameter to auto-open email details
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const emailIdParam = searchParams.get("email");
    const invoiceIdParam = searchParams.get("invoiceId");
    
    // Store invoice_id from task context for AI response generation
    if (invoiceIdParam) {
      setContextInvoiceId(invoiceIdParam);
    }
    
    if (emailIdParam && emails.length > 0) {
      const emailToOpen = emails.find(e => e.id === emailIdParam);
      if (emailToOpen) {
        handleViewDetails(emailToOpen);
        // Clear the query param after opening
        setSearchParams({});
      } else {
        // Email not in current list, fetch it directly
        fetchEmailById(emailIdParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emails, searchParams]);

  const fetchEmailById = async (emailId: string) => {
    try {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select(`
          *,
          debtors:debtor_id (id, name, company_name),
          invoices:invoice_id (id, invoice_number, amount)
        `)
        .eq("id", emailId)
        .single();
      
      if (error) {
        console.error("Error fetching email:", error);
        return;
      }
      
      if (data) {
        handleViewDetails(data as unknown as InboundEmail);
        setSearchParams({});
      }
    } catch (err) {
      console.error("Error fetching email by ID:", err);
    }
  };

  const loadEmails = async () => {
    // Load active emails
    const activeData = await fetchInboundEmails({
      status: statusFilter !== "all" ? statusFilter : undefined,
      action_type: actionFilter !== "all" ? actionFilter : undefined,
      action_status: actionStatusFilter !== "all" ? actionStatusFilter : undefined,
      ai_category: categoryFilter !== "all" ? categoryFilter : undefined,
      ai_priority: priorityFilter !== "all" ? priorityFilter : undefined,
      debtor_status: debtorStatusFilter,
      hide_closed: hideClosed,
      search: searchQuery || undefined,
      is_archived: false,
    });
    setEmails(activeData);
    
    // Load archived emails
    const archivedData = await fetchInboundEmails({
      status: statusFilter !== "all" ? statusFilter : undefined,
      action_type: actionFilter !== "all" ? actionFilter : undefined,
      action_status: actionStatusFilter !== "all" ? actionStatusFilter : undefined,
      ai_category: categoryFilter !== "all" ? categoryFilter : undefined,
      ai_priority: priorityFilter !== "all" ? priorityFilter : undefined,
      debtor_status: debtorStatusFilter,
      hide_closed: hideClosed,
      search: searchQuery || undefined,
      is_archived: true,
    });
    setArchivedEmails(archivedData);
  };

  // Flat list sorted newest to oldest (already done by DB query)
  const displayEmails = activeTab === "active" ? emails : archivedEmails;

  const handleSearch = () => {
    loadEmails();
  };

  const handleProcessAI = async () => {
    await triggerAIProcessing();
    loadEmails();
  };

  const handleViewDetails = async (email: InboundEmail) => {
    setSelectedEmail(email);
    setDetailsOpen(true);
    setEmailTasks([]);
    
    // Fetch tasks linked to this email
    setLoadingTasks(true);
    try {
      const { data: tasks, error } = await supabase
        .from("collection_tasks")
        .select("id, task_type, priority, status, summary, details, recommended_action, due_date, created_at")
        .eq("inbound_email_id", email.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setEmailTasks(tasks || []);
    } catch (err) {
      console.error("Error fetching tasks for email:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleToggleSelect = (emailId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, emailId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== emailId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(displayEmails.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleArchiveEmail = async (emailId: string) => {
    const success = await archiveEmail(emailId, "Manual archive");
    if (success) {
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setDetailsOpen(false);
      }
    }
  };

  const handleUnarchiveEmail = async (emailId: string) => {
    const success = await unarchiveEmail(emailId);
    if (success) {
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setDetailsOpen(false);
      }
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await archiveEmail(id, "Bulk archive");
      if (success) successCount++;
    }
    toast.success(`Archived ${successCount} email(s)`);
    setSelectedIds([]);
    loadEmails();
  };

  const handleBulkUnarchive = async () => {
    if (selectedIds.length === 0) return;
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await unarchiveEmail(id);
      if (success) successCount++;
    }
    toast.success(`Restored ${successCount} email(s)`);
    setSelectedIds([]);
    loadEmails();
  };

  const handleCloseAction = async (emailId: string) => {
    const success = await updateActionStatus(emailId, "closed");
    if (success) {
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, action_status: "closed" } as any);
      }
    }
  };

  const handleReopenAction = async (emailId: string) => {
    const success = await updateActionStatus(emailId, "open");
    if (success) {
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, action_status: "open" } as any);
      }
    }
  };

  // Bulk actions
  const handleBulkCloseActions = async () => {
    if (selectedIds.length === 0) return;
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await updateActionStatus(id, "closed");
      if (success) successCount++;
    }
    toast.success(`Closed ${successCount} action(s)`);
    setSelectedIds([]);
    loadEmails();
  };

  const handleBulkReopenActions = async () => {
    if (selectedIds.length === 0) return;
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await updateActionStatus(id, "open");
      if (success) successCount++;
    }
    toast.success(`Reopened ${successCount} action(s)`);
    setSelectedIds([]);
    loadEmails();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from("inbound_emails")
        .delete()
        .in("id", selectedIds);
      
      if (error) throw error;
      
      toast.success(`Deleted ${selectedIds.length} email(s)`);
      setSelectedIds([]);
      setDeleteDialogOpen(false);
      loadEmails();
    } catch (error: any) {
      toast.error("Failed to delete emails");
      console.error(error);
    }
  };

  const handleForwardSelected = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one email to forward");
      return;
    }
    setForwardDialogOpen(true);
  };

  const handleForwardSingle = (emailId: string) => {
    setSelectedIds([emailId]);
    setForwardDialogOpen(true);
  };

  const handleConfirmForward = async () => {
    if (!forwardEmail) {
      toast.error("Please enter an email address");
      return;
    }
    await forwardEmails(selectedIds, forwardEmail);
    setForwardDialogOpen(false);
    setForwardEmail("");
    setSelectedIds([]);
    loadEmails();
  };

  const handleGenerateAIResponse = async (email: InboundEmail) => {
    // Use invoice_id from email, or fallback to context from task navigation
    const invoiceId = email.invoice_id || contextInvoiceId;
    const debtorId = email.debtor_id;

    setIsGeneratingAI(true);
    try {
      // Pass email body separately to avoid command length limit issues
      const emailContent = email.text_body || email.html_body || '';
      
      const { data, error } = await supabase.functions.invoke("process-persona-command", {
        body: {
          command: `Respond to this customer email: "${email.subject || 'No subject'}"`,
          contextInvoiceId: invoiceId || undefined,
          contextDebtorId: debtorId || undefined,
          contextType: "inbound_email",
          senderEmail: email.from_email,
          emailSubject: email.subject,
          emailBody: emailContent.slice(0, 3000), // Truncate to avoid excessive payload
        },
      });

      if (error) throw error;
      if (!data?.draft) throw new Error("No response generated");

      setGeneratedResponse({
        subject: data.draft.subject || `Re: ${email.subject || 'Your inquiry'}`,
        body: data.draft.message_body,
      });
      setAiResponseDialogOpen(true);
      toast.success("AI response generated");
    } catch (err: any) {
      console.error("Error generating AI response:", err);
      toast.error(err.message || "Failed to generate AI response");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "PAYMENT":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "DISPUTE":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "DOCUMENTATION":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "INQUIRY":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "COMPLAINT":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "CONFIRMATION":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case "negative":
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      case "urgent":
        return <AlertCircle className="h-3 w-3 text-orange-500" />;
      default:
        return <Minus className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "received":
        return <Clock className="h-4 w-4" />;
      case "linked":
        return <LinkIcon className="h-4 w-4" />;
      case "processed":
        return <CheckCircle className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "received":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "linked":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "processed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getActionIcon = (type: string) => {
    const iconClass = "h-3 w-3";
    switch (type) {
      case "W9_REQUEST":
        return <FileText className={iconClass} />;
      case "PAYMENT_PLAN_REQUEST":
        return <Calendar className={iconClass} />;
      case "DISPUTE_CHARGES":
      case "DISPUTE_PO":
        return <AlertCircle className={iconClass} />;
      case "PROMISE_TO_PAY":
        return <CheckCircle className={iconClass} />;
      case "NEEDS_CALLBACK":
        return <User className={iconClass} />;
      default:
        return <Mail className={iconClass} />;
    }
  };

  const ACTION_TYPES = [
    { value: "all", label: "All Types" },
    { value: "W9_REQUEST", label: "W9 Request" },
    { value: "PAYMENT_PLAN_REQUEST", label: "Payment Plan" },
    { value: "DISPUTE_CHARGES", label: "Dispute Charges" },
    { value: "DISPUTE_PO", label: "Dispute PO" },
    { value: "NEEDS_CALLBACK", label: "Callback" },
    { value: "PROMISE_TO_PAY", label: "Promise to Pay" },
    { value: "INVOICE_COPY_REQUEST", label: "Invoice Copy" },
    { value: "PAYMENT_CONFIRMATION", label: "Payment Confirmation" },
    { value: "GENERAL_INQUIRY", label: "General Inquiry" },
    { value: "WRONG_CUSTOMER", label: "Wrong Customer" },
    { value: "OTHER", label: "Other" },
  ];

  const CATEGORIES = [
    { value: "all", label: "All Categories" },
    { value: "PAYMENT", label: "Payment" },
    { value: "DISPUTE", label: "Dispute" },
    { value: "DOCUMENTATION", label: "Documentation" },
    { value: "INQUIRY", label: "Inquiry" },
    { value: "COMPLAINT", label: "Complaint" },
    { value: "CONFIRMATION", label: "Confirmation" },
    { value: "OTHER", label: "Other" },
  ];

  const PRIORITIES = [
    { value: "all", label: "All Priorities" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  // Active filter count for mobile badge
  const activeFilterCount = [
    statusFilter !== "all",
    actionStatusFilter !== "all",
    categoryFilter !== "all",
    priorityFilter !== "all",
    actionFilter !== "all",
    debtorStatusFilter !== "all",
    hideClosed,
  ].filter(Boolean).length;

  return (
    <Layout>
      <div className="container mx-auto py-4 md:py-6 px-3 md:px-6 space-y-4 md:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
                <Inbox className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0" />
                <span className="truncate">AI Command Center</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1 hidden md:block">
                Platform-wide inbound email intelligence and action extraction
              </p>
            </div>
            <Button onClick={handleProcessAI} disabled={isLoading} size="sm" className="flex-shrink-0">
              <Sparkles className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Process AI</span>
            </Button>
          </div>
          
          {/* Stats badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs md:text-sm">
              {emails.length} Active
            </Badge>
            <Badge variant="outline" className="text-xs md:text-sm">
              {archivedEmails.length} Archived
            </Badge>
            <Badge variant="outline" className="text-xs md:text-sm">
              {emails.filter((e) => e.status === "processed").length} Processed
            </Badge>
          </div>
        </div>

        {/* Search Bar - Always visible */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} size="icon" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="relative"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filters - Collapsible on mobile */}
        {filtersExpanded && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Filter className="h-4 w-4 md:h-5 md:w-5" />
                Filters
              </CardTitle>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setFiltersExpanded(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 md:h-10 text-sm">
                    <SelectValue placeholder="Email Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="linked">Linked</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={actionStatusFilter} onValueChange={setActionStatusFilter}>
                  <SelectTrigger className="h-9 md:h-10 text-sm">
                    <SelectValue placeholder="Action Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 md:h-10 text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9 md:h-10 text-sm">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-9 md:h-10 text-sm">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={debtorStatusFilter} onValueChange={(v) => setDebtorStatusFilter(v as "all" | "active" | "archived")}>
                  <SelectTrigger className="h-9 md:h-10 text-sm">
                    <SelectValue placeholder="Account Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="active">Active Accounts</SelectItem>
                    <SelectItem value="archived">Archived Accounts</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2 col-span-2 md:col-span-1">
                  <Switch
                    id="hide-closed"
                    checked={hideClosed}
                    onCheckedChange={setHideClosed}
                  />
                  <Label htmlFor="hide-closed" className="flex items-center gap-1 text-sm cursor-pointer">
                    <CheckSquare className="h-4 w-4" />
                    Hide Closed
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Actions Bar - Mobile optimized */}
        {selectedIds.length > 0 && (
          <Card className="border-primary sticky top-0 z-10">
            <CardContent className="py-2 md:py-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="text-xs md:text-sm">{selectedIds.length} selected</Badge>
                <div className="flex items-center gap-1 md:gap-2">
                  {/* Desktop buttons */}
                  <div className="hidden md:flex items-center gap-2">
                    {activeTab === "active" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={handleBulkCloseActions}>
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Close All
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleBulkReopenActions}>
                          <Clock className="h-4 w-4 mr-2" />
                          Reopen All
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleForwardSelected}>
                          <Forward className="h-4 w-4 mr-2" />
                          Forward
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleBulkArchive}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={handleBulkUnarchive}>
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        Restore All
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                  {/* Mobile dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild className="md:hidden">
                      <Button size="sm" variant="outline">
                        Actions
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {activeTab === "active" ? (
                        <>
                          <DropdownMenuItem onClick={handleBulkCloseActions}>
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Close All
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleBulkReopenActions}>
                            <Clock className="h-4 w-4 mr-2" />
                            Reopen All
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleForwardSelected}>
                            <Forward className="h-4 w-4 mr-2" />
                            Forward
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleBulkArchive}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem onClick={handleBulkUnarchive}>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore All
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Tabs - Active vs Archived */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "active" | "archived"); setSelectedIds([]); }}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="gap-2">
              <Inbox className="h-4 w-4" />
              Active
              <Badge variant="secondary" className="ml-1">{emails.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-4 w-4" />
              Archived
              <Badge variant="secondary" className="ml-1">{archivedEmails.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
            {/* Select All Header */}
            {emails.length > 0 && (
              <div className="flex items-center gap-2 px-1 mb-4">
                <Checkbox
                  id="select-all"
                  checked={selectedIds.length === emails.length && emails.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select All ({emails.length})
                </Label>
              </div>
            )}

            {/* Email List - Flat Rows */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {emails.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No active inbound emails found
                    </CardContent>
                  </Card>
                ) : (
                  emails.map((email) => (
                    <Card key={email.id} className={selectedIds.includes(email.id) ? "ring-2 ring-primary" : ""}>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-start gap-2 md:gap-4">
                          <Checkbox
                            checked={selectedIds.includes(email.id)}
                            onCheckedChange={(checked) => handleToggleSelect(email.id, !!checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2 cursor-pointer" onClick={() => handleViewDetails(email)}>
                            {/* Row 1: Invoice/Account context + Date */}
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2 min-w-0">
                                {email.invoices ? (
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                    <span className="font-medium truncate">{(email.invoices as any).invoice_number}</span>
                                    {(email.invoices as any).status && (
                                      <Badge variant={(email.invoices as any).status === "Paid" ? "default" : "outline"} className="text-xs">
                                        {(email.invoices as any).status}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Unlinked</span>
                                )}
                                {email.debtors && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="truncate">{(email.debtors as any).company_name || (email.debtors as any).name}</span>
                                  </>
                                )}
                              </div>
                              <span className="flex-shrink-0">
                                {format(new Date(email.created_at), isMobile ? "MMM d" : "MMM d, h:mm a")}
                              </span>
                            </div>

                            {/* Row 2: Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge className={`${getStatusColor(email.status)} text-xs`} variant="outline">
                                {getStatusIcon(email.status)}
                                <span className="ml-1 hidden md:inline">{email.status}</span>
                              </Badge>
                              {email.ai_category && (
                                <Badge className={`${getCategoryColor(email.ai_category)} text-xs`} variant="outline">
                                  <Tag className="h-3 w-3" />
                                  <span className="ml-1 hidden md:inline">{email.ai_category}</span>
                                </Badge>
                              )}
                              {email.ai_priority && (
                                <Badge className={`${getPriorityColor(email.ai_priority)} text-xs`} variant="outline">
                                  {email.ai_priority}
                                </Badge>
                              )}
                              {email.action_status && (
                                <Badge variant={email.action_status === "closed" ? "secondary" : "default"} className="text-xs">
                                  {email.action_status === "closed" ? <CheckSquare className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                </Badge>
                              )}
                            </div>

                            {/* Row 3: From + Subject */}
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{email.from_email}</span>
                            </div>
                            <p className="font-semibold text-sm line-clamp-1">{email.subject}</p>
                            
                            {/* Row 4: AI Summary */}
                            {email.ai_summary && (
                              <div className="flex items-start gap-2 text-xs md:text-sm">
                                <Bot className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                                <p className="text-muted-foreground italic line-clamp-1">{email.ai_summary}</p>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex-shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(email)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleForwardSingle(email.id)}>
                                  <Forward className="h-4 w-4 mr-2" />
                                  Forward
                                </DropdownMenuItem>
                                {email.action_status !== "closed" ? (
                                  <DropdownMenuItem onClick={() => handleCloseAction(email.id)}>
                                    <CheckSquare className="h-4 w-4 mr-2" />
                                    Close Action
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleReopenAction(email.id)}>
                                    <Clock className="h-4 w-4 mr-2" />
                                    Reopen Action
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleArchiveEmail(email.id)}>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-0">
            {/* Select All Header */}
            {archivedEmails.length > 0 && (
              <div className="flex items-center gap-2 px-1 mb-4">
                <Checkbox
                  id="select-all-archived"
                  checked={selectedIds.length === archivedEmails.length && archivedEmails.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all-archived" className="text-sm cursor-pointer">
                  Select All ({archivedEmails.length})
                </Label>
              </div>
            )}

            {/* Archived Email List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {archivedEmails.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>No archived emails</p>
                      <p className="text-sm mt-1">Emails are automatically archived when their invoice is paid or canceled</p>
                    </CardContent>
                  </Card>
                ) : (
                  archivedEmails.map((email) => (
                    <Card key={email.id} className={`opacity-75 ${selectedIds.includes(email.id) ? "ring-2 ring-primary" : ""}`}>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-start gap-2 md:gap-4">
                          <Checkbox
                            checked={selectedIds.includes(email.id)}
                            onCheckedChange={(checked) => handleToggleSelect(email.id, !!checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-2 cursor-pointer" onClick={() => handleViewDetails(email)}>
                            {/* Archived reason badge */}
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="gap-1">
                                  <Archive className="h-3 w-3" />
                                  {email.archived_reason || "Archived"}
                                </Badge>
                                {email.archived_at && (
                                  <span className="text-muted-foreground">
                                    {format(new Date(email.archived_at), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Invoice/Account context */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {email.invoices ? (
                                <div className="flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                  <span className="font-medium truncate">{(email.invoices as any).invoice_number}</span>
                                </div>
                              ) : (
                                <span>Unlinked</span>
                              )}
                              {email.debtors && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{(email.debtors as any).company_name || (email.debtors as any).name}</span>
                                </>
                              )}
                            </div>

                            {/* From + Subject */}
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{email.from_email}</span>
                              <span className="text-muted-foreground text-xs flex-shrink-0">
                                {format(new Date(email.created_at), "MMM d")}
                              </span>
                            </div>
                            <p className="font-semibold text-sm line-clamp-1">{email.subject}</p>
                            
                            {/* AI Summary */}
                            {email.ai_summary && (
                              <p className="text-xs text-muted-foreground italic line-clamp-1">{email.ai_summary}</p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex-shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(email)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUnarchiveEmail(email.id)}>
                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Email Detail Content - Shared between Sheet and Drawer */}
        {selectedEmail && (
          isMobile ? (
            <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
              <DrawerContent className="h-[85vh] flex flex-col">
                <DrawerHeader className="text-left pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <DrawerTitle className="text-lg">Email Details</DrawerTitle>
                      <DrawerDescription className="text-sm">AI insights and actions</DrawerDescription>
                    </div>
                    <DrawerClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </DrawerClose>
                  </div>
                  {/* Subject line - prominent on mobile */}
                  <div className="mt-2 pt-2 border-t">
                    <p className="font-medium text-sm line-clamp-2">{selectedEmail.subject || "No subject"}</p>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-6">
                  <EmailDetailContent
                    email={selectedEmail}
                    tasks={emailTasks}
                    loadingTasks={loadingTasks}
                    onForward={() => handleForwardSingle(selectedEmail.id)}
                    onClose={() => handleCloseAction(selectedEmail.id)}
                    onReopen={() => handleReopenAction(selectedEmail.id)}
                    onGenerateAIResponse={() => handleGenerateAIResponse(selectedEmail)}
                    onTaskClick={handleTaskClick}
                    isGeneratingAI={isGeneratingAI}
                    getPriorityColor={getPriorityColor}
                    getCategoryColor={getCategoryColor}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    getSentimentIcon={getSentimentIcon}
                    getActionIcon={getActionIcon}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetContent className="w-full sm:max-w-2xl">
                <SheetHeader>
                  <SheetTitle>Email Details</SheetTitle>
                  <SheetDescription>Full inbound email with AI insights</SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
                  <EmailDetailContent
                    email={selectedEmail}
                    tasks={emailTasks}
                    loadingTasks={loadingTasks}
                    onForward={() => handleForwardSingle(selectedEmail.id)}
                    onClose={() => handleCloseAction(selectedEmail.id)}
                    onReopen={() => handleReopenAction(selectedEmail.id)}
                    onGenerateAIResponse={() => handleGenerateAIResponse(selectedEmail)}
                    onTaskClick={handleTaskClick}
                    isGeneratingAI={isGeneratingAI}
                    getPriorityColor={getPriorityColor}
                    getCategoryColor={getCategoryColor}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    getSentimentIcon={getSentimentIcon}
                    getActionIcon={getActionIcon}
                  />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )
        )}
      </div>

      {/* Forward Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Email(s)</DialogTitle>
            <DialogDescription>
              Forward {selectedIds.length} email(s) to an email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forward-email">Email Address</Label>
              <Input
                id="forward-email"
                type="email"
                placeholder="colleague@company.com"
                value={forwardEmail}
                onChange={(e) => setForwardEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmForward} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Forward className="h-4 w-4 mr-2" />}
              Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} email(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Response Dialog - Mobile uses Drawer, Desktop uses Dialog */}
      {isMobile ? (
        <Drawer open={aiResponseDialogOpen} onOpenChange={(open) => {
          if (!open && generatedResponse && selectedEmail) {
            createPendingResponseTask(selectedEmail);
          }
          setAiResponseDialogOpen(open);
          if (!open) setGeneratedResponse(null);
        }}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Generated Response
              </DrawerTitle>
              <DrawerDescription>
                Review and edit the response, then send or save as draft
              </DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="px-4 pb-4 max-h-[60vh]">
              {generatedResponse && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="response-subject-mobile">Subject</Label>
                    <Input
                      id="response-subject-mobile"
                      value={generatedResponse.subject || ""}
                      onChange={(e) => setGeneratedResponse({ ...generatedResponse, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="response-body-mobile">Message</Label>
                    <Textarea
                      id="response-body-mobile"
                      value={generatedResponse.body}
                      onChange={(e) => setGeneratedResponse({ ...generatedResponse, body: e.target.value })}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </ScrollArea>
            <div className="p-4 border-t space-y-2">
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={async () => {
                    if (!selectedEmail || !generatedResponse) return;
                    setIsSendingResponse(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Not authenticated");
                      
                      // Fetch branding settings
                      const { data: brandingData } = await supabase
                        .from("branding_settings")
                        .select("*")
                        .eq("user_id", user.id)
                        .single();
                      
                      const branding: BrandingSettings = brandingData || {};
                      
                      // Get recipient name from debtor or email
                      const recipientName = selectedEmail.debtors?.name || 
                        selectedEmail.from_name || 
                        selectedEmail.from_email.split("@")[0];
                      
                      // Format body with proper greeting
                      const formattedBody = `
                        <p>Hi ${recipientName},</p>
                        ${generatedResponse.body.split("\n").map(line => 
                          line.trim() ? `<p>${line}</p>` : ""
                        ).join("")}
                      `;
                      
                      const brandedHtml = generateBrandedEmail(formattedBody, branding);
                      
                      const { error: sendError } = await supabase.functions.invoke("send-email", {
                        body: {
                          to: selectedEmail.from_email,
                          from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
                          subject: generatedResponse.subject,
                          html: brandedHtml,
                        },
                      });
                      
                      if (sendError) throw sendError;
                      
                      await supabase.from("inbound_emails").update({
                        action_status: "closed",
                        action_closed_at: new Date().toISOString(),
                        action_closed_by: user.id,
                        action_notes: "Responded via AI-generated email",
                      }).eq("id", selectedEmail.id);
                      
                      toast.success("Response sent successfully");
                      setAiResponseDialogOpen(false);
                      setGeneratedResponse(null);
                      loadEmails();
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send response");
                    } finally {
                      setIsSendingResponse(false);
                    }
                  }}
                  disabled={isSendingResponse}
                >
                  {isSendingResponse ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Response
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    if (!selectedEmail || !generatedResponse) return;
                    await createPendingResponseTask(selectedEmail);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Not authenticated");
                      
                      const { error } = await supabase.from("ai_drafts").insert({
                        user_id: user.id,
                        invoice_id: selectedEmail.invoice_id || contextInvoiceId,
                        channel: "email",
                        subject: generatedResponse.subject,
                        message_body: generatedResponse.body,
                        status: "pending_approval",
                        step_number: 0,
                      });
                      
                      if (error) throw error;
                      toast.success("Draft saved");
                      setAiResponseDialogOpen(false);
                      setGeneratedResponse(null);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to save draft");
                    }
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button 
                  variant="ghost" 
                  className="flex-1"
                  onClick={() => {
                    setGeneratedResponse(null);
                    setAiResponseDialogOpen(false);
                    toast.info("Response discarded");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={aiResponseDialogOpen} onOpenChange={(open) => {
          if (!open && generatedResponse && selectedEmail) {
            createPendingResponseTask(selectedEmail);
          }
          setAiResponseDialogOpen(open);
          if (!open) setGeneratedResponse(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Generated Response
              </DialogTitle>
              <DialogDescription>
                Review and edit the response, then send or save as draft
              </DialogDescription>
            </DialogHeader>
            {generatedResponse && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="response-subject">Subject</Label>
                  <Input
                    id="response-subject"
                    value={generatedResponse.subject || ""}
                    onChange={(e) => setGeneratedResponse({ ...generatedResponse, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="response-body">Message</Label>
                  <Textarea
                    id="response-body"
                    value={generatedResponse.body}
                    onChange={(e) => setGeneratedResponse({ ...generatedResponse, body: e.target.value })}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setGeneratedResponse(null);
                    setAiResponseDialogOpen(false);
                    toast.info("Response discarded");
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selectedEmail || !generatedResponse) return;
                    await createPendingResponseTask(selectedEmail);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Not authenticated");
                      
                      const { error } = await supabase.from("ai_drafts").insert({
                        user_id: user.id,
                        invoice_id: selectedEmail.invoice_id || contextInvoiceId,
                        channel: "email",
                        subject: generatedResponse.subject,
                        message_body: generatedResponse.body,
                        status: "pending_approval",
                        step_number: 0,
                      });
                      
                      if (error) throw error;
                      toast.success("Draft saved - response pending task created");
                      setAiResponseDialogOpen(false);
                      setGeneratedResponse(null);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to save draft");
                    }
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedEmail || !generatedResponse) return;
                    setIsSendingResponse(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Not authenticated");
                      
                      // Fetch branding settings
                      const { data: brandingData } = await supabase
                        .from("branding_settings")
                        .select("*")
                        .eq("user_id", user.id)
                        .single();
                      
                      const branding: BrandingSettings = brandingData || {};
                      
                      // Get recipient name from debtor or email
                      const recipientName = selectedEmail.debtors?.name || 
                        selectedEmail.from_name || 
                        selectedEmail.from_email.split("@")[0];
                      
                      // Format body with proper greeting
                      const formattedBody = `
                        <p>Hi ${recipientName},</p>
                        ${generatedResponse.body.split("\n").map(line => 
                          line.trim() ? `<p>${line}</p>` : ""
                        ).join("")}
                      `;
                      
                      const brandedHtml = generateBrandedEmail(formattedBody, branding);
                      
                      const { error: sendError } = await supabase.functions.invoke("send-email", {
                        body: {
                          to: selectedEmail.from_email,
                          from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
                          subject: generatedResponse.subject,
                          html: brandedHtml,
                        },
                      });
                      
                      if (sendError) throw sendError;
                      
                      await supabase.from("inbound_emails").update({
                        action_status: "closed",
                        action_closed_at: new Date().toISOString(),
                        action_closed_by: user.id,
                        action_notes: "Responded via AI-generated email",
                      }).eq("id", selectedEmail.id);
                      
                      toast.success("Response sent successfully");
                      setAiResponseDialogOpen(false);
                      setGeneratedResponse(null);
                      loadEmails();
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send response");
                    } finally {
                      setIsSendingResponse(false);
                    }
                  }}
                  disabled={isSendingResponse}
                >
                  {isSendingResponse ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Response
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTaskForDetail}
        open={taskDetailOpen}
        onOpenChange={setTaskDetailOpen}
        onStatusChange={async (taskId, status) => {
          await supabase
            .from("collection_tasks")
            .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
            .eq("id", taskId);
          // Refresh tasks for the selected email
          if (selectedEmail) {
            const { data } = await supabase
              .from("collection_tasks")
              .select("*")
              .eq("inbound_email_id", selectedEmail.id)
              .order("created_at", { ascending: false });
            setEmailTasks(data || []);
          }
          toast.success("Task updated");
        }}
        onArchive={async (taskId) => {
          await supabase
            .from("collection_tasks")
            .update({ is_archived: true, archived_at: new Date().toISOString() })
            .eq("id", taskId);
          if (selectedEmail) {
            const { data } = await supabase
              .from("collection_tasks")
              .select("*")
              .eq("inbound_email_id", selectedEmail.id)
              .eq("is_archived", false)
              .order("created_at", { ascending: false });
            setEmailTasks(data || []);
          }
          toast.success("Task archived");
        }}
        onAssign={async (taskId, assignedTo, assignedPersona) => {
          await supabase
            .from("collection_tasks")
            .update({ assigned_to: assignedTo, assigned_persona: assignedPersona })
            .eq("id", taskId);
          if (selectedEmail) {
            const { data } = await supabase
              .from("collection_tasks")
              .select("*")
              .eq("inbound_email_id", selectedEmail.id)
              .order("created_at", { ascending: false });
            setEmailTasks(data || []);
          }
        }}
        onNoteAdded={async () => {
          if (selectedEmail) {
            const { data } = await supabase
              .from("collection_tasks")
              .select("*")
              .eq("inbound_email_id", selectedEmail.id)
              .order("created_at", { ascending: false });
            setEmailTasks(data || []);
          }
        }}
      />
    </Layout>
  );
}

export default InboundCommandCenter;
