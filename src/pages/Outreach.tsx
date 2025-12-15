import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Brain, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const AGING_BUCKETS = [
  { key: "current", label: "Current", color: "bg-green-500" },
  { key: "dpd_1_30", label: "1-30 Days", color: "bg-yellow-500" },
  { key: "dpd_31_60", label: "31-60 Days", color: "bg-orange-500" },
  { key: "dpd_61_90", label: "61-90 Days", color: "bg-red-400" },
  { key: "dpd_91_120", label: "91-120 Days", color: "bg-red-500" },
  { key: "dpd_121_150", label: "121-150 Days", color: "bg-red-600" },
  { key: "dpd_150_plus", label: "150+ Days", color: "bg-red-700" },
];

const Outreach = () => {
  const navigate = useNavigate();

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

  // Fetch next scheduled draft per invoice
  const { data: nextDrafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["next-drafts-per-invoice"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data, error } = await supabase
        .from("ai_drafts")
        .select("invoice_id, recommended_send_date, status, step_number")
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true });

      if (error) throw error;

      // Get the earliest draft per invoice
      const nextPerInvoice: Record<string, { date: string; status: string; step: number }> = {};
      (data || []).forEach((draft) => {
        if (draft.invoice_id && !nextPerInvoice[draft.invoice_id]) {
          nextPerInvoice[draft.invoice_id] = {
            date: draft.recommended_send_date || "",
            status: draft.status || "",
            step: draft.step_number,
          };
        }
      });
      return nextPerInvoice;
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

      const counts: Record<string, number> = {};
      (data || []).forEach((activity) => {
        if (activity.invoice_id) {
          counts[activity.invoice_id] = (counts[activity.invoice_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Group invoices by aging bucket
  const invoicesByBucket = AGING_BUCKETS.map((bucket) => {
    const invoices = invoicesData?.filter((inv) => inv.aging_bucket === bucket.key) || [];
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    return {
      ...bucket,
      invoices,
      totalAmount,
      count: invoices.length,
    };
  }).filter((bucket) => bucket.count > 0);

  const isLoading = invoicesLoading || draftsLoading || historyLoading;

  const formatNextOutreach = (invoiceId: string) => {
    const draft = nextDrafts?.[invoiceId];
    if (!draft?.date) return null;
    
    const date = new Date(draft.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return format(date, "EEEE");
    return format(date, "MMM d");
  };

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
              <p className="text-muted-foreground">No open invoices found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {invoicesByBucket.map((bucket) => (
              <Card key={bucket.key}>
                <CardHeader className="py-3 px-4 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                      {bucket.label}
                      <Badge variant="secondary">{bucket.count} invoices</Badge>
                    </CardTitle>
                    <span className="text-sm font-medium text-muted-foreground">
                      ${bucket.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {bucket.invoices.map((invoice) => {
                      const nextOutreach = formatNextOutreach(invoice.id);
                      const historyCount = outreachHistory?.[invoice.id] || 0;
                      const draftInfo = nextDrafts?.[invoice.id];

                      return (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {invoice.debtors?.company_name || invoice.debtors?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.invoice_number} • ${invoice.amount?.toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Next Outreach */}
                            {nextOutreach ? (
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Next Outreach</p>
                                <div className="flex items-center gap-1 justify-end">
                                  <Clock className="h-3 w-3 text-primary" />
                                  <span className="text-sm font-medium text-primary">{nextOutreach}</span>
                                  {draftInfo && (
                                    <Badge 
                                      variant={draftInfo.status === "approved" ? "default" : "outline"} 
                                      className="text-xs ml-1"
                                    >
                                      Step {draftInfo.step}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Next Outreach</p>
                                <span className="text-sm text-muted-foreground">Not scheduled</span>
                              </div>
                            )}
                            
                            {/* Sent count */}
                            {historyCount > 0 && (
                              <Badge variant="secondary" className="gap-1">
                                <Mail className="h-3 w-3" />
                                {historyCount}
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
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Outreach;
