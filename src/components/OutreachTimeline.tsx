import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonaAvatar } from "./PersonaAvatar";

interface OutreachTimelineProps {
  invoiceId: string;
  invoiceDueDate: string;
  agingBucket: string | null;
}

const AGENT_MAP: Record<string, { name: string; key: string }> = {
  'dpd_1_30': { name: 'Sam', key: 'sam' },
  'dpd_31_60': { name: 'James', key: 'james' },
  'dpd_61_90': { name: 'Katy', key: 'katy' },
  'dpd_91_120': { name: 'Jimmy', key: 'jimmy' },
  'dpd_121_150': { name: 'Troy', key: 'troy' },
  'dpd_150_plus': { name: 'Rocco', key: 'rocco' },
};

function getBucketForDays(daysPastDue: number): string {
  if (daysPastDue >= 1 && daysPastDue <= 30) return 'dpd_1_30';
  if (daysPastDue >= 31 && daysPastDue <= 60) return 'dpd_31_60';
  if (daysPastDue >= 61 && daysPastDue <= 90) return 'dpd_61_90';
  if (daysPastDue >= 91 && daysPastDue <= 120) return 'dpd_91_120';
  if (daysPastDue >= 121 && daysPastDue <= 150) return 'dpd_121_150';
  return 'dpd_150_plus';
}

export function OutreachTimeline({ invoiceId, invoiceDueDate, agingBucket }: OutreachTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["outreach-timeline-v2", invoiceId],
    staleTime: 30_000,
    queryFn: async () => {
      // Get outreach tracking record
      const { data: outreach } = await supabase
        .from("invoice_outreach")
        .select("*")
        .eq("invoice_id", invoiceId)
        .maybeSingle();

      // Get all outreach logs for this invoice (using new table)
      const { data: logs } = await supabase
        .from("outreach_log")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sent_at", { ascending: false });

      // Calculate days past due
      const today = new Date();
      const due = new Date(invoiceDueDate);
      const daysPastDue = differenceInDays(today, due);
      const currentBucket = daysPastDue > 0 ? getBucketForDays(daysPastDue) : null;
      const currentAgent = currentBucket ? AGENT_MAP[currentBucket] : null;

      // Calculate next email if outreach is active
      let nextEmail = null;
      if (outreach?.is_active && currentBucket) {
        const bucketEntered = new Date(outreach.bucket_entered_at);
        const daysInBucket = differenceInDays(today, bucketEntered);
        
        if (!outreach.step_1_sent_at) {
          nextEmail = { step: 1, day: 0, daysUntil: Math.max(0, -daysInBucket) };
        } else if (!outreach.step_2_sent_at) {
          nextEmail = { step: 2, day: 7, daysUntil: Math.max(0, 7 - daysInBucket) };
        } else if (!outreach.step_3_sent_at) {
          nextEmail = { step: 3, day: 14, daysUntil: Math.max(0, 14 - daysInBucket) };
        }
      }

      return {
        outreach,
        logs: logs || [],
        daysPastDue,
        currentBucket,
        currentAgent,
        nextEmail,
      };
    },
    enabled: !!invoiceId && !!invoiceDueDate,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Outreach History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { outreach, logs, daysPastDue, currentAgent, nextEmail } = data || {};

  // Not past due yet
  if (!daysPastDue || daysPastDue <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Outreach History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Invoice not yet past due</p>
            <p className="text-sm">Automated outreach begins 1 day after the due date</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBucketLabel = (bucket: string) => {
    switch (bucket) {
      case 'dpd_1_30': return '1-30 Days';
      case 'dpd_31_60': return '31-60 Days';
      case 'dpd_61_90': return '61-90 Days';
      case 'dpd_91_120': return '91-120 Days';
      case 'dpd_121_150': return '121-150 Days';
      case 'dpd_150_plus': return '150+ Days';
      default: return bucket;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Outreach History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Agent</span>
            {currentAgent && (
              <div className="flex items-center gap-2">
                <PersonaAvatar persona={currentAgent.key} size="xs" />
                <span className="font-medium">{currentAgent.name}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Days Past Due</span>
            <Badge variant={daysPastDue > 90 ? "destructive" : daysPastDue > 30 ? "secondary" : "outline"}>
              {daysPastDue} days
            </Badge>
          </div>
          
          {nextEmail && outreach?.is_active && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Next Email</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">
                  Step {nextEmail.step} {nextEmail.daysUntil === 0 ? '(Today)' : `(in ${nextEmail.daysUntil} days)`}
                </span>
              </div>
            </div>
          )}
          
          {outreach && !outreach.is_active && outreach.completed_at && (
            <div className="flex items-center gap-2 text-green-600 pt-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Outreach completed - Invoice settled</span>
            </div>
          )}
          
          {!outreach && daysPastDue > 0 && (
            <div className="flex items-center gap-2 text-amber-600 pt-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Outreach will start on next scheduled run (9 AM UTC)</span>
            </div>
          )}
        </div>

        {/* Email History */}
        {logs && logs.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Email History</h4>
            <div className="space-y-3">
              {logs.map((log: any) => {
                const agent = AGENT_MAP[log.aging_bucket];
                return (
                  <div 
                    key={log.id}
                    className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {log.status === 'sent' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {agent && <PersonaAvatar persona={agent.key} size="xs" />}
                        <span className="font-medium text-sm">{log.agent_name}</span>
                        <Badge variant="outline" className="text-xs">
                          Step {log.step_number}
                        </Badge>
                        <Badge 
                          variant={log.status === 'sent' ? 'default' : 'destructive'} 
                          className="text-xs"
                        >
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{log.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.sent_at), 'MMM d, yyyy h:mm a')} • {log.recipient_email}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-destructive mt-1">
                          Error: {log.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(!logs || logs.length === 0) && outreach?.is_active && (
          <div className="text-center py-4 text-muted-foreground text-sm border-t">
            <Mail className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No emails sent yet</p>
            <p className="text-xs">First email will be sent on Day 0 of the aging bucket</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
