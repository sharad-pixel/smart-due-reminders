import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Clock, CheckCircle2, AlertCircle, Calendar, ExternalLink, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonaAvatar } from "./PersonaAvatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [failedOpen, setFailedOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(true);
  
  const { data, isLoading } = useQuery({
    queryKey: ["outreach-timeline-v2", invoiceId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: outreach } = await supabase
        .from("invoice_outreach")
        .select("*")
        .eq("invoice_id", invoiceId)
        .maybeSingle();

      const { data: logs } = await supabase
        .from("outreach_log")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sent_at", { ascending: false });

      const today = new Date();
      const due = new Date(invoiceDueDate);
      const daysPastDue = differenceInDays(today, due);
      const currentBucket = daysPastDue > 0 ? getBucketForDays(daysPastDue) : null;
      const currentAgent = currentBucket ? AGENT_MAP[currentBucket] : null;

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

      const successLogs = (logs || []).filter(log => log.status === 'sent' || log.status === 'delivered');
      const failedLogs = (logs || []).filter(log => log.status !== 'sent' && log.status !== 'delivered');
      
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Outreach History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Status - Compact Table */}
        <Table>
          <TableBody>
            <TableRow className="hover:bg-transparent border-0">
              <TableCell className="py-2 pl-0 text-muted-foreground font-medium w-1/3">Current Agent</TableCell>
              <TableCell className="py-2 pr-0 text-right">
                {currentAgent && (
                  <div className="flex items-center justify-end gap-2">
                    <PersonaAvatar persona={currentAgent.key} size="xs" />
                    <span className="font-medium">{currentAgent.name}</span>
                  </div>
                )}
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-transparent border-0">
              <TableCell className="py-2 pl-0 text-muted-foreground font-medium">Days Past Due</TableCell>
              <TableCell className="py-2 pr-0 text-right">
                <Badge variant={daysPastDue > 90 ? "destructive" : daysPastDue > 30 ? "secondary" : "outline"}>
                  {daysPastDue} days
                </Badge>
              </TableCell>
            </TableRow>
            {nextEmail && outreach?.is_active && (
              <TableRow className="hover:bg-transparent border-0">
                <TableCell className="py-2 pl-0 text-muted-foreground font-medium">Next Email</TableCell>
                <TableCell className="py-2 pr-0 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      Step {nextEmail.step} {nextEmail.daysUntil === 0 ? '(Today)' : `(in ${nextEmail.daysUntil} days)`}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {outreach && !outreach.is_active && outreach.completed_at && (
              <TableRow className="hover:bg-transparent border-0">
                <TableCell colSpan={2} className="py-2 px-0">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Outreach completed - Invoice settled</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!outreach && daysPastDue > 0 && (
              <TableRow className="hover:bg-transparent border-0">
                <TableCell colSpan={2} className="py-2 px-0">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Outreach starts at 9 AM UTC</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Failed Emails - Collapsible */}
        {aggregatedErrors && aggregatedErrors.length > 0 && (
          <Collapsible open={failedOpen} onOpenChange={setFailedOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors">
                <div className="flex items-center gap-2">
                  {failedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-sm">Failed Emails</span>
                  <Badge variant="destructive" className="text-xs">
                    {totalFailed} total
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-6 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/reports/email-delivery');
                  }}
                >
                  View All
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Error</TableHead>
                      <TableHead className="text-xs text-right">Count</TableHead>
                      <TableHead className="text-xs text-right">Last Attempt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedErrors.map((error, index) => (
                      <TableRow key={index}>
                        <TableCell className="py-2">
                          <Badge variant="destructive" className="text-xs">
                            {error.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 max-w-[200px]">
                          <p className="text-xs text-destructive truncate" title={error.errorMessage}>
                            {error.errorMessage}
                          </p>
                          <p className="text-xs text-muted-foreground">{error.recipientEmail}</p>
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs text-muted-foreground">
                          {error.count}x
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(error.latestDate), 'MMM d, h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Sent Emails - Collapsible */}
        {successLogs && successLogs.length > 0 && (
          <Collapsible open={sentOpen} onOpenChange={setSentOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors">
                <div className="flex items-center gap-2">
                  {sentOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Sent Emails</span>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {successLogs.length}
                  </Badge>
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Agent</TableHead>
                      <TableHead className="text-xs">Subject</TableHead>
                      <TableHead className="text-xs text-right">Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {successLogs.map((log: any) => {
                      const agent = AGENT_MAP[log.aging_bucket];
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              {agent && <PersonaAvatar persona={agent.key} size="xs" />}
                              <div>
                                <span className="text-sm font-medium">{log.agent_name}</span>
                                <Badge variant="outline" className="text-xs ml-2">
                                  Step {log.step_number}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 max-w-[200px]">
                            <p className="text-sm truncate" title={log.subject}>{log.subject}</p>
                            <p className="text-xs text-muted-foreground">{log.recipient_email}</p>
                          </TableCell>
                          <TableCell className="py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.sent_at), 'MMM d, h:mm a')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {(!successLogs || successLogs.length === 0) && (!aggregatedErrors || aggregatedErrors.length === 0) && outreach?.is_active && (
          <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
            <Mail className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No emails sent yet</p>
            <p className="text-xs">First email will be sent on Day 0 of the aging bucket</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}