import { useState, useEffect } from "react";
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
  EyeOff,
  Forward,
  CheckSquare,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
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
import { toast } from "sonner";

export default function InboundCommandCenter() {
  const { fetchInboundEmails, triggerAIProcessing, updateActionStatus, forwardEmails, isLoading } = useInboundEmails();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actionStatusFilter, setActionStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [debtorStatusFilter, setDebtorStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [hideProcessed, setHideProcessed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadEmails();
  }, [statusFilter, actionFilter, actionStatusFilter, categoryFilter, priorityFilter, debtorStatusFilter, hideProcessed]);

  const loadEmails = async () => {
    const data = await fetchInboundEmails({
      status: statusFilter !== "all" ? statusFilter : undefined,
      action_type: actionFilter !== "all" ? actionFilter : undefined,
      action_status: actionStatusFilter !== "all" ? actionStatusFilter : undefined,
      ai_category: categoryFilter !== "all" ? categoryFilter : undefined,
      ai_priority: priorityFilter !== "all" ? priorityFilter : undefined,
      debtor_status: debtorStatusFilter,
      hide_processed: hideProcessed,
      search: searchQuery || undefined,
    });
    setEmails(data);
  };

  const handleSearch = () => {
    loadEmails();
  };

  const handleProcessAI = async () => {
    await triggerAIProcessing();
    loadEmails();
  };

  const handleViewDetails = (email: InboundEmail) => {
    setSelectedEmail(email);
    setDetailsOpen(true);
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
    { value: "all", label: "All Actions" },
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedIds.length} selected</Badge>
                  <Button size="sm" variant="outline" onClick={handleForwardSelected}>
                    <Forward className="h-4 w-4 mr-2" />
                    Forward Selected
                  </Button>
                </div>
              )}
            </div>
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
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
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
                  <SelectItem value="all">All Actions</SelectItem>
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
                  <SelectValue placeholder="Debtor Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Debtors</SelectItem>
                  <SelectItem value="active">Active Debtors</SelectItem>
                  <SelectItem value="archived">Archived Debtors</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Switch
                  id="hide-processed"
                  checked={hideProcessed}
                  onCheckedChange={setHideProcessed}
                />
                <Label htmlFor="hide-processed" className="flex items-center gap-1 text-sm cursor-pointer">
                  <EyeOff className="h-4 w-4" />
                  Hide Processed
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Selection Header */}
        {emails.length > 0 && (
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              id="select-all"
              checked={selectedIds.length === emails.length && emails.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm cursor-pointer">
              Select All
            </Label>
          </div>
        )}

        {/* Email List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {emails.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No inbound emails found
                </CardContent>
              </Card>
            ) : (
              emails.map((email) => (
                <Card
                  key={email.id}
                  className={`hover:shadow-md transition-shadow ${selectedIds.includes(email.id) ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardContent className="py-4">
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
                        {email.debtors && (
                          <div className="text-right">
                            <p className="font-medium">{(email.debtors as any).name}</p>
                            <p className="text-muted-foreground text-xs">
                              {(email.debtors as any).company_name}
                            </p>
                          </div>
                        )}
                        {email.invoices && (
                          <Badge variant="outline">
                            Invoice: {(email.invoices as any).invoice_number}
                          </Badge>
                        )}
                        <div className="flex gap-1 mt-2">
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
                  </CardContent>
                </Card>
              ))
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
    </Layout>
  );
}
