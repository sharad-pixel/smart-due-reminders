import { useState, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Clock, Brain, PauseCircle, PlayCircle, Filter, Users, Send, FileText, CheckCircle, Trash2, Check, X, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Zap, Search, AlertTriangle, RotateCcw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AGING_BUCKETS = [
  { key: "current", label: "Current", color: "bg-green-500", minDays: 0, maxDays: 0 },
  { key: "dpd_1_30", label: "1-30 Days", color: "bg-yellow-500", minDays: 1, maxDays: 30 },
  { key: "dpd_31_60", label: "31-60 Days", color: "bg-orange-500", minDays: 31, maxDays: 60 },
  { key: "dpd_61_90", label: "61-90 Days", color: "bg-red-400", minDays: 61, maxDays: 90 },
  { key: "dpd_91_120", label: "91-120 Days", color: "bg-red-500", minDays: 91, maxDays: 120 },
  { key: "dpd_121_150", label: "121-150 Days", color: "bg-red-600", minDays: 121, maxDays: 150 },
  { key: "dpd_150_plus", label: "150+ Days", color: "bg-red-700", minDays: 151, maxDays: null },
];

interface RefreshResult {
  workflowsCreated: number;
  workflowsFixed: number;
  skippedCurrent: number;
  schedulerResult?: {
    drafted: number;
    sent: number;
    failed: number;
  };
}

const Outreach = () => {
  usePageTitle("Outreach");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [draftFilter, setDraftFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [accountOutreachSearch, setAccountOutreachSearch] = useState<string>("");
  const [accountOutreachPage, setAccountOutreachPage] = useState<number>(1);
  const ACCOUNT_OUTREACH_PAGE_SIZE = 10;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Mutation for bulk approving drafts
  const bulkApproveDrafts = useMutation({
    mutationFn: async (draftIds: string[]) => {
      const { error } = await supabase
        .from("ai_drafts")
        .update({ status: "approved" })
        .in("id", draftIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedDraftIds.size} draft(s) approved`);
      setSelectedDraftIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach-drafts"] });
    },
    onError: () => toast.error("Failed to approve drafts"),
  });

  // Mutation for bulk rejecting/deleting drafts
  const bulkRejectDrafts = useMutation({
    mutationFn: async (draftIds: string[]) => {
      const { error } = await supabase
        .from("ai_drafts")
        .delete()
        .in("id", draftIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedDraftIds.size} draft(s) deleted`);
      setSelectedDraftIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach-drafts"] });
    },
    onError: () => toast.error("Failed to delete drafts"),
  });

  // Mutation for sending drafts
  const sendDrafts = useMutation({
    mutationFn: async (draftIds: string[]) => {
      const results = {
        sent: 0,
        failed: 0,
        alreadySent: 0,
        errors: [] as string[],
      };

      for (const draftId of draftIds) {
        const { data, error } = await supabase.functions.invoke("send-ai-draft", {
          body: { draft_id: draftId },
        });

        if (error) {
          results.failed++;
          results.errors.push(`Draft ${draftId}: ${error.message}`);
          continue;
        }

        if ((data as any)?.already_sent) {
          results.alreadySent++;
          continue;
        }

        if ((data as any)?.error) {
          results.failed++;
          results.errors.push(`Draft ${draftId}: ${(data as any).error}`);
          continue;
        }

        results.sent++;
      }

      return results;
    },
    onSuccess: (data) => {
      if (data.sent > 0) toast.success(`${data.sent} email(s) sent successfully`);
      if (data.alreadySent > 0) toast.info(`${data.alreadySent} draft(s) already sent`);
      if (data.failed > 0) toast.error(`${data.failed} email(s) failed to send`);

      setSelectedDraftIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-summary"] });
    },
    onError: (error) => {
      console.error("Send error:", error);
      const message = error instanceof Error ? error.message : "Failed to send drafts";
      toast.error(message);
    },
  });

  // Refresh outreach: ensure all invoices have workflows and generate drafts
  const handleRefreshOutreach = async () => {
    setIsRefreshing(true);
    setRefreshResult(null);
    try {
      toast.info("Scanning all invoices and generating outreach...");
      
      const { data, error } = await supabase.functions.invoke("ensure-invoice-workflows", {
        body: {},
      });

      if (error) {
        console.error("Refresh error:", error);
        toast.error("Failed to refresh outreach");
        return;
      }

      const result = data as RefreshResult;
      setRefreshResult(result);

      // Show detailed results
      const messages: string[] = [];
      if (result?.workflowsCreated > 0) {
        messages.push(`${result.workflowsCreated} workflow(s) assigned`);
      }
      if (result?.workflowsFixed > 0) {
        messages.push(`${result.workflowsFixed} workflow(s) fixed`);
      }
      if (result?.schedulerResult?.drafted > 0) {
        messages.push(`${result.schedulerResult.drafted} draft(s) created`);
      }
      if (result?.schedulerResult?.sent > 0) {
        messages.push(`${result.schedulerResult.sent} email(s) sent`);
      }
      if (result?.skippedCurrent > 0) {
        messages.push(`${result.skippedCurrent} current-bucket invoice(s) skipped`);
      }

      if (messages.length > 0) {
        toast.success(messages.join(", "));
      } else {
        toast.success("All invoices are up to date");
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["outreach-summary"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-errors"] });
    } catch (err) {
      console.error("Refresh exception:", err);
      toast.error("Failed to refresh outreach");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch outreach errors
  const { data: outreachErrors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery({
    queryKey: ["outreach-errors"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("outreach_errors")
        .select(`
          id, error_type, error_message, step_number, attempted_at, resolved_at, retry_count,
          invoices (id, invoice_number, debtors (company_name, name))
        `)
        .is("resolved_at", null)
        .order("attempted_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation to retry failed outreach
  const retryError = useMutation({
    mutationFn: async (errorId: string) => {
      // Mark as resolved
      await supabase
        .from("outreach_errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", errorId);

      // Trigger refresh to regenerate
      await supabase.functions.invoke("daily-cadence-scheduler", { body: {} });
    },
    onSuccess: () => {
      toast.success("Retrying outreach generation...");
      queryClient.invalidateQueries({ queryKey: ["outreach-errors"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-drafts"] });
    },
    onError: () => toast.error("Failed to retry"),
  });

  // Fetch summary stats
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["outreach-summary"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select(`
          id, amount, due_date, aging_bucket, status, outreach_paused,
          debtors (id, company_name, outreach_paused)
        `)
        .in("status", ["Open", "InPaymentPlan"]);

      if (invError) throw invError;

      const { data: drafts, error: draftError } = await supabase
        .from("ai_drafts")
        .select("id, status, sent_at")
        .in("status", ["pending_approval", "approved"]);

      if (draftError) throw draftError;

      const totalInvoices = invoices?.length || 0;
      const totalAR = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      const pausedCount = invoices?.filter(inv => inv.outreach_paused || inv.debtors?.outreach_paused).length || 0;

      const pendingDrafts = drafts?.filter(d => d.status === "pending_approval").length || 0;
      const approvedDrafts = drafts?.filter(d => d.status === "approved" && !d.sent_at).length || 0;

      const bucketStats = AGING_BUCKETS.map(bucket => {
        const bucketInvoices = invoices?.filter(inv => inv.aging_bucket === bucket.key) || [];
        const midDays = bucket.maxDays ? Math.floor((bucket.minDays + bucket.maxDays) / 2) : bucket.minDays + 30;
        const persona = getPersonaByDaysPastDue(midDays);

        return {
          ...bucket,
          count: bucketInvoices.length,
          amount: bucketInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
          persona,
        };
      }).filter(b => b.count > 0);

      return {
        totalInvoices,
        totalAR,
        pausedCount,
        pendingDrafts,
        approvedDrafts,
        bucketStats,
      };
    },
  });

  // Fetch drafts for management
  const { data: draftsData, isLoading: draftsLoading, refetch: refetchDrafts } = useQuery({
    queryKey: ["outreach-drafts"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id, subject, message_body, status, step_number,
          recommended_send_date, created_at, sent_at,
          days_past_due,
          invoices (
            id, invoice_number, amount, due_date,
            debtors (id, company_name, name)
          ),
          collection_workflow_steps (label)
        `)
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true })
        .limit(250);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch account level outreach activities
  const { data: accountOutreachData, isLoading: accountOutreachLoading, refetch: refetchAccountOutreach } = useQuery({
    queryKey: ["account-outreach-activities"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("collection_activities")
        .select(`
          id, activity_type, channel, direction, subject, message_body, 
          sent_at, delivered_at, opened_at, responded_at, created_at,
          metadata,
          debtors (id, company_name, name, email)
        `)
        .eq("activity_type", "account_level_outreach")
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) throw error;
      return data || [];
    },
  });

  // Filter drafts based on selection and search
  const filteredDrafts = useMemo(() => {
    if (!draftsData) return [];
    
    let filtered = draftsData.filter(draft => {
      const isSent = !!draft.sent_at;
      if (draftFilter === "pending") return draft.status === "pending_approval";
      if (draftFilter === "approved") return draft.status === "approved" && !isSent;
      if (draftFilter === "sent") return isSent;
      return true;
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(draft => {
        const invoice = draft.invoices as any;
        const companyName = invoice?.debtors?.company_name?.toLowerCase() || "";
        const debtorName = invoice?.debtors?.name?.toLowerCase() || "";
        const invoiceNumber = invoice?.invoice_number?.toLowerCase() || "";
        const subject = draft.subject?.toLowerCase() || "";
        
        return companyName.includes(query) || 
               debtorName.includes(query) || 
               invoiceNumber.includes(query) ||
               subject.includes(query);
      });
    }

    return filtered;
  }, [draftsData, draftFilter, searchQuery]);

  // Filter account outreach based on dedicated search
  const filteredAccountOutreach = useMemo(() => {
    if (!accountOutreachData) return [];
    
    if (!accountOutreachSearch.trim()) return accountOutreachData;

    const query = accountOutreachSearch.toLowerCase();
    return accountOutreachData.filter((activity: any) => {
      const debtor = activity.debtors as any;
      const companyName = debtor?.company_name?.toLowerCase() || "";
      const debtorName = debtor?.name?.toLowerCase() || "";
      const email = debtor?.email?.toLowerCase() || "";
      const subject = activity.subject?.toLowerCase() || "";
      
      return companyName.includes(query) || 
             debtorName.includes(query) || 
             email.includes(query) ||
             subject.includes(query);
    });
  }, [accountOutreachData, accountOutreachSearch]);

  // Paginated account outreach
  const paginatedAccountOutreach = useMemo(() => {
    const startIndex = (accountOutreachPage - 1) * ACCOUNT_OUTREACH_PAGE_SIZE;
    return filteredAccountOutreach.slice(startIndex, startIndex + ACCOUNT_OUTREACH_PAGE_SIZE);
  }, [filteredAccountOutreach, accountOutreachPage]);

  const totalAccountOutreachPages = Math.ceil(filteredAccountOutreach.length / ACCOUNT_OUTREACH_PAGE_SIZE);

  // Count drafts by status
  const draftCounts = useMemo(() => {
    if (!draftsData) return { pending: 0, approved: 0, sent: 0 };
    
    return {
      pending: draftsData.filter(d => d.status === "pending_approval").length,
      approved: draftsData.filter(d => d.status === "approved" && !d.sent_at).length,
      sent: draftsData.filter(d => !!d.sent_at).length,
    };
  }, [draftsData]);

  const approvedUnsentDraftIds = useMemo(() => {
    return (draftsData || [])
      .filter((d: any) => d.status === "approved" && !d.sent_at)
      .map((d: any) => d.id as string);
  }, [draftsData]);

  const selectedApprovedDraftIds = useMemo(() => {
    if (!draftsData) return [] as string[];
    const byId = new Map((draftsData as any[]).map((d) => [d.id, d]));
    return Array.from(selectedDraftIds).filter((id) => {
      const d = byId.get(id);
      return d && d.status === "approved" && !d.sent_at;
    });
  }, [draftsData, selectedDraftIds]);

  const personaSchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const safeScheduledDateTime = (recommendedSendDate?: string | null) => {
      if (!recommendedSendDate) return null;
      const isoLike = recommendedSendDate.includes("T")
        ? recommendedSendDate
        : `${recommendedSendDate}T09:00:00`;
      const dt = new Date(isoLike);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const getDraftPersonaKey = (draft: any): keyof typeof personaConfig | null => {
      const invoice = draft.invoices as any;
      const dueDateRaw = invoice?.due_date as string | undefined;

      let daysPastDue: number | null = typeof draft.days_past_due === "number" ? draft.days_past_due : null;
      if (daysPastDue === null && dueDateRaw) {
        const dueDate = new Date(dueDateRaw);
        if (!Number.isNaN(dueDate.getTime())) {
          daysPastDue = differenceInCalendarDays(today, dueDate);
        }
      }

      if (daysPastDue !== null && daysPastDue <= 0) return "sam";

      const persona = typeof daysPastDue === "number" ? getPersonaByDaysPastDue(daysPastDue) : null;
      return (persona?.name?.toLowerCase() as keyof typeof personaConfig) || null;
    };

    const upcoming = (draftsData || []).filter((d: any) => !d.sent_at);

    const byPersona: Record<string, { key: string; nextApproved: Date | null; nextAny: Date | null; approvedCount: number; pendingCount: number; total: number; }> = {};

    for (const key of Object.keys(personaConfig)) {
      byPersona[key] = {
        key,
        nextApproved: null,
        nextAny: null,
        approvedCount: 0,
        pendingCount: 0,
        total: 0,
      };
    }

    for (const draft of upcoming) {
      const personaKey = getDraftPersonaKey(draft);
      if (!personaKey || !byPersona[personaKey]) continue;

      const scheduled = safeScheduledDateTime(draft.recommended_send_date) || safeScheduledDateTime(draft.created_at);
      if (!scheduled) continue;

      byPersona[personaKey].total += 1;
      if (draft.status === "approved") {
        byPersona[personaKey].approvedCount += 1;
        if (!byPersona[personaKey].nextApproved || scheduled < byPersona[personaKey].nextApproved) {
          byPersona[personaKey].nextApproved = scheduled;
        }
      } else if (draft.status === "pending_approval") {
        byPersona[personaKey].pendingCount += 1;
      }

      if (!byPersona[personaKey].nextAny || scheduled < byPersona[personaKey].nextAny) {
        byPersona[personaKey].nextAny = scheduled;
      }
    }

    return Object.keys(personaConfig).map((key) => ({
      persona: personaConfig[key],
      ...byPersona[key],
    }));
  }, [draftsData]);

  const toggleBucket = (bucketKey: string) => {
    const newExpanded = new Set(expandedBuckets);
    if (newExpanded.has(bucketKey)) {
      newExpanded.delete(bucketKey);
    } else {
      newExpanded.add(bucketKey);
    }
    setExpandedBuckets(newExpanded);
  };

  const toggleDraftSelection = (draftId: string) => {
    const newSelected = new Set(selectedDraftIds);
    if (newSelected.has(draftId)) {
      newSelected.delete(draftId);
    } else {
      newSelected.add(draftId);
    }
    setSelectedDraftIds(newSelected);
  };

  const selectAllDrafts = () => {
    if (selectedDraftIds.size === filteredDrafts.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(filteredDrafts.map((d: any) => d.id)));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const errorCount = outreachErrors?.length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Outreach Command Center
            </h1>
            <p className="text-muted-foreground">
              Manage AI-generated collection emails and account outreach
            </p>
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowErrors(!showErrors)}
                className="text-destructive border-destructive/50"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {errorCount} Error{errorCount !== 1 ? "s" : ""}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshOutreach}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Processing..." : "Refresh Outreach"}
            </Button>
          </div>
        </div>

        {/* Refresh Result Alert */}
        {refreshResult && (
          <Alert className="bg-primary/5 border-primary/20">
            <Zap className="h-4 w-4" />
            <AlertTitle>Outreach Refresh Complete</AlertTitle>
            <AlertDescription>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                {refreshResult.workflowsCreated > 0 && (
                  <span className="text-green-600">✓ {refreshResult.workflowsCreated} workflow(s) assigned</span>
                )}
                {refreshResult.workflowsFixed > 0 && (
                  <span className="text-blue-600">✓ {refreshResult.workflowsFixed} workflow(s) fixed</span>
                )}
                {refreshResult.schedulerResult?.drafted > 0 && (
                  <span className="text-purple-600">✓ {refreshResult.schedulerResult.drafted} draft(s) created</span>
                )}
                {refreshResult.schedulerResult?.sent > 0 && (
                  <span className="text-green-600">✓ {refreshResult.schedulerResult.sent} email(s) sent</span>
                )}
                {refreshResult.schedulerResult?.failed > 0 && (
                  <span className="text-red-600">✗ {refreshResult.schedulerResult.failed} failed</span>
                )}
                {refreshResult.skippedCurrent > 0 && (
                  <span className="text-muted-foreground">{refreshResult.skippedCurrent} current-bucket skipped</span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Errors Panel */}
        {showErrors && errorCount > 0 && (
          <Card className="border-destructive/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Outreach Errors
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowErrors(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                These invoices failed to generate outreach drafts. Click retry to attempt again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outreachErrors?.map((err: any) => {
                    const invoice = err.invoices as any;
                    return (
                      <TableRow key={err.id}>
                        <TableCell className="font-medium">
                          {invoice?.invoice_number || "—"}
                        </TableCell>
                        <TableCell>
                          {invoice?.debtors?.company_name || invoice?.debtors?.name || "—"}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                          {err.error_message}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(err.attempted_at), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryError.mutate(err.id)}
                            disabled={retryError.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : summaryData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summaryData.totalInvoices}</p>
                    <p className="text-sm text-muted-foreground">Open Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Zap className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(summaryData.totalAR)}</p>
                    <p className="text-sm text-muted-foreground">Total AR</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summaryData.pendingDrafts}</p>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summaryData.approvedDrafts}</p>
                    <p className="text-sm text-muted-foreground">Ready to Send</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drafts" className="relative">
              Drafts
              {draftCounts.pending > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {draftCounts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="account-outreach">Account Outreach</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Persona Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Scheduled Outreach by Persona
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personaSchedule.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={item.persona.avatar} alt={item.persona.name} />
                        <AvatarFallback>{item.persona.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.persona.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.persona.tone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{item.total}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.approvedCount} ready
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Needed Alert */}
            {summaryData && summaryData.pendingDrafts > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    You have <strong>{summaryData.pendingDrafts}</strong> draft(s) pending review.
                  </span>
                  <Button size="sm" onClick={() => setActiveTab("drafts")}>
                    Review Drafts
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Bucket Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Outreach by Aging Bucket</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summaryData?.bucketStats.map((bucket) => (
                    <Collapsible
                      key={bucket.key}
                      open={expandedBuckets.has(bucket.key)}
                      onOpenChange={() => toggleBucket(bucket.key)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                            <span className="font-medium">{bucket.label}</span>
                            {bucket.persona && (
                              <Badge variant="outline" className="text-xs">
                                {bucket.persona.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {bucket.count} invoice{bucket.count !== 1 ? "s" : ""}
                            </span>
                            <span className="font-medium">{formatCurrency(bucket.amount)}</span>
                            {expandedBuckets.has(bucket.key) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="pl-6 pr-3 py-2 text-sm text-muted-foreground bg-muted/50 rounded-lg">
                          {bucket.persona ? (
                            <p>
                              AI persona <strong>{bucket.persona.name}</strong> handles this bucket
                              with a <strong>{bucket.persona.tone}</strong> approach.
                            </p>
                          ) : (
                            <p>No persona configured for this bucket.</p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="drafts" className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, invoice, or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={draftFilter} onValueChange={setDraftFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drafts</SelectItem>
                  <SelectItem value="pending">
                    Pending ({draftCounts.pending})
                  </SelectItem>
                  <SelectItem value="approved">
                    Ready to Send ({draftCounts.approved})
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDrafts()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Bulk Actions */}
            {selectedDraftIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">
                  {selectedDraftIds.size} selected
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkApproveDrafts.mutate(Array.from(selectedDraftIds))}
                  disabled={bulkApproveDrafts.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkRejectDrafts.mutate(Array.from(selectedDraftIds))}
                  disabled={bulkRejectDrafts.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                {selectedApprovedDraftIds.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => sendDrafts.mutate(selectedApprovedDraftIds)}
                    disabled={sendDrafts.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send ({selectedApprovedDraftIds.length})
                  </Button>
                )}
              </div>
            )}

            {/* Send All Approved Button */}
            {approvedUnsentDraftIds.length > 0 && selectedDraftIds.size === 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={() => sendDrafts.mutate(approvedUnsentDraftIds)}
                  disabled={sendDrafts.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send All Approved ({approvedUnsentDraftIds.length})
                </Button>
              </div>
            )}

            {/* Drafts List */}
            {draftsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : filteredDrafts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No drafts found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* Select All */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <Checkbox
                    checked={selectedDraftIds.size === filteredDrafts.length && filteredDrafts.length > 0}
                    onCheckedChange={selectAllDrafts}
                  />
                  <span className="text-sm text-muted-foreground">Select all</span>
                </div>

                {filteredDrafts.map((draft: any) => {
                  const invoice = draft.invoices as any;
                  const customerName = invoice?.debtors?.company_name || invoice?.debtors?.name || "Unknown";
                  const daysPastDue = draft.days_past_due || 0;
                  const persona = getPersonaByDaysPastDue(daysPastDue);

                  return (
                    <Card
                      key={draft.id}
                      className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedDraftIds.has(draft.id) ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedDraftIds.has(draft.id)}
                            onCheckedChange={() => toggleDraftSelection(draft.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="flex-1 min-w-0"
                            onClick={() => navigate(`/invoices/${invoice?.id}`)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{customerName}</span>
                              <Badge variant="outline" className="text-xs">
                                {invoice?.invoice_number}
                              </Badge>
                              {draft.status === "approved" ? (
                                <Badge className="bg-green-500/10 text-green-600 text-xs">
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-500/10 text-yellow-600 text-xs">
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {draft.subject || "No subject"}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {persona && (
                                <span className="flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={persona.avatar} />
                                    <AvatarFallback>{persona.name[0]}</AvatarFallback>
                                  </Avatar>
                                  {persona.name}
                                </span>
                              )}
                              <span>Step {draft.step_number}</span>
                              <span>{daysPastDue} days past due</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium">
                              {formatCurrency(invoice?.amount || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {draft.recommended_send_date
                                ? format(new Date(draft.recommended_send_date), "MMM d")
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Account Outreach Tab */}
          <TabsContent value="account-outreach" className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search account outreach..."
                  value={accountOutreachSearch}
                  onChange={(e) => {
                    setAccountOutreachSearch(e.target.value);
                    setAccountOutreachPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchAccountOutreach()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {accountOutreachLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : filteredAccountOutreach.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No account-level outreach found</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedAccountOutreach.map((activity: any) => {
                    const debtor = activity.debtors as any;
                    return (
                      <Card key={activity.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {debtor?.company_name || debtor?.name || "Unknown"}
                              </p>
                              <p className="text-sm text-muted-foreground truncate max-w-md">
                                {activity.subject || "No subject"}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">
                                {activity.sent_at
                                  ? format(new Date(activity.sent_at), "MMM d, h:mm a")
                                  : format(new Date(activity.created_at), "MMM d, h:mm a")}
                              </p>
                              <div className="flex gap-1 justify-end mt-1">
                                {activity.delivered_at && (
                                  <Badge variant="outline" className="text-xs">Delivered</Badge>
                                )}
                                {activity.opened_at && (
                                  <Badge variant="outline" className="text-xs bg-blue-500/10">Opened</Badge>
                                )}
                                {activity.responded_at && (
                                  <Badge variant="outline" className="text-xs bg-green-500/10">Replied</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalAccountOutreachPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAccountOutreachPage(p => Math.max(1, p - 1))}
                      disabled={accountOutreachPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {accountOutreachPage} of {totalAccountOutreachPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAccountOutreachPage(p => Math.min(totalAccountOutreachPages, p + 1))}
                      disabled={accountOutreachPage === totalAccountOutreachPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Outreach;
