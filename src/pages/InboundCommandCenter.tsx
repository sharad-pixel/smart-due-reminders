import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInboundEmails, InboundEmail } from "@/hooks/useInboundEmails";
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

export default function InboundCommandCenter() {
  const { fetchInboundEmails, triggerAIProcessing, isLoading } = useInboundEmails();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadEmails();
  }, [statusFilter, actionFilter]);

  const loadEmails = async () => {
    const data = await fetchInboundEmails({
      status: statusFilter !== "all" ? statusFilter : undefined,
      action_type: actionFilter !== "all" ? actionFilter : undefined,
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
    { value: "WRONG_CUSTOMER", label: "Wrong Customer" },
    { value: "OTHER", label: "Other" },
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
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
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
            </div>
          </CardContent>
        </Card>

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
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleViewDetails(email)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(email.status)} variant="outline">
                            {getStatusIcon(email.status)}
                            <span className="ml-1">{email.status}</span>
                          </Badge>
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
                  {/* Status */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Status</h3>
                    <Badge className={getStatusColor(selectedEmail.status)}>
                      {getStatusIcon(selectedEmail.status)}
                      <span className="ml-2">{selectedEmail.status}</span>
                    </Badge>
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
                          <Card>
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{(selectedEmail.debtors as any).name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {(selectedEmail.debtors as any).company_name}
                                  </p>
                                </div>
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={`/debtors/${selectedEmail.debtor_id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {selectedEmail.invoices && (
                          <Card>
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
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={`/invoices/${selectedEmail.invoice_id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
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
    </Layout>
  );
}
