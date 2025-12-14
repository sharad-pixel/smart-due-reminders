import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isThisWeek, addDays } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Mail, Clock, TrendingUp, FileText, Users, Brain, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const AGING_BUCKETS = [
  { key: "current", label: "Current", color: "bg-green-500" },
  { key: "dpd_1_30", label: "1-30 Days", color: "bg-yellow-500" },
  { key: "dpd_31_60", label: "31-60 Days", color: "bg-orange-500" },
  { key: "dpd_61_90", label: "61-90 Days", color: "bg-red-400" },
  { key: "dpd_91_120", label: "91-120 Days", color: "bg-red-500" },
  { key: "dpd_121_plus", label: "121+ Days", color: "bg-red-700" },
];

const Outreach = () => {
  const navigate = useNavigate();
  const [selectedBucket, setSelectedBucket] = useState<string>("all");

  // Fetch invoices with outreach data
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["outreach-invoices"],
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
          last_contact_date,
          debtor_id,
          debtors (
            id,
            name,
            company_name
          )
        `)
        .in("status", ["Open", "InPaymentPlan"])
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch scheduled drafts (upcoming outreach)
  const { data: scheduledDrafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["scheduled-drafts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id,
          invoice_id,
          subject,
          channel,
          status,
          recommended_send_date,
          step_number,
          invoices (
            id,
            invoice_number,
            aging_bucket,
            debtors (
              name,
              company_name
            )
          )
        `)
        .in("status", ["pending_approval", "approved"])
        .gte("recommended_send_date", today)
        .order("recommended_send_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch outreach history counts per invoice
  const { data: outreachHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["outreach-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data, error } = await supabase
        .from("collection_activities")
        .select("invoice_id")
        .eq("direction", "outbound")
        .not("invoice_id", "is", null);

      if (error) throw error;

      // Count per invoice
      const counts: Record<string, number> = {};
      (data || []).forEach((activity) => {
        if (activity.invoice_id) {
          counts[activity.invoice_id] = (counts[activity.invoice_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Calculate bucket summaries
  const bucketSummaries = AGING_BUCKETS.map((bucket) => {
    const bucketInvoices = invoicesData?.filter((inv) => inv.aging_bucket === bucket.key) || [];
    const totalAmount = bucketInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const withOutreach = bucketInvoices.filter((inv) => outreachHistory?.[inv.id]).length;
    const scheduled = scheduledDrafts?.filter(
      (d) => d.invoices?.aging_bucket === bucket.key
    ).length || 0;

    return {
      ...bucket,
      count: bucketInvoices.length,
      totalAmount,
      withOutreach,
      scheduled,
    };
  });

  // Filter invoices by bucket
  const filteredInvoices = selectedBucket === "all"
    ? invoicesData
    : invoicesData?.filter((inv) => inv.aging_bucket === selectedBucket);

  // Group scheduled drafts by date
  const groupedDrafts = scheduledDrafts?.reduce((acc, draft) => {
    const date = draft.recommended_send_date || "unscheduled";
    if (!acc[date]) acc[date] = [];
    acc[date].push(draft);
    return acc;
  }, {} as Record<string, typeof scheduledDrafts>) || {};

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isThisWeek(date)) return format(date, "EEEE");
    return format(date, "MMM d, yyyy");
  };

  const isLoading = invoicesLoading || draftsLoading || historyLoading;

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
            Manage scheduled outreach, track communication history, and monitor collection activities by aging bucket.
          </p>
        </div>

        {/* Bucket Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {bucketSummaries.map((bucket) => (
            <Card
              key={bucket.key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedBucket === bucket.key ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedBucket(bucket.key === selectedBucket ? "all" : bucket.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                  <Badge variant="secondary" className="text-xs">
                    {bucket.count}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{bucket.label}</p>
                <p className="text-lg font-bold">
                  ${bucket.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span>{bucket.withOutreach} contacted</span>
                </div>
                {bucket.scheduled > 0 && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-primary">
                    <Clock className="h-3 w-3" />
                    <span>{bucket.scheduled} scheduled</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="scheduled" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scheduled" className="gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Outreach
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              All Invoices
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Outreach Tab */}
          <TabsContent value="scheduled" className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : Object.keys(groupedDrafts).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming outreach scheduled</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable auto-generate drafts in AI Workflows to schedule outreach
                  </p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedDrafts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, drafts]) => (
                  <Card key={date}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          {getDateLabel(date)}
                          <span className="text-xs text-muted-foreground">
                            ({format(new Date(date), "MMM d, yyyy")})
                          </span>
                        </CardTitle>
                        <Badge variant="outline">{drafts?.length} messages</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="space-y-2">
                        {drafts?.map((draft) => {
                          const bucketInfo = AGING_BUCKETS.find(
                            (b) => b.key === draft.invoices?.aging_bucket
                          );
                          return (
                            <div
                              key={draft.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer"
                              onClick={() => navigate(`/invoices/${draft.invoice_id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-8 rounded-full ${bucketInfo?.color || "bg-gray-300"}`} />
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {draft.invoices?.debtors?.company_name || draft.invoices?.debtors?.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {draft.invoices?.invoice_number} • Step {draft.step_number} • {bucketInfo?.label || "Unknown"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={draft.status === "approved" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {draft.status === "approved" ? "Ready to Send" : "Pending Review"}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>

          {/* All Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {filteredInvoices?.map((invoice) => {
                      const historyCount = outreachHistory?.[invoice.id] || 0;
                      const bucketInfo = AGING_BUCKETS.find((b) => b.key === invoice.aging_bucket);
                      const scheduledCount = scheduledDrafts?.filter(
                        (d) => d.invoice_id === invoice.id
                      ).length || 0;

                      return (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-2 h-8 rounded-full ${bucketInfo?.color || "bg-gray-300"}`} />
                            <div>
                              <p className="font-medium">
                                {invoice.debtors?.company_name || invoice.debtors?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {invoice.invoice_number} • ${invoice.amount?.toLocaleString()} • {bucketInfo?.label}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {scheduledCount > 0 && (
                              <Badge variant="outline" className="gap-1 text-primary border-primary">
                                <Clock className="h-3 w-3" />
                                {scheduledCount} scheduled
                              </Badge>
                            )}
                            {historyCount > 0 && (
                              <Badge variant="secondary" className="gap-1">
                                <Mail className="h-3 w-3" />
                                {historyCount} sent
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Outreach;
