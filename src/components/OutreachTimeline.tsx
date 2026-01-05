import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle2, AlertCircle, Calendar, Eye, MousePointer } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface OutreachTimelineProps {
  invoiceId: string;
  invoiceDueDate: string;
  agingBucket: string | null;
}

interface TimelineItem {
  id: string;
  type: 'draft' | 'sent';
  stepNumber: number;
  dayOffset: number;
  date: string;
  subject: string | null;
  status: string;
  channel: string;
  opened?: boolean;
  clicked?: boolean;
}

export function OutreachTimeline({ invoiceId, invoiceDueDate, agingBucket }: OutreachTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["outreach-timeline", invoiceId],
    staleTime: 30_000,
    queryFn: async () => {
      // Get all drafts for this invoice
      const { data: drafts } = await supabase
        .from("ai_drafts")
        .select("id, step_number, channel, subject, status, sent_at, created_at, days_past_due")
        .eq("invoice_id", invoiceId)
        .order("step_number", { ascending: true });

      // Get all outreach logs for this invoice
      const { data: logs } = await supabase
        .from("outreach_logs")
        .select("id, channel, subject, status, sent_at, delivery_metadata")
        .eq("invoice_id", invoiceId)
        .order("sent_at", { ascending: false });

      // Get the active workflow for this invoice
      const { data: workflow } = await supabase
        .from("ai_workflows")
        .select("id, cadence_days")
        .eq("invoice_id", invoiceId)
        .eq("is_active", true)
        .maybeSingle();

      // Get workflow steps for the aging bucket
      const { data: workflowData } = await supabase
        .from("collection_workflows")
        .select(`
          id,
          name,
          collection_workflow_steps (
            step_order,
            day_offset,
            label,
            channel
          )
        `)
        .eq("aging_bucket", agingBucket || "dpd_1_30")
        .eq("is_active", true)
        .maybeSingle();

      const steps = workflowData?.collection_workflow_steps || [];
      const cadenceDays = (workflow?.cadence_days as number[]) || steps.map((s: any) => s.day_offset);

      // Build timeline items
      const timeline: TimelineItem[] = [];

      // Add sent items from logs (estimate step number based on order)
      let stepCounter = 1;
      const sortedLogs = [...(logs || [])].sort((a, b) => 
        new Date(a.sent_at || 0).getTime() - new Date(b.sent_at || 0).getTime()
      );
      
      for (const log of sortedLogs) {
        const metadata = log.delivery_metadata as Record<string, any> | null;
        timeline.push({
          id: log.id,
          type: 'sent',
          stepNumber: metadata?.step_number || stepCounter,
          dayOffset: 0,
          date: log.sent_at || '',
          subject: log.subject,
          status: 'sent',
          channel: log.channel || 'email',
          opened: metadata?.opened || false,
          clicked: metadata?.clicked || false,
        });
        stepCounter++;
      }

      // Add pending drafts
      for (const draft of drafts || []) {
        if (draft.sent_at) continue; // Skip already sent
        timeline.push({
          id: draft.id,
          type: 'draft',
          stepNumber: draft.step_number,
          dayOffset: draft.days_past_due || 0,
          date: draft.created_at || '',
          subject: draft.subject,
          status: draft.status || 'pending',
          channel: draft.channel || 'email',
        });
      }

      // Calculate next outreach
      const dueDate = new Date(invoiceDueDate);
      const today = new Date();
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let nextOutreach: { day: number; date: Date } | null = null;
      const sentStepsCount = sortedLogs.length;
      const draftSteps = new Set((drafts || []).map(d => d.step_number));

      for (let i = 0; i < cadenceDays.length; i++) {
        const stepNumber = i + 1;
        // Check if step was already sent (based on count) or has a draft
        if (stepNumber > sentStepsCount && !draftSteps.has(stepNumber)) {
          const targetDate = new Date(dueDate);
          targetDate.setDate(targetDate.getDate() + cadenceDays[i]);
          if (targetDate.getTime() > today.getTime()) {
            nextOutreach = { day: cadenceDays[i], date: targetDate };
            break;
          }
        }
      }

      return {
        timeline: timeline.sort((a, b) => {
          if (a.type === 'sent' && b.type !== 'sent') return -1;
          if (a.type !== 'sent' && b.type === 'sent') return 1;
          return b.stepNumber - a.stepNumber;
        }),
        workflowName: workflowData?.name || 'Collection Workflow',
        cadenceDays,
        nextOutreach,
        daysPastDue: Math.max(0, daysPastDue),
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full mb-3" />
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getBucketLabel = (bucket: string | null) => {
    const labels: Record<string, string> = {
      'current': 'Current (Not Due)',
      'dpd_1_30': '1-30 Days Past Due',
      'dpd_31_60': '31-60 Days Past Due',
      'dpd_61_90': '61-90 Days Past Due',
      'dpd_91_120': '91-120 Days Past Due',
      'dpd_121_150': '121-150 Days Past Due',
      'dpd_150_plus': '150+ Days Past Due',
    };
    return labels[bucket || ''] || bucket || 'Unknown';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          Outreach Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Bucket:</span>
            <Badge variant="outline">{getBucketLabel(agingBucket)}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active Workflow:</span>
            <span className="font-medium">{data?.workflowName}</span>
          </div>
          {data?.nextOutreach && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Next Outreach:</span>
              <span className="font-medium text-amber-600">
                Day {data.nextOutreach.day} ({format(data.nextOutreach.date, "MMM d, yyyy")})
              </span>
            </div>
          )}
        </div>

        {/* Timeline Items */}
        <div className="space-y-3">
          {data?.timeline.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No outreach activity yet</p>
              <p className="text-sm">Drafts will be generated based on the workflow cadence</p>
            </div>
          ) : (
            data?.timeline.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg p-3 ${
                  item.type === 'sent' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    item.type === 'sent' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
                  }`}>
                    {item.type === 'sent' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Step {item.stepNumber} - {item.type === 'sent' ? 'Email Sent' : 'Draft Pending'}
                      </span>
                      <Badge variant={item.type === 'sent' ? 'default' : 'secondary'} className="text-xs">
                        {item.type === 'sent' ? '✓ Sent' : item.status}
                      </Badge>
                    </div>
                    {item.subject && (
                      <p className="text-sm text-muted-foreground truncate">
                        "{item.subject}"
                      </p>
                    )}
                    {item.type === 'sent' && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Opened: {item.opened ? 'Yes' : 'No'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          Clicked: {item.clicked ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {item.date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.date), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
