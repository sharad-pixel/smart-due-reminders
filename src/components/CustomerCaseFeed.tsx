import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headphones, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerCaseFeedProps {
  debtorId: string;
}

interface CsCase {
  id: string;
  case_number: string | null;
  subject: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  case_type: string | null;
  source_system: string | null;
  assigned_to: string | null;
  opened_at: string | null;
  closed_at: string | null;
  resolution: string | null;
}

export const CustomerCaseFeed = ({ debtorId }: CustomerCaseFeedProps) => {
  const { data: cases, isLoading } = useQuery({
    queryKey: ["cs-cases", debtorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cs_cases")
        .select("*")
        .eq("debtor_id", debtorId)
        .order("opened_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as CsCase[];
    },
  });

  const getStatusIcon = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "open":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "closed":
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case "high":
      case "urgent":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="h-5 w-5" />
            Customer Case Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Headphones className="h-5 w-5" />
          Customer Case Feed
          {cases && cases.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {cases.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!cases || cases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No customer cases found for this debtor.
          </p>
        ) : (
          <div className="space-y-3">
            {cases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(caseItem.status)}
                    <span className="font-medium text-sm">
                      {caseItem.case_number || "Case"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {caseItem.priority && (
                      <Badge variant={getPriorityColor(caseItem.priority)} className="text-xs">
                        {caseItem.priority}
                      </Badge>
                    )}
                    {caseItem.status && (
                      <Badge variant="outline" className="text-xs">
                        {caseItem.status}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium mb-1">{caseItem.subject}</p>
                {caseItem.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {caseItem.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {caseItem.source_system && (
                    <span>Source: {caseItem.source_system}</span>
                  )}
                  {caseItem.assigned_to && (
                    <span>Assigned: {caseItem.assigned_to}</span>
                  )}
                  {caseItem.opened_at && (
                    <span>
                      Opened: {format(new Date(caseItem.opened_at), "MMM d, yyyy")}
                    </span>
                  )}
                  {caseItem.closed_at && (
                    <span>
                      Closed: {format(new Date(caseItem.closed_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                {caseItem.resolution && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Resolution:</span> {caseItem.resolution}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
