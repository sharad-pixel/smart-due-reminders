import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail,
  Search,
  Filter,
  Calendar,
  Building2,
  FileText,
  Clock,
  CheckCircle,
  Archive,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  History,
  MessageSquare,
  Send,
  Inbox,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OutreachRecord {
  id: string;
  debtor_id: string;
  company_name: string;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  activity_type: string;
  direction: string;
  channel: string;
  subject: string | null;
  message_body: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
  response_message: string | null;
  created_at: string;
  is_archived: boolean;
  persona_key: string | null;
  metadata: any;
}

const PAGE_SIZE = 20;

// Statuses that indicate settled/closed invoices
const SETTLED_STATUSES = ['Paid', 'Credited', 'Voided', 'WrittenOff', 'Canceled'];

export default function OutreachHistory() {
  const navigate = useNavigate();
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all, active, archived
  const [includeArchived, setIncludeArchived] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Preview state
  const [previewRecord, setPreviewRecord] = useState<OutreachRecord | null>(null);

  // Fetch all outreach history from collection_activities
  const { data: outreachData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["outreach-history", effectiveAccountId],
    enabled: !accountLoading && !!effectiveAccountId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!effectiveAccountId) return [];

      // Fetch collection activities with debtor and invoice info
      const { data: activities, error } = await supabase
        .from('collection_activities')
        .select(`
          id,
          debtor_id,
          invoice_id,
          activity_type,
          direction,
          channel,
          subject,
          message_body,
          sent_at,
          delivered_at,
          opened_at,
          responded_at,
          response_message,
          created_at,
          metadata,
          debtors!inner(id, company_name),
          invoices(id, invoice_number, status)
        `)
        .eq('user_id', effectiveAccountId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      return (activities || []).map((activity: any) => {
        const invoiceStatus = activity.invoices?.status || null;
        const isArchived = invoiceStatus ? SETTLED_STATUSES.includes(invoiceStatus) : false;
        
        // Try to determine persona from metadata or activity type
        let personaKey = null;
        if (activity.metadata?.persona_key) {
          personaKey = activity.metadata.persona_key;
        } else if (activity.metadata?.agent_persona) {
          personaKey = activity.metadata.agent_persona;
        }

        return {
          id: activity.id,
          debtor_id: activity.debtor_id,
          company_name: activity.debtors?.company_name || 'Unknown',
          invoice_id: activity.invoice_id,
          invoice_number: activity.invoices?.invoice_number || null,
          invoice_status: invoiceStatus,
          activity_type: activity.activity_type,
          direction: activity.direction,
          channel: activity.channel,
          subject: activity.subject,
          message_body: activity.message_body,
          sent_at: activity.sent_at,
          delivered_at: activity.delivered_at,
          opened_at: activity.opened_at,
          responded_at: activity.responded_at,
          response_message: activity.response_message,
          created_at: activity.created_at,
          is_archived: isArchived,
          persona_key: personaKey,
          metadata: activity.metadata,
        };
      });
    },
  });

  // Apply filters
  const filteredData = useMemo(() => {
    if (!outreachData) return [];

    return outreachData.filter((record) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          record.company_name.toLowerCase().includes(query) ||
          record.invoice_number?.toLowerCase().includes(query) ||
          record.subject?.toLowerCase().includes(query) ||
          record.message_body.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Channel filter
      if (channelFilter !== 'all' && record.channel !== channelFilter) return false;

      // Direction filter
      if (directionFilter !== 'all' && record.direction !== directionFilter) return false;

      // Status filter (active vs archived)
      if (statusFilter === 'active' && record.is_archived) return false;
      if (statusFilter === 'archived' && !record.is_archived) return false;

      // Include archived toggle
      if (!includeArchived && record.is_archived) return false;

      return true;
    });
  }, [outreachData, searchQuery, channelFilter, directionFilter, statusFilter, includeArchived]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, channelFilter, directionFilter, statusFilter, includeArchived]);

  // Stats
  const stats = useMemo(() => {
    if (!outreachData) return { total: 0, active: 0, archived: 0, delivered: 0, opened: 0, responded: 0 };
    
    return {
      total: outreachData.length,
      active: outreachData.filter(r => !r.is_archived).length,
      archived: outreachData.filter(r => r.is_archived).length,
      delivered: outreachData.filter(r => r.delivered_at).length,
      opened: outreachData.filter(r => r.opened_at).length,
      responded: outreachData.filter(r => r.responded_at).length,
    };
  }, [outreachData]);

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />Email</Badge>;
      case 'sms':
        return <Badge variant="outline" className="gap-1"><MessageSquare className="h-3 w-3" />SMS</Badge>;
      case 'phone':
        return <Badge variant="outline" className="gap-1"><MessageSquare className="h-3 w-3" />Phone</Badge>;
      default:
        return <Badge variant="outline">{channel}</Badge>;
    }
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'outbound') {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 gap-1"><Send className="h-3 w-3" />Sent</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1"><Inbox className="h-3 w-3" />Received</Badge>;
  };

  const getStatusIndicators = (record: OutreachRecord) => {
    const indicators = [];
    
    if (record.delivered_at) {
      indicators.push(
        <span key="delivered" className="flex items-center gap-1 text-xs text-green-600" title={`Delivered: ${format(new Date(record.delivered_at), "MMM d, h:mm a")}`}>
          <CheckCircle className="h-3 w-3" />
        </span>
      );
    }
    if (record.opened_at) {
      indicators.push(
        <span key="opened" className="flex items-center gap-1 text-xs text-blue-600" title={`Opened: ${format(new Date(record.opened_at), "MMM d, h:mm a")}`}>
          <Eye className="h-3 w-3" />
        </span>
      );
    }
    if (record.responded_at) {
      indicators.push(
        <span key="responded" className="flex items-center gap-1 text-xs text-purple-600" title={`Responded: ${format(new Date(record.responded_at), "MMM d, h:mm a")}`}>
          <MessageSquare className="h-3 w-3" />
        </span>
      );
    }
    
    return indicators.length > 0 ? indicators : null;
  };

  const stripHtmlTags = (html: string): string => {
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n');
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6" />
              Outreach History
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete history of all collection communications including archived records for settled invoices
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Records</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{stats.archived}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Archive className="h-3 w-3" />Archived
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.delivered}</div>
            <div className="text-xs text-muted-foreground">Delivered</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.opened}</div>
            <div className="text-xs text-muted-foreground">Opened</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.responded}</div>
            <div className="text-xs text-muted-foreground">Responded</div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by account, invoice, subject, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={directionFilter} onValueChange={setDirectionFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Directions</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="archived">Archived Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-archived"
                  checked={includeArchived}
                  onCheckedChange={(checked) => setIncludeArchived(!!checked)}
                />
                <Label htmlFor="include-archived" className="text-sm cursor-pointer">
                  Include archived (settled invoice) records for risk analysis
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardContent className="p-0">
            {filteredData.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No outreach records found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((record) => (
                      <TableRow 
                        key={record.id}
                        className={cn(record.is_archived && "opacity-60 bg-muted/30")}
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(record.created_at), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(record.created_at), "h:mm a")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/debtors/${record.debtor_id}`)}
                            className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                          >
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[150px]">{record.company_name}</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          {record.invoice_number ? (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => navigate(`/invoices/${record.invoice_id}`)}
                                className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                              >
                                <FileText className="h-3 w-3" />
                                #{record.invoice_number}
                              </button>
                              {record.invoice_status && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] w-fit",
                                    SETTLED_STATUSES.includes(record.invoice_status) && "bg-muted"
                                  )}
                                >
                                  {record.invoice_status}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Account Level</span>
                          )}
                        </TableCell>
                        <TableCell>{getChannelBadge(record.channel)}</TableCell>
                        <TableCell>{getDirectionBadge(record.direction)}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate text-sm">
                            {record.subject || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getStatusIndicators(record)}
                            {record.is_archived && (
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <Archive className="h-3 w-3" />
                                Archived
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewRecord(record)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, filteredData.length)} of {filteredData.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewRecord} onOpenChange={(open) => !open && setPreviewRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Mail className="h-5 w-5" />
              Outreach Details
              {previewRecord?.is_archived && (
                <Badge variant="secondary" className="gap-1">
                  <Archive className="h-3 w-3" />
                  Archived
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {previewRecord && format(new Date(previewRecord.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {previewRecord && (
            <div className="space-y-4">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted rounded-lg text-sm">
                <div>
                  <span className="text-muted-foreground">Account:</span>
                  <button
                    onClick={() => {
                      navigate(`/debtors/${previewRecord.debtor_id}`);
                      setPreviewRecord(null);
                    }}
                    className="ml-2 font-medium text-primary hover:underline"
                  >
                    {previewRecord.company_name}
                  </button>
                </div>
                {previewRecord.invoice_number && (
                  <div>
                    <span className="text-muted-foreground">Invoice:</span>
                    <button
                      onClick={() => {
                        navigate(`/invoices/${previewRecord.invoice_id}`);
                        setPreviewRecord(null);
                      }}
                      className="ml-2 font-medium text-primary hover:underline"
                    >
                      #{previewRecord.invoice_number}
                    </button>
                    {previewRecord.invoice_status && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {previewRecord.invoice_status}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Channel:</span>
                  {getChannelBadge(previewRecord.channel)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Direction:</span>
                  {getDirectionBadge(previewRecord.direction)}
                </div>
              </div>

              {/* Delivery Status */}
              {(previewRecord.delivered_at || previewRecord.opened_at || previewRecord.responded_at) && (
                <div className="flex flex-wrap gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  {previewRecord.delivered_at && (
                    <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      Delivered {format(new Date(previewRecord.delivered_at), "MMM d, h:mm a")}
                    </div>
                  )}
                  {previewRecord.opened_at && (
                    <div className="flex items-center gap-1 text-sm text-blue-700 dark:text-blue-400">
                      <Eye className="h-4 w-4" />
                      Opened {format(new Date(previewRecord.opened_at), "MMM d, h:mm a")}
                    </div>
                  )}
                  {previewRecord.responded_at && (
                    <div className="flex items-center gap-1 text-sm text-purple-700 dark:text-purple-400">
                      <MessageSquare className="h-4 w-4" />
                      Responded {format(new Date(previewRecord.responded_at), "MMM d, h:mm a")}
                    </div>
                  )}
                </div>
              )}

              {/* Subject */}
              {previewRecord.subject && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Subject</p>
                  <div className="p-3 bg-accent rounded border">
                    {previewRecord.subject}
                  </div>
                </div>
              )}

              {/* Message Body */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Message</p>
                <div className="p-4 bg-background border rounded max-h-[250px] overflow-y-auto">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {stripHtmlTags(previewRecord.message_body)}
                  </div>
                </div>
              </div>

              {/* Response */}
              {previewRecord.response_message && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Response</p>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded max-h-[150px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm">
                      {previewRecord.response_message}
                    </div>
                  </div>
                </div>
              )}

              {/* Archived Note */}
              {previewRecord.is_archived && (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <Archive className="h-4 w-4 inline mr-2" />
                  This record is archived because the associated invoice was settled ({previewRecord.invoice_status}). 
                  The data remains available for risk analysis and historical reporting.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
