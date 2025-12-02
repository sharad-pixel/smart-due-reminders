import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface InvoiceContextPreviewProps {
  debtorId: string;
  invoiceId?: string;
}

interface RcaRecord {
  id: string;
  contract_name: string | null;
  mrr: number | null;
  arr: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  renewal_date: string | null;
  risk_category: string | null;
  health_score: string | null;
  account_owner: string | null;
  csm_name: string | null;
  contract_status: string | null;
}

interface CsCase {
  id: string;
  subject: string;
  status: string | null;
  priority: string | null;
  opened_at: string | null;
}

export const InvoiceContextPreview = ({ debtorId, invoiceId }: InvoiceContextPreviewProps) => {
  const { data: rcaData, isLoading: rcaLoading } = useQuery({
    queryKey: ["rca-records", debtorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rca_records")
        .select("*")
        .eq("debtor_id", debtorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as RcaRecord | null;
    },
  });

  const { data: recentCases, isLoading: casesLoading } = useQuery({
    queryKey: ["cs-cases-preview", debtorId, invoiceId],
    queryFn: async () => {
      let query = supabase
        .from("cs_cases")
        .select("id, subject, status, priority, opened_at")
        .eq("debtor_id", debtorId)
        .order("opened_at", { ascending: false })
        .limit(3);

      if (invoiceId) {
        query = query.or(`invoice_id.eq.${invoiceId},invoice_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CsCase[];
    },
  });

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getHealthColor = (health: string | null) => {
    switch (health?.toLowerCase()) {
      case "good":
      case "healthy":
        return "text-green-600";
      case "at risk":
      case "atrisk":
        return "text-amber-600";
      case "poor":
      case "unhealthy":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isLoading = rcaLoading || casesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Context Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasContext = rcaData || (recentCases && recentCases.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Context Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContext ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No RCA or case context available for this invoice.
          </p>
        ) : (
          <>
            {/* RCA Contract Info */}
            {rcaData && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Revenue Account</span>
                  {rcaData.risk_category && (
                    <Badge variant={getRiskColor(rcaData.risk_category)} className="ml-auto text-xs">
                      {rcaData.risk_category} risk
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {rcaData.contract_name && (
                    <div>
                      <span className="text-muted-foreground">Contract:</span>{" "}
                      <span className="font-medium">{rcaData.contract_name}</span>
                    </div>
                  )}
                  {rcaData.mrr && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">MRR:</span>{" "}
                      <span className="font-medium">{formatCurrency(rcaData.mrr)}</span>
                    </div>
                  )}
                  {rcaData.arr && (
                    <div>
                      <span className="text-muted-foreground">ARR:</span>{" "}
                      <span className="font-medium">{formatCurrency(rcaData.arr)}</span>
                    </div>
                  )}
                  {rcaData.health_score && (
                    <div>
                      <span className="text-muted-foreground">Health:</span>{" "}
                      <span className={`font-medium ${getHealthColor(rcaData.health_score)}`}>
                        {rcaData.health_score}
                      </span>
                    </div>
                  )}
                  {rcaData.renewal_date && (
                    <div>
                      <span className="text-muted-foreground">Renewal:</span>{" "}
                      <span className="font-medium">
                        {format(new Date(rcaData.renewal_date), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  {rcaData.csm_name && (
                    <div>
                      <span className="text-muted-foreground">CSM:</span>{" "}
                      <span className="font-medium">{rcaData.csm_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent CS Cases */}
            {recentCases && recentCases.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">Recent Cases</span>
                </div>
                {recentCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="p-2 border rounded bg-muted/20 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate flex-1">
                        {caseItem.subject}
                      </span>
                      <div className="flex items-center gap-1">
                        {caseItem.priority && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            {caseItem.priority}
                          </Badge>
                        )}
                        {caseItem.status && (
                          <Badge
                            variant={caseItem.status === "open" ? "default" : "secondary"}
                            className="text-[10px] px-1"
                          >
                            {caseItem.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {caseItem.opened_at && (
                      <span className="text-muted-foreground">
                        {format(new Date(caseItem.opened_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
