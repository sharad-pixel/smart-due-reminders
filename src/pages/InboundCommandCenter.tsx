import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInboundEmails, InboundEmail } from "@/hooks/useInboundEmails";
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
  ChevronRight,
  Trash2,
  ListTodo,
} from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceGroup {
  invoiceNumber: string | null;
  invoiceId: string | null;
  debtorName: string | null;
  companyName: string | null;
  emails: InboundEmail[];
}

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

export default function InboundCommandCenter() {
  const { fetchInboundEmails, triggerAIProcessing, updateActionStatus, forwardEmails, isLoading } = useInboundEmails();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emailTasks, setEmailTasks] = useState<EmailTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

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

  const loadEmails = async () => {
    const data = await fetchInboundEmails({
      status: statusFilter !== "all" ? statusFilter : undefined,
      action_type: actionFilter !== "all" ? actionFilter : undefined,
      action_status: actionStatusFilter !== "all" ? actionStatusFilter : undefined,
      ai_category: categoryFilter !== "all" ? categoryFilter : undefined,
      ai_priority: priorityFilter !== "all" ? priorityFilter : undefined,
      debtor_status: debtorStatusFilter,
      hide_closed: hideClosed,
      search: searchQuery || undefined,
    });
    setEmails(data);
    // Expand all groups by default
    const groupKeys = new Set(data.map(e => e.invoice_id || "unlinked"));
    setExpandedGroups(groupKeys);
  };

  // Group emails by invoice
  const groupedEmails = useMemo((): InvoiceGroup[] => {
    const groups = new Map<string, InvoiceGroup>();
    
    emails.forEach(email => {
      const key = email.invoice_id || "unlinked";
      if (!groups.has(key)) {
        groups.set(key, {
          invoiceNumber: email.invoices ? (email.invoices as any).invoice_number : null,
          invoiceId: email.invoice_id,
          debtorName: email.debtors ? (email.debtors as any).name : null,
          companyName: email.debtors ? (email.debtors as any).company_name : null,
          emails: [],
        });
      }
      groups.get(key)!.emails.push(email);
    });

    // Sort groups: linked invoices first, then unlinked
    return Array.from(groups.values()).sort((a, b) => {
      if (a.invoiceId && !b.invoiceId) return -1;
      if (!a.invoiceId && b.invoiceId) return 1;
      return (b.emails.length - a.emails.length);
    });
  }, [emails]);

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
      setSelectedIds(emails.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectGroup = (group: InvoiceGroup, checked: boolean) => {
    const groupIds = group.emails.map(e => e.id);
    if (checked) {
      setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
    } else {
      setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Inbox className="h-8 w-8" />
              AI Collections Command Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Platform-wide inbound email intelligence and action extraction
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm">
              {emails.length} Total
            </Badge>
            <Badge variant="outline" className="text-sm">
              {emails.filter((e) => e.status === "processed").length} Processed
            </Badge>
            <Button onClick={handleProcessAI} disabled={isLoading} size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Process AI
            </Button>
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} size="sm">
                  Search
                </Button>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Action Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Action Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
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
                <SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Account Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="active">Active Accounts</SelectItem>
                  <SelectItem value="archived">Archived Accounts</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
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

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <Card className="border-primary">
            <CardContent className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedIds.length} selected</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                  <Button size="sm" variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Select All Header */}
        {emails.length > 0 && (
          <div className="flex items-center gap-2 px-2">
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

        {/* Email List - Grouped by Invoice */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {groupedEmails.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No inbound emails found
                </CardContent>
              </Card>
            ) : (
              groupedEmails.map((group) => {
                const groupKey = group.invoiceId || "unlinked";
                const isExpanded = expandedGroups.has(groupKey);
                const groupEmailIds = group.emails.map(e => e.id);
                const allSelected = groupEmailIds.every(id => selectedIds.includes(id));
                const someSelected = groupEmailIds.some(id => selectedIds.includes(id));

                return (
                  <Card key={groupKey}>
                    <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(groupKey)}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={allSelected}
                                ref={(ref) => {
                                  if (ref && someSelected && !allSelected) {
                                    (ref as any).indeterminate = true;
                                  }
                                }}
                                onCheckedChange={(checked) => handleSelectGroup(group, !!checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                {group.invoiceNumber ? (
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="font-medium">Invoice: {group.invoiceNumber}</span>
                                    {group.debtorName && (
                                      <span className="text-muted-foreground">
                                        • {group.debtorName}
                                        {group.companyName && ` (${group.companyName})`}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-muted-foreground">Unlinked Emails</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline">{group.emails.length} email(s)</Badge>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          {group.emails.map((email) => (
                            <div
                              key={email.id}
                              className={`border rounded-lg p-4 hover:shadow-sm transition-shadow ${
                                selectedIds.includes(email.id) ? "ring-2 ring-primary" : ""
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <Checkbox
                                  checked={selectedIds.includes(email.id)}
                                  onCheckedChange={(checked) => handleToggleSelect(email.id, !!checked)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 space-y-2 cursor-pointer" onClick={() => handleViewDetails(email)}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={getStatusColor(email.status)} variant="outline">
                                      {getStatusIcon(email.status)}
                                      <span className="ml-1">{email.status}</span>
                                    </Badge>
                                    {(email as any).ai_category && (
                                      <Badge className={getCategoryColor((email as any).ai_category)} variant="outline">
                                        <Tag className="h-3 w-3 mr-1" />
                                        {(email as any).ai_category}
                                      </Badge>
                                    )}
                                    {(email as any).ai_priority && (
                                      <Badge className={getPriorityColor((email as any).ai_priority)} variant="outline">
                                        {(email as any).ai_priority}
                                      </Badge>
                                    )}
                                    {(email as any).ai_sentiment && getSentimentIcon((email as any).ai_sentiment)}
                                    {(email as any).action_status && (
                                      <Badge variant={(email as any).action_status === "closed" ? "secondary" : "default"}>
                                        {(email as any).action_status === "closed" ? (
                                          <CheckSquare className="h-3 w-3 mr-1" />
                                        ) : (
                                          <Clock className="h-3 w-3 mr-1" />
                                        )}
                                        {(email as any).action_status}
                                      </Badge>
                                    )}
                                    <span className="text-sm text-muted-foreground">
                                      {format(new Date(email.created_at), "MMM d, yyyy h:mm a")}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{email.from_email}</span>
                                  </div>

                                  <div>
                                    <p className="font-semibold">{email.subject}</p>
                                    {email.ai_summary && (
                                      <div className="mt-2 flex items-start gap-2 text-sm">
                                        <Bot className="h-4 w-4 text-purple-500 mt-0.5" />
                                        <p className="text-muted-foreground italic">{email.ai_summary}</p>
                                      </div>
                                    )}
                                  </div>

                                  {email.ai_actions && email.ai_actions.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {email.ai_actions.map((action, idx) => (
                                        <Badge key={idx} variant="secondary" className="gap-1">
                                          {getActionIcon(action.type)}
                                          {action.type}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-2 text-sm">
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleForwardSingle(email.id);
                                      }}
                                    >
                                      <Forward className="h-4 w-4" />
                                    </Button>
                                    {(email as any).action_status !== "closed" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCloseAction(email.id);
                                        }}
                                      >
                                        <CheckSquare className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReopenAction(email.id);
                                        }}
                                      >
                                        <Clock className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Detail Sheet */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-full sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>Email Details</SheetTitle>
              <SheetDescription>Full inbound email with AI insights</SheetDescription>
            </SheetHeader>

            {selectedEmail && (
              <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
                <div className="space-y-6">
                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleForwardSingle(selectedEmail.id)}
                    >
                      <Forward className="h-4 w-4 mr-2" />
                      Forward
                    </Button>
                    {(selectedEmail as any).action_status !== "closed" ? (
                      <Button
                        size="sm"
                        onClick={() => handleCloseAction(selectedEmail.id)}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Close Action
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReopenAction(selectedEmail.id)}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Reopen Action
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Status & Classification */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Status & Classification</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusColor(selectedEmail.status)}>
                        {getStatusIcon(selectedEmail.status)}
                        <span className="ml-2">{selectedEmail.status}</span>
                      </Badge>
                      {(selectedEmail as any).ai_category && (
                        <Badge className={getCategoryColor((selectedEmail as any).ai_category)}>
                          <Tag className="h-3 w-3 mr-1" />
                          {(selectedEmail as any).ai_category}
                        </Badge>
                      )}
                      {(selectedEmail as any).ai_priority && (
                        <Badge className={getPriorityColor((selectedEmail as any).ai_priority)}>
                          {(selectedEmail as any).ai_priority} priority
                        </Badge>
                      )}
                      {(selectedEmail as any).ai_sentiment && (
                        <Badge variant="outline" className="gap-1">
                          {getSentimentIcon((selectedEmail as any).ai_sentiment)}
                          {(selectedEmail as any).ai_sentiment}
                        </Badge>
                      )}
                      {(selectedEmail as any).action_status && (
                        <Badge variant={(selectedEmail as any).action_status === "closed" ? "secondary" : "default"}>
                          Action: {(selectedEmail as any).action_status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Email Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Email Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-medium">{selectedEmail.from_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">To:</span>
                        <span className="font-medium">{selectedEmail.to_emails[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Received:</span>
                        <span>{format(new Date(selectedEmail.created_at), "PPpp")}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* AI Summary */}
                  {selectedEmail.ai_summary && (
                    <>
                      <div>
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Bot className="h-4 w-4 text-purple-500" />
                          AI Summary
                        </h3>
                        <p className="text-sm text-muted-foreground italic bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md">
                          {selectedEmail.ai_summary}
                        </p>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Actions */}
                  {selectedEmail.ai_actions && selectedEmail.ai_actions.length > 0 && (
                    <>
                      <div>
                        <h3 className="text-sm font-medium mb-2">Extracted Actions</h3>
                        <div className="space-y-2">
                          {selectedEmail.ai_actions.map((action, idx) => (
                            <Card key={idx}>
                              <CardContent className="py-3">
                                <div className="flex items-start gap-2">
                                  {getActionIcon(action.type)}
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{action.type}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{action.details}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Confidence: {(action.confidence * 100).toFixed(0)}%
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
                  {(emailTasks.length > 0 || loadingTasks) && (
                    <>
                      <div>
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <ListTodo className="h-4 w-4 text-blue-500" />
                          Created Tasks ({emailTasks.length})
                        </h3>
                        {loadingTasks ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading tasks...
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {emailTasks.map((task) => (
                              <Link key={task.id} to="/collections/tasks">
                                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                                  <CardContent className="py-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant={task.status === "open" ? "default" : task.status === "done" ? "secondary" : "outline"}>
                                            {task.status}
                                          </Badge>
                                          <Badge className={getPriorityColor(task.priority)} variant="outline">
                                            {task.priority}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {task.task_type}
                                          </span>
                                        </div>
                                        <p className="font-medium text-sm">{task.summary}</p>
                                        {task.recommended_action && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Action: {task.recommended_action}
                                          </p>
                                        )}
                                        {task.due_date && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                                          </p>
                                        )}
                                      </div>
                                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    </div>
                                  </CardContent>
                                </Card>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Linked Records */}
                  {(selectedEmail.debtors || selectedEmail.invoices) && (
                    <>
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">Linked Records</h3>
                        {selectedEmail.debtors && (
                          <Link to={`/debtors/${selectedEmail.debtor_id}`}>
                            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                              <CardContent className="py-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{(selectedEmail.debtors as any).name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {(selectedEmail.debtors as any).company_name}
                                    </p>
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        )}
                        {selectedEmail.invoices && (
                          <Link to={`/invoices/${selectedEmail.invoice_id}`}>
                            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                              <CardContent className="py-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">
                                      Invoice: {(selectedEmail.invoices as any).invoice_number}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      ${(selectedEmail.invoices as any).amount}
                                    </p>
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
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
                    <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                      {selectedEmail.text_body || selectedEmail.html_body || "No content"}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>
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
    </Layout>
  );
}
