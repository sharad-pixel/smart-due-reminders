import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Clock, CheckCircle2, AlertCircle, Calendar, ExternalLink, AlertTriangle } from "lucide-react";
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

interface AggregatedError {
  errorMessage: string;
  count: number;
  status: string;
  latestDate: string;
  agentName: string;
  recipientEmail: string;
}

export function OutreachTimeline({ invoiceId, invoiceDueDate, agingBucket }: OutreachTimelineProps) {
  const navigate = useNavigate();
  
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

      // Aggregate and count logs
      const successLogs = (logs || []).filter(log => log.status === 'sent' || log.status === 'delivered');
      const failedLogs = (logs || []).filter(log => log.status !== 'sent' && log.status !== 'delivered');
      
      // Aggregate failed logs by error message
      const errorAggregation: Record<string, AggregatedError> = {};
      failedLogs.forEach((log: any) => {
        const key = `${log.status}-${log.error_message || 'Unknown error'}`;
        if (!errorAggregation[key]) {
          errorAggregation[key] = {
            errorMessage: log.error_message || 'Unknown error',
            count: 0,
            status: log.status,
            latestDate: log.sent_at,
            agentName: log.agent_name,
            recipientEmail: log.recipient_email
          };
        }
        errorAggregation[key].count++;
        if (new Date(log.sent_at) > new Date(errorAggregation[key].latestDate)) {
          errorAggregation[key].latestDate = log.sent_at;
        }
      });

      return {
        outreach,
        successLogs,
        aggregatedErrors: Object.values(errorAggregation),
        totalFailed: failedLogs.length,
        totalBounced: failedLogs.filter((l: any) => l.status === 'bounced').length,
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

  const { outreach, successLogs, aggregatedErrors, totalFailed, totalBounced, daysPastDue, currentAgent, nextEmail } = data || {};

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

        {/* Failed Emails Summary - Aggregated */}
        {aggregatedErrors && aggregatedErrors.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-sm font-medium">Failed Emails</h4>
                <Badge variant="destructive" className="text-xs">
                  {totalFailed} total {totalBounced && totalBounced > 0 ? `(${totalBounced} bounced)` : ''}
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7"
                onClick={() => navigate('/reports/email-delivery')}
              >
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {aggregatedErrors.slice(0, 3).map((error, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-xs">
                        {error.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {error.count} occurrence{error.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-destructive mt-1 line-clamp-2">
                      {error.errorMessage}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last: {format(new Date(error.latestDate), 'MMM d, h:mm a')} • {error.recipientEmail}
                    </p>
                  </div>
                </div>
              ))}
              
              {aggregatedErrors.length > 3 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => navigate('/reports/email-delivery')}
                >
                  View {aggregatedErrors.length - 3} more error types
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Successful Email History */}
        {successLogs && successLogs.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Sent Emails
              <Badge variant="secondary" className="text-xs">{successLogs.length}</Badge>
            </h4>
            <div className="space-y-3">
              {successLogs.slice(0, 5).map((log: any) => {
                const agent = AGENT_MAP[log.aging_bucket];
                return (
                  <div 
                    key={log.id}
                    className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {agent && <PersonaAvatar persona={agent.key} size="xs" />}
                        <span className="font-medium text-sm">{log.agent_name}</span>
                        <Badge variant="outline" className="text-xs">
                          Step {log.step_number}
                        </Badge>
                        <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{log.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.sent_at), 'MMM d, yyyy h:mm a')} • {log.recipient_email}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {successLogs.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{successLogs.length - 5} more emails sent
                </p>
              )}
            </div>
          </div>
        )}

        {(!successLogs || successLogs.length === 0) && (!aggregatedErrors || aggregatedErrors.length === 0) && outreach?.is_active && (
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