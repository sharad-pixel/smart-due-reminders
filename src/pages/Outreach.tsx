import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Clock, Brain, ChevronRight, PauseCircle, PlayCircle, Filter, Users, Calendar, AlertTriangle, DollarSign, Send, FileText, CheckCircle, Eye, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

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
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>("queue");
  
  // Filter state
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [personaFilter, setPersonaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Bulk selection state for drafts
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());

  // Mutation for toggling invoice outreach pause
  const toggleInvoicePause = useMutation({
    mutationFn: async ({ invoiceId, paused }: { invoiceId: string; paused: boolean }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ 
          outreach_paused: paused,
          outreach_paused_at: paused ? new Date().toISOString() : null
        })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: (_, { paused }) => {
      toast.success(paused ? "Outreach paused for invoice" : "Outreach resumed for invoice");
      queryClient.invalidateQueries({ queryKey: ["outreach-invoices-with-drafts"] });
    },
    onError: () => toast.error("Failed to update outreach status"),
  });

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
      queryClient.invalidateQueries({ queryKey: ["pending-drafts-list"] });
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
      queryClient.invalidateQueries({ queryKey: ["pending-drafts-list"] });
    },
    onError: () => toast.error("Failed to delete drafts"),
  });

  // Fetch invoices with next scheduled outreach
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["outreach-invoices-with-drafts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          aging_bucket,
          status,
          debtor_id,
          outreach_paused,
          debtors (
            id,
            name,
            company_name,
            outreach_paused,
            collections_risk_score
          )
        `)
        .in("status", ["Open", "InPaymentPlan"])
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch next scheduled draft per invoice OR calculate from workflow steps
  const { data: nextDrafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["next-drafts-per-invoice", invoicesData],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      // Get existing pending/approved drafts
      const { data: drafts, error: draftsError } = await supabase
        .from("ai_drafts")
        .select(`
          invoice_id, 
          recommended_send_date, 
          status, 
          step_number,
          workflow_step_id,
          collection_workflow_steps (
            label
          )
        `)
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true });

      if (draftsError) throw draftsError;

      // Get earliest draft per invoice
      const nextPerInvoice: Record<string, { date: string; status: string; step: number; stepLabel: string }> = {};
      (drafts || []).forEach((draft: any) => {
        if (draft.invoice_id && !nextPerInvoice[draft.invoice_id]) {
          nextPerInvoice[draft.invoice_id] = {
            date: draft.recommended_send_date || "",
            status: draft.status || "",
            step: draft.step_number,
            stepLabel: draft.collection_workflow_steps?.label || `Step ${draft.step_number}`,
          };
        }
      });

      // For invoices without drafts, calculate next outreach from workflow steps
      const invoicesWithoutDrafts = (invoicesData || []).filter(inv => !nextPerInvoice[inv.id]);
      
      if (invoicesWithoutDrafts.length > 0) {
        // Get outreach counts per invoice to determine which step is next
        const { data: activities } = await supabase
          .from("collection_activities")
          .select("invoice_id")
          .eq("direction", "outbound")
          .not("invoice_id", "is", null);
        
        const outreachCountMap: Record<string, number> = {};
        (activities || []).forEach((a: any) => {
          outreachCountMap[a.invoice_id] = (outreachCountMap[a.invoice_id] || 0) + 1;
        });

        // Get all active workflows with their steps
        const { data: workflows } = await supabase
          .from("collection_workflows")
          .select(`
            id, aging_bucket,
            collection_workflow_steps (id, step_order, day_offset, label, is_active)
          `)
          .eq("is_active", true);

        const workflowsByBucket: Record<string, any> = {};
        (workflows || []).forEach((w: any) => {
          workflowsByBucket[w.aging_bucket] = w;
        });

        // Calculate next outreach for each invoice without drafts
        for (const invoice of invoicesWithoutDrafts) {
          const bucket = invoice.aging_bucket || "current";
          const workflow = workflowsByBucket[bucket];
          if (!workflow?.collection_workflow_steps?.length) continue;

          const steps = [...workflow.collection_workflow_steps]
            .filter((s: any) => s.is_active)
            .sort((a: any, b: any) => a.step_order - b.step_order);
          
          if (steps.length === 0) continue;

          const outreachCount = outreachCountMap[invoice.id] || 0;
          const nextStepIndex = Math.min(outreachCount, steps.length - 1);
          const nextStep = steps[nextStepIndex];
          
          if (nextStep && invoice.due_date) {
            const dueDate = new Date(invoice.due_date);
            const nextDate = addDays(dueDate, nextStep.day_offset);
            
            nextPerInvoice[invoice.id] = {
              date: nextDate.toISOString().split('T')[0],
              status: "scheduled",
              step: nextStep.step_order,
              stepLabel: nextStep.label || `Step ${nextStep.step_order}`,
            };
          }
        }
      }

      return nextPerInvoice;
    },
    enabled: !!invoicesData,
  });

  // Fetch outreach history counts and last outreach date per invoice
  const { data: outreachHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["outreach-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data, error } = await supabase
        .from("collection_activities")
        .select("invoice_id, sent_at")
        .eq("direction", "outbound")
        .not("invoice_id", "is", null)
        .order("sent_at", { ascending: false });

      if (error) throw error;

      const info: Record<string, { count: number; lastSentAt: string | null }> = {};
      (data || []).forEach((activity) => {
        if (activity.invoice_id) {
          if (!info[activity.invoice_id]) {
            info[activity.invoice_id] = { count: 0, lastSentAt: activity.sent_at };
          }
          info[activity.invoice_id].count += 1;
        }
      });
      return info;
    },
  });

  // Fetch pending drafts for Drafts tab
  const { data: pendingDrafts, isLoading: pendingDraftsLoading } = useQuery({
    queryKey: ["pending-drafts-list"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id,
          subject,
          status,
          step_number,
          recommended_send_date,
          created_at,
          invoice_id,
          invoices (
            id,
            invoice_number,
            amount,
            debtors (
              id,
              company_name
            )
          ),
          collection_workflow_steps (
            label
          )
        `)
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Helper to get days past due
  const getDaysPastDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Summary stats per bucket and persona
  const summaryStats = useMemo(() => {
    if (!invoicesData) return [];
    
    return AGING_BUCKETS.map((bucket) => {
      const bucketInvoices = invoicesData.filter((inv) => inv.aging_bucket === bucket.key);
      const totalAmount = bucketInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const pausedCount = bucketInvoices.filter((inv) => inv.outreach_paused || inv.debtors?.outreach_paused).length;
      
      // Get persona for this bucket based on days
      const midDays = bucket.maxDays ? Math.floor((bucket.minDays + bucket.maxDays) / 2) : bucket.minDays + 30;
      const persona = getPersonaByDaysPastDue(midDays);
      
      return {
        ...bucket,
        count: bucketInvoices.length,
        totalAmount,
        pausedCount,
        persona,
      };
    }).filter((b) => b.count > 0);
  }, [invoicesData]);

  // Apply filters
  const filteredInvoices = useMemo(() => {
    if (!invoicesData) return [];
    
    return invoicesData.filter((inv) => {
      // Bucket filter
      if (bucketFilter !== "all" && inv.aging_bucket !== bucketFilter) return false;
      
      // Persona filter
      if (personaFilter !== "all") {
        const dpd = getDaysPastDue(inv.due_date);
        const persona = getPersonaByDaysPastDue(dpd);
        if (!persona || persona.name.toLowerCase() !== personaFilter) return false;
      }
      
      // Status filter (paused/active)
      if (statusFilter === "paused" && !inv.outreach_paused && !inv.debtors?.outreach_paused) return false;
      if (statusFilter === "active" && (inv.outreach_paused || inv.debtors?.outreach_paused)) return false;
      
      return true;
    });
  }, [invoicesData, bucketFilter, personaFilter, statusFilter]);

  // Group filtered invoices by aging bucket, then by next email step
  const invoicesByBucket = useMemo(() => {
    return AGING_BUCKETS.map((bucket) => {
      const bucketInvoices = filteredInvoices.filter((inv) => inv.aging_bucket === bucket.key);
      
      // Group by next step label within the bucket
      const byStep: Record<string, typeof bucketInvoices> = {};
      bucketInvoices.forEach((inv) => {
        const draft = nextDrafts?.[inv.id];
        const stepKey = draft?.stepLabel || "No Outreach Scheduled";
        if (!byStep[stepKey]) byStep[stepKey] = [];
        byStep[stepKey].push(inv);
      });

      // Sort steps: scheduled first (by step number), then "No Outreach Scheduled" last
      const sortedSteps = Object.entries(byStep).sort(([a], [b]) => {
        if (a === "No Outreach Scheduled") return 1;
        if (b === "No Outreach Scheduled") return -1;
        return a.localeCompare(b);
      });

      const totalAmount = bucketInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      // Get persona for this bucket
      const midDays = bucket.maxDays ? Math.floor((bucket.minDays + bucket.maxDays) / 2) : bucket.minDays + 30;
      const persona = getPersonaByDaysPastDue(midDays);
      
      return {
        ...bucket,
        stepGroups: sortedSteps,
        totalAmount,
        count: bucketInvoices.length,
        persona,
      };
    }).filter((bucket) => bucket.count > 0);
  }, [filteredInvoices, nextDrafts]);

  const isLoading = invoicesLoading || draftsLoading || historyLoading;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return format(date, "EEEE");
    return format(date, "MMM d");
  };

  const personaList = Object.entries(personaConfig);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Outreach Command Center</h1>
          </div>
          <p className="text-muted-foreground">
            View all invoices by aging bucket with scheduled outreach dates.
          </p>
        </div>

        {/* Summary Cards by Bucket with Persona */}
        {!isLoading && summaryStats.length > 0 && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {summaryStats.map((stat) => (
              <Card 
                key={stat.key} 
                className={`cursor-pointer hover:shadow-md transition-shadow ${bucketFilter === stat.key ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setBucketFilter(bucketFilter === stat.key ? "all" : stat.key)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {stat.persona ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={stat.persona.avatar} alt={stat.persona.name} />
                        <AvatarFallback style={{ backgroundColor: stat.persona.color }}>
                          {stat.persona.name[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className={`w-8 h-8 rounded-full ${stat.color} flex items-center justify-center`}>
                        <Users className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{stat.label}</p>
                      {stat.persona && (
                        <p className="text-[10px] text-muted-foreground truncate">{stat.persona.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold">{stat.count}</p>
                    <p className="text-xs text-muted-foreground">
                      ${stat.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    {stat.pausedCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 text-orange-600 border-orange-300">
                        <PauseCircle className="h-2.5 w-2.5" />
                        {stat.pausedCount} paused
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs for Queue and Drafts */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="drafts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Drafts
              {pendingDrafts && pendingDrafts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {pendingDrafts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Queue Tab Content */}
          <TabsContent value="queue" className="mt-4 space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Select value={bucketFilter} onValueChange={setBucketFilter}>
                      <SelectTrigger className="w-[140px] h-8 text-sm">
                        <SelectValue placeholder="All Buckets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Buckets</SelectItem>
                        {AGING_BUCKETS.map((bucket) => (
                          <SelectItem key={bucket.key} value={bucket.key}>
                            {bucket.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={personaFilter} onValueChange={setPersonaFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-sm">
                        <SelectValue placeholder="All Personas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Personas</SelectItem>
                        {personaList.map(([key, persona]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: persona.color }}
                              />
                              {persona.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[120px] h-8 text-sm">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>

                    {(bucketFilter !== "all" || personaFilter !== "all" || statusFilter !== "all") && (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer h-8 flex items-center" 
                        onClick={() => {
                          setBucketFilter("all");
                          setPersonaFilter("all");
                          setStatusFilter("all");
                        }}
                      >
                        Clear
                      </Badge>
                    )}
                  </div>
                  
                  <span className="text-sm text-muted-foreground sm:ml-auto">
                    {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Invoices by Aging Bucket */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : invoicesByBucket.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {filteredInvoices.length === 0 && invoicesData?.length ? "No invoices match your filters" : "No open invoices found"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {invoicesByBucket.map((bucket) => (
                  <Card key={bucket.key}>
                    <CardHeader className="py-3 px-4 border-b">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                          {bucket.persona ? (
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={bucket.persona.avatar} alt={bucket.persona.name} />
                              <AvatarFallback style={{ backgroundColor: bucket.persona.color }}>
                                {bucket.persona.name[0]}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                          )}
                          <span>{bucket.label}</span>
                          {bucket.persona && (
                            <span className="text-sm font-normal text-muted-foreground">
                              ({bucket.persona.name})
                            </span>
                          )}
                          <Badge variant="secondary">{bucket.count}</Badge>
                        </CardTitle>
                        <span className="text-sm font-medium text-muted-foreground">
                          ${bucket.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {bucket.stepGroups.map(([stepLabel, invoices]) => (
                        <div key={stepLabel}>
                          {/* Step subheader */}
                          <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{stepLabel}</span>
                            <Badge variant="outline" className="text-xs">{invoices.length}</Badge>
                          </div>
                          
                          {/* Desktop Headers - Hidden on Mobile */}
                          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                            <div className="col-span-3">Account / Invoice</div>
                            <div className="col-span-2 text-right">Amount</div>
                            <div className="col-span-2">Due Date</div>
                            <div className="col-span-2">Last Outreach</div>
                            <div className="col-span-3 text-right">Next Outreach</div>
                          </div>
                          
                          <div className="divide-y">
                            {invoices.map((invoice) => {
                              const draftInfo = nextDrafts?.[invoice.id];
                              const historyInfo = outreachHistory?.[invoice.id];
                              const historyCount = historyInfo?.count || 0;
                              const lastSentAt = historyInfo?.lastSentAt;
                              const nextDate = draftInfo?.date ? formatDate(draftInfo.date) : null;
                              const daysPastDue = getDaysPastDue(invoice.due_date);
                              const invoiceAmount = invoice.amount || 0;
                              const isPaused = invoice.outreach_paused || invoice.debtors?.outreach_paused;
                              const isAccountPaused = invoice.debtors?.outreach_paused;
                              const riskScore = invoice.debtors?.collections_risk_score;

                              return (
                                <div key={invoice.id}>
                                  {/* Desktop View */}
                                  <div
                                    className={`hidden md:grid grid-cols-12 gap-2 items-center p-3 px-4 hover:bg-muted/50 transition-colors ${isPaused ? "opacity-60" : ""}`}
                                  >
                                    <div 
                                      className="col-span-3 min-w-0 cursor-pointer"
                                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium truncate text-sm">
                                          {invoice.debtors?.company_name || invoice.debtors?.name}
                                        </p>
                                        {isPaused && (
                                          <Badge variant="outline" className="text-[10px] gap-0.5 text-orange-600 border-orange-300 shrink-0">
                                            <PauseCircle className="h-2.5 w-2.5" />
                                            {isAccountPaused ? "Acct" : "Inv"}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {invoice.invoice_number}
                                      </p>
                                    </div>

                                    <div className="col-span-2 text-right">
                                      <span className="text-sm font-medium">
                                        ${invoiceAmount?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </span>
                                    </div>

                                    <div className="col-span-2">
                                      <span className="text-xs">{format(new Date(invoice.due_date), "MMM d")}</span>
                                      {daysPastDue > 0 && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <span className={`text-xs font-medium ${daysPastDue > 60 ? 'text-destructive' : daysPastDue > 30 ? 'text-orange-500' : 'text-yellow-500'}`}>
                                            {daysPastDue}d overdue
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="col-span-2">
                                      {lastSentAt ? (
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-muted-foreground">
                                            {format(new Date(lastSentAt), "MMM d")}
                                          </span>
                                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                            {historyCount}
                                          </Badge>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </div>

                                    <div className="col-span-3 flex items-center justify-end gap-2">
                                      {!isPaused && nextDate ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm text-primary font-medium">{nextDate}</span>
                                          <Badge 
                                            variant={draftInfo?.status === "approved" ? "default" : "outline"} 
                                            className="text-[10px]"
                                          >
                                            {draftInfo?.status === "approved" ? "Ready" : "Pending"}
                                          </Badge>
                                        </div>
                                      ) : !isPaused ? (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      ) : null}
                                      
                                      {!isAccountPaused && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleInvoicePause.mutate({ 
                                              invoiceId: invoice.id, 
                                              paused: !invoice.outreach_paused 
                                            });
                                          }}
                                          className="p-1 rounded hover:bg-muted"
                                        >
                                          {invoice.outreach_paused ? (
                                            <PlayCircle className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <PauseCircle className="h-4 w-4 text-muted-foreground hover:text-orange-600" />
                                          )}
                                        </button>
                                      )}
                                      
                                      <ChevronRight 
                                        className="h-4 w-4 text-muted-foreground cursor-pointer" 
                                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                                      />
                                    </div>
                                  </div>

                                  {/* Mobile View - Card Layout */}
                                  <div
                                    className={`md:hidden p-4 hover:bg-muted/50 transition-colors ${isPaused ? "opacity-60" : ""}`}
                                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm truncate">
                                          {invoice.debtors?.company_name || invoice.debtors?.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          #{invoice.invoice_number}
                                        </p>
                                      </div>
                                      <div className="text-right ml-3">
                                        <p className="font-semibold">
                                          ${invoiceAmount?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </p>
                                        {daysPastDue > 0 && (
                                          <span className={`text-xs font-medium ${daysPastDue > 60 ? 'text-destructive' : daysPastDue > 30 ? 'text-orange-500' : 'text-yellow-500'}`}>
                                            {daysPastDue}d overdue
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      {isPaused && (
                                        <Badge variant="outline" className="text-[10px] gap-0.5 text-orange-600 border-orange-300">
                                          <PauseCircle className="h-2.5 w-2.5" />
                                          {isAccountPaused ? "Account Paused" : "Paused"}
                                        </Badge>
                                      )}
                                      {!isPaused && nextDate && (
                                        <Badge variant={draftInfo?.status === "approved" ? "default" : "outline"} className="text-[10px]">
                                          Next: {nextDate}
                                        </Badge>
                                      )}
                                      {lastSentAt && (
                                        <span>Last: {format(new Date(lastSentAt), "MMM d")}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Drafts Tab Content */}
          <TabsContent value="drafts" className="mt-4 space-y-4">
            {pendingDraftsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !pendingDrafts || pendingDrafts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No pending drafts to review</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate drafts from AI Workflows to see them here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Bulk Actions Bar */}
                <Card className="border-primary/20 bg-muted/30">
                  <CardContent className="py-3 px-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="select-all-drafts"
                          checked={selectedDraftIds.size === pendingDrafts.length && pendingDrafts.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDraftIds(new Set(pendingDrafts.map((d: any) => d.id)));
                            } else {
                              setSelectedDraftIds(new Set());
                            }
                          }}
                        />
                        <label htmlFor="select-all-drafts" className="text-sm font-medium cursor-pointer">
                          {selectedDraftIds.size > 0 
                            ? `${selectedDraftIds.size} selected`
                            : "Select all"
                          }
                        </label>
                      </div>
                      
                      {selectedDraftIds.size > 0 && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => bulkApproveDrafts.mutate(Array.from(selectedDraftIds))}
                            disabled={bulkApproveDrafts.isPending}
                            className="gap-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve ({selectedDraftIds.size})
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => bulkRejectDrafts.mutate(Array.from(selectedDraftIds))}
                            disabled={bulkRejectDrafts.isPending}
                            className="gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete ({selectedDraftIds.size})
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Draft Cards */}
                {pendingDrafts.map((draft: any) => {
                  const isSelected = selectedDraftIds.has(draft.id);
                  return (
                    <Card 
                      key={draft.id} 
                      className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedDraftIds);
                              if (checked) {
                                newSet.add(draft.id);
                              } else {
                                newSet.delete(draft.id);
                              }
                              setSelectedDraftIds(newSet);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => navigate(`/invoices/${draft.invoice_id}`)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge variant={draft.status === "approved" ? "default" : "outline"} className="text-xs">
                                    {draft.status === "approved" ? "Approved" : "Pending Review"}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {draft.collection_workflow_steps?.label || `Step ${draft.step_number}`}
                                  </Badge>
                                </div>
                                <p className="font-medium text-sm truncate">
                                  {draft.subject || "No subject"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {draft.invoices?.debtors?.company_name || "Unknown"} • #{draft.invoices?.invoice_number}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  {draft.recommended_send_date && (
                                    <p className="text-sm text-primary font-medium">
                                      {formatDate(draft.recommended_send_date)}
                                    </p>
                                  )}
                                  {draft.invoices?.amount && (
                                    <p className="text-xs text-muted-foreground">
                                      ${draft.invoices.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                  )}
                                </div>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Outreach;
