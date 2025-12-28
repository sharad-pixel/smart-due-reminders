import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Clock, Brain, PauseCircle, PlayCircle, Filter, Users, Send, FileText, CheckCircle, Trash2, Check, X, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Zap, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

const AGING_BUCKETS = [
  { key: "current", label: "Current", color: "bg-green-500", minDays: 0, maxDays: 0 },
  { key: "dpd_1_30", label: "1-30 Days", color: "bg-yellow-500", minDays: 1, maxDays: 30 },
  { key: "dpd_31_60", label: "31-60 Days", color: "bg-orange-500", minDays: 31, maxDays: 60 },
  { key: "dpd_61_90", label: "61-90 Days", color: "bg-red-400", minDays: 61, maxDays: 90 },
  { key: "dpd_91_120", label: "91-120 Days", color: "bg-red-500", minDays: 91, maxDays: 120 },
  { key: "dpd_121_150", label: "121-150 Days", color: "bg-red-600", minDays: 121, maxDays: 150 },
  { key: "dpd_150_plus", label: "150+ Days", color: "bg-red-700", minDays: 151, maxDays: null },
];

const Outreach = () => {
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

  // Mutation for sending drafts (uses send-ai-draft so it works with user auth)
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

      // Get all open invoices with debtor info
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select(`
          id, amount, due_date, aging_bucket, status, outreach_paused,
          debtors (id, company_name, outreach_paused)
        `)
        .in("status", ["Open", "InPaymentPlan"]);

      if (invError) throw invError;

      // Get draft counts by status
      const { data: drafts, error: draftError } = await supabase
        .from("ai_drafts")
        .select("id, status, sent_at")
        .in("status", ["pending_approval", "approved"]);

      if (draftError) throw draftError;

      // Calculate summary
      const totalInvoices = invoices?.length || 0;
      const totalAR = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      const pausedCount = invoices?.filter(inv => inv.outreach_paused || inv.debtors?.outreach_paused).length || 0;

      // Drafts: pending = pending_approval status, approved = approved status with no sent_at
      const pendingDrafts = drafts?.filter(d => d.status === "pending_approval").length || 0;
      const approvedDrafts = drafts?.filter(d => d.status === "approved" && !d.sent_at).length || 0;

      // Bucket breakdown
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

    // Apply search filter
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
      // If it's a plain date (YYYY-MM-DD), assume 9:00 AM local.
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

      // Current invoices (0 DPD) should still route to the earliest persona.
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
      setSelectedDraftIds(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Outreach Command Center</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage AI-generated collection emails and track outreach status.
            </p>
          </div>
          
          {draftCounts.approved > 0 && (
            <Button 
              onClick={() => sendDrafts.mutate(approvedUnsentDraftIds)}
              disabled={sendDrafts.isPending || approvedUnsentDraftIds.length === 0}
              className="gap-2"
            >
              {sendDrafts.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send {draftCounts.approved} Approved
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-[550px]">
            <TabsTrigger value="overview" className="gap-2">
              <Mail className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="drafts" className="gap-2">
              <FileText className="h-4 w-4" />
              Drafts
              {draftCounts.pending > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {draftCounts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="account-outreach" className="gap-2">
              <Zap className="h-4 w-4" />
              Account
              {accountOutreachData && accountOutreachData.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {accountOutreachData.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Bar - visible on drafts and account-outreach tabs */}
          {(activeTab === "drafts" || activeTab === "account-outreach") && (
            <div className="mt-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company, invoice, or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {summaryLoading ? (
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : summaryData ? (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryData.totalInvoices}</p>
                          <p className="text-sm text-muted-foreground">Active Invoices</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/10">
                          <Clock className="h-5 w-5 text-yellow-600" />
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
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryData.approvedDrafts}</p>
                          <p className="text-sm text-muted-foreground">Ready to Send</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <PauseCircle className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summaryData.pausedCount}</p>
                          <p className="text-sm text-muted-foreground">Paused</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                 </div>

                 {/* Scheduled by Persona */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg">Next Scheduled Outreach by Persona</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                       {personaSchedule.map((row) => {
                         const next = row.nextApproved || row.nextAny;
                         const nextLabel = row.nextApproved ? "Next approved" : row.nextAny ? "Next pending" : "No upcoming";
                         return (
                           <div key={row.key} className="rounded-lg border p-3">
                             <div className="flex items-center gap-3">
                               <Avatar className="h-9 w-9">
                                 <AvatarImage src={row.persona.avatar} alt={`${row.persona.name} persona`} />
                                 <AvatarFallback style={{ backgroundColor: row.persona.color }}>
                                   {row.persona.name[0]}
                                 </AvatarFallback>
                               </Avatar>
                               <div className="min-w-0 flex-1">
                                 <div className="flex items-center justify-between gap-2">
                                   <p className="font-medium truncate">{row.persona.name}</p>
                                   <Badge variant="secondary">{row.total}</Badge>
                                 </div>
                                 <p className="text-xs text-muted-foreground">{row.persona.description}</p>
                               </div>
                             </div>

                             <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                               <div className="rounded-md bg-muted p-2">
                                 <p className="text-muted-foreground">Approved</p>
                                 <p className="font-medium">{row.approvedCount}</p>
                               </div>
                               <div className="rounded-md bg-muted p-2">
                                 <p className="text-muted-foreground">Pending</p>
                                 <p className="font-medium">{row.pendingCount}</p>
                               </div>
                             </div>

                             <div className="mt-3 flex items-center justify-between gap-2">
                               <p className="text-xs text-muted-foreground">{nextLabel}</p>
                               <p className="text-xs font-medium">
                                 {next ? format(next, "MMM d, yyyy • h:mm a") : "—"}
                               </p>
                             </div>
                             <p className="mt-1 text-[11px] text-muted-foreground">Times shown in your local timezone.</p>
                           </div>
                         );
                       })}
                     </div>
                   </CardContent>
                 </Card>

                 {/* Action Alert */}
                {summaryData.pendingDrafts > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        You have <strong>{summaryData.pendingDrafts}</strong> draft{summaryData.pendingDrafts !== 1 ? 's' : ''} waiting for review.
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActiveTab("drafts")}
                      >
                        Review Drafts
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Bucket Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Outreach by Aging Bucket</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {summaryData.bucketStats.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No active invoices to display.
                      </p>
                    ) : (
                      summaryData.bucketStats.map(bucket => (
                        <Collapsible 
                          key={bucket.key}
                          open={expandedBuckets.has(bucket.key)}
                          onOpenChange={() => toggleBucket(bucket.key)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                              <div className="flex items-center gap-3">
                                {bucket.persona && (
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={bucket.persona.avatar} />
                                    <AvatarFallback style={{ backgroundColor: bucket.persona.color }}>
                                      {bucket.persona.name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{bucket.label}</span>
                                    {bucket.persona && (
                                      <span className="text-sm text-muted-foreground">
                                        ({bucket.persona.name})
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {bucket.count} invoice{bucket.count !== 1 ? 's' : ''} • {formatCurrency(bucket.amount)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{bucket.count}</Badge>
                                {expandedBuckets.has(bucket.key) ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 pt-2 text-sm text-muted-foreground">
                              <p>
                                Click "Review Drafts" above to manage emails for this bucket.
                              </p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="drafts" className="mt-6 space-y-4">
            {/* Draft Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Select value={draftFilter} onValueChange={setDraftFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      Pending Review ({draftCounts.pending})
                    </SelectItem>
                    <SelectItem value="approved">
                      Approved ({draftCounts.approved})
                    </SelectItem>
                    <SelectItem value="sent">
                      Sent ({draftCounts.sent})
                    </SelectItem>
                    <SelectItem value="all">All Drafts</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchDrafts()}
                  className="gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>

              {/* Bulk Actions */}
              {selectedDraftIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedDraftIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendDrafts.mutate(selectedApprovedDraftIds)}
                    disabled={sendDrafts.isPending || selectedApprovedDraftIds.length === 0}
                    className="gap-1"
                    title={selectedApprovedDraftIds.length === 0 ? "Select approved drafts to send" : undefined}
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkApproveDrafts.mutate(Array.from(selectedDraftIds))}
                    disabled={bulkApproveDrafts.isPending}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkRejectDrafts.mutate(Array.from(selectedDraftIds))}
                    disabled={bulkRejectDrafts.isPending}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Drafts List */}
            {draftsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : filteredDrafts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {draftFilter === "pending" && "No drafts pending review"}
                    {draftFilter === "approved" && "No approved drafts ready to send"}
                    {draftFilter === "sent" && "No sent drafts"}
                    {draftFilter === "all" && "No drafts found"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Select All */}
                <div className="flex items-center gap-2 px-1">
                  <Checkbox
                    checked={selectedDraftIds.size === filteredDrafts.length && filteredDrafts.length > 0}
                    onCheckedChange={selectAllDrafts}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({filteredDrafts.length})
                  </span>
                </div>

                <div className="space-y-3">
                  {filteredDrafts.map(draft => {
                    const invoice = draft.invoices as any;
                    const isSent = !!draft.sent_at;
                    const isApproved = draft.status === "approved" && !isSent;
                    
                    return (
                      <Card 
                        key={draft.id} 
                        className={`transition-colors ${isSent ? 'opacity-60' : ''} ${selectedDraftIds.has(draft.id) ? 'ring-2 ring-primary' : ''}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {!isSent && (
                              <Checkbox
                                checked={selectedDraftIds.has(draft.id)}
                                onCheckedChange={() => toggleDraftSelection(draft.id)}
                                className="mt-1"
                              />
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {invoice?.debtors?.company_name || invoice?.debtors?.name || 'Unknown'}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Invoice #{invoice?.invoice_number} • {formatCurrency(invoice?.amount || 0)}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  {isSent ? (
                                    <Badge variant="secondary" className="gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Sent {draft.sent_at && format(new Date(draft.sent_at), "MMM d")}
                                    </Badge>
                                  ) : isApproved ? (
                                    <Badge variant="default" className="gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Approved
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1">
                                      <Clock className="h-3 w-3" />
                                      Pending
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-sm font-medium mb-1">{draft.subject}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {draft.message_body?.replace(/<[^>]*>/g, '').slice(0, 150)}...
                              </p>
                              
                              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                <span>
                                  Step: {draft.collection_workflow_steps?.label || `Step ${draft.step_number}`}
                                </span>
                                {draft.recommended_send_date && !isSent && (
                                  <span>
                                    Scheduled: {format(new Date(draft.recommended_send_date), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                              
                              {!isSent && (
                                <div className="flex items-center gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/invoices/${invoice?.id}`)}
                                  >
                                    View Invoice
                                  </Button>
                                  {!isApproved && (
                                    <Button
                                      size="sm"
                                      onClick={() => bulkApproveDrafts.mutate([draft.id])}
                                      disabled={bulkApproveDrafts.isPending}
                                    >
                                      Approve
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Account Outreach Tab */}
          <TabsContent value="account-outreach" className="mt-6 space-y-4">
            {/* Account Outreach Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts..."
                    value={accountOutreachSearch}
                    onChange={(e) => {
                      setAccountOutreachSearch(e.target.value);
                      setAccountOutreachPage(1);
                    }}
                    className="pl-9 w-64"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchAccountOutreach()}
                  className="gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Showing {paginatedAccountOutreach.length} of {filteredAccountOutreach.length} record{filteredAccountOutreach.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Account Outreach List */}
            {accountOutreachLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : filteredAccountOutreach.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {accountOutreachSearch ? "No matching account outreach records" : "No account-level outreach records yet"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Account-level outreach emails will appear here when sent from accounts with Account Level Outreach enabled.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {paginatedAccountOutreach.map((activity: any) => {
                  const debtor = activity.debtors as any;
                  const metadata = activity.metadata as any || {};
                  const invoicesIncluded = metadata.invoices_included || [];
                  const totalAmount = metadata.total_amount || 0;
                  const invoiceCount = metadata.invoice_count || invoicesIncluded.length || 0;
                  
                  return (
                    <Card key={activity.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Zap className="h-5 w-5 text-primary" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {debtor?.company_name || debtor?.name || 'Unknown Account'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''} • ${totalAmount.toLocaleString()}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="default" className="gap-1 bg-primary/80">
                                  <Zap className="h-3 w-3" />
                                  Account Level
                                </Badge>
                                {activity.sent_at && (
                                  <Badge variant="secondary" className="gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Sent
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-sm font-medium mb-1">{activity.subject || 'No Subject'}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {activity.message_body?.replace(/<[^>]*>/g, '').slice(0, 150)}...
                            </p>
                            
                            {/* Included Invoices */}
                            {invoicesIncluded.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground mb-1">Invoices included:</p>
                                <div className="flex flex-wrap gap-1">
                                  {invoicesIncluded.slice(0, 5).map((inv: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      #{inv.invoice_number} - ${inv.amount?.toLocaleString()}
                                    </Badge>
                                  ))}
                                  {invoicesIncluded.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{invoicesIncluded.length - 5} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span>
                                Sent: {activity.sent_at ? format(new Date(activity.sent_at), "MMM d, yyyy h:mm a") : 'N/A'}
                              </span>
                              {metadata.sent_to && (
                                <span>
                                  To: {Array.isArray(metadata.sent_to) ? metadata.sent_to.join(', ') : metadata.sent_to}
                                </span>
                              )}
                              {metadata.intelligence_report?.risk_level && (
                                <Badge variant="outline" className="text-xs">
                                  Risk: {metadata.intelligence_report.risk_level}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/debtors/${debtor?.id}`)}
                              >
                                View Account
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Pagination */}
                {totalAccountOutreachPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAccountOutreachPage(p => Math.max(1, p - 1))}
                      disabled={accountOutreachPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-4">
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
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Outreach;
