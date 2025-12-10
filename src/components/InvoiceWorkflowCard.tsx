import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue, personaConfig } from "@/lib/personaConfig";
import { Calendar, Mail, MessageSquare, Clock, CalendarClock, ArrowRight, ListTodo, MessageCircle, Brain, Zap } from "lucide-react";
import { format, addDays } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WorkflowStep {
  id: string;
  step_order: number;
  day_offset: number;
  channel: string;
  label: string;
  is_active: boolean;
}

interface CollectionWorkflow {
  id: string;
  name: string;
  description: string | null;
  aging_bucket: string;
  is_active: boolean;
}

interface CollectionTask {
  id: string;
  summary: string;
  status: string;
  priority: string;
  task_type: string;
  notes: any;
  created_at: string;
}

interface InboundEmail {
  id: string;
  subject: string | null;
  ai_summary: string | null;
  from_email: string;
  created_at: string;
}

interface InvoiceWorkflowCardProps {
  daysPastDue: number;
  workflow: CollectionWorkflow | null;
  workflowSteps: WorkflowStep[];
  isActiveInvoice: boolean;
  dueDate: string;
  invoiceId: string;
}

// Define the persona progression for active invoices
const personaProgression = [
  { key: 'sam', bucketMin: 1, bucketMax: 30, label: '1-30' },
  { key: 'james', bucketMin: 31, bucketMax: 60, label: '31-60' },
  { key: 'katy', bucketMin: 61, bucketMax: 90, label: '61-90' },
  { key: 'troy', bucketMin: 91, bucketMax: 120, label: '91-120' },
  { key: 'jimmy', bucketMin: 121, bucketMax: 150, label: '121-150' },
  { key: 'rocco', bucketMin: 151, bucketMax: null, label: '150+' },
];

export const InvoiceWorkflowCard = ({ 
  daysPastDue, 
  workflow, 
  workflowSteps,
  isActiveInvoice,
  dueDate,
  invoiceId
}: InvoiceWorkflowCardProps) => {
  const currentPersona = getPersonaByDaysPastDue(daysPastDue);
  const sortedSteps = [...workflowSteps].sort((a, b) => a.step_order - b.step_order);
  
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [inboundEmails, setInboundEmails] = useState<InboundEmail[]>([]);
  const [outreachCount, setOutreachCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!invoiceId) return;
      setLoading(true);
      
      const [tasksRes, emailsRes, activitiesRes] = await Promise.all([
        supabase
          .from('collection_tasks')
          .select('id, summary, status, priority, task_type, notes, created_at')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('inbound_emails')
          .select('id, subject, ai_summary, from_email, created_at')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('collection_activities')
          .select('id', { count: 'exact' })
          .eq('invoice_id', invoiceId)
          .eq('direction', 'outbound')
      ]);

      setTasks(tasksRes.data || []);
      setInboundEmails(emailsRes.data || []);
      setOutreachCount(activitiesRes.count || 0);
      setLoading(false);
    };

    fetchInvoiceData();
  }, [invoiceId]);

  // Get current persona index and calculate days until next agent
  const getCurrentPersonaIndex = () => {
    if (daysPastDue <= 0) return -1;
    return personaProgression.findIndex(p => {
      if (p.bucketMax === null) return daysPastDue >= p.bucketMin;
      return daysPastDue >= p.bucketMin && daysPastDue <= p.bucketMax;
    });
  };

  const currentPersonaIndex = getCurrentPersonaIndex();
  
  // Calculate days until next agent takes over
  const getDaysUntilNextAgent = () => {
    if (currentPersonaIndex === -1) return { days: personaProgression[0].bucketMin - daysPastDue, nextAgent: personaConfig['sam'] };
    if (currentPersonaIndex >= personaProgression.length - 1) return null; // Already at Rocco
    
    const currentStage = personaProgression[currentPersonaIndex];
    const nextStage = personaProgression[currentPersonaIndex + 1];
    const daysRemaining = currentStage.bucketMax! - daysPastDue + 1;
    
    return { 
      days: daysRemaining, 
      nextAgent: personaConfig[nextStage.key]
    };
  };

  const nextAgentInfo = getDaysUntilNextAgent();

  // Calculate next outreach date
  const getNextOutreachInfo = () => {
    if (sortedSteps.length === 0) return null;
    const nextStep = sortedSteps.find(step => step.day_offset > daysPastDue);
    
    if (nextStep) {
      const dueDateObj = new Date(dueDate);
      const nextOutreachDate = addDays(dueDateObj, nextStep.day_offset);
      return { step: nextStep, date: nextOutreachDate, daysUntil: nextStep.day_offset - daysPastDue };
    }
    return { step: sortedSteps[sortedSteps.length - 1], date: null, daysUntil: 0, isComplete: true };
  };
  
  const nextOutreach = getNextOutreachInfo();

  if (!isActiveInvoice) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-muted-foreground" />
            Collection Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Collection workflows only apply to Open or In Payment Plan invoices.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" />
          Collection Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Agent & Next Agent Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Current Agent */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Current Agent</p>
            {currentPersona ? (
              <div className="flex items-center gap-2">
                <PersonaAvatar persona={currentPersona.name.toLowerCase()} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{currentPersona.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{currentPersona.tone}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Not yet past due</p>
            )}
          </div>

          {/* Next Agent */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Next Agent</p>
            {nextAgentInfo ? (
              <div className="flex items-center gap-2">
                <PersonaAvatar persona={nextAgentInfo.nextAgent.name.toLowerCase()} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{nextAgentInfo.nextAgent.name}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    in {nextAgentInfo.days} day{nextAgentInfo.days !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Final agent assigned</p>
            )}
          </div>
        </div>

        {/* Agent Progression Timeline */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agent Progression</p>
          <div className="flex items-center justify-between gap-1">
            {personaProgression.map((stage, index) => {
              const persona = personaConfig[stage.key];
              const isPast = index < currentPersonaIndex;
              const isCurrent = index === currentPersonaIndex;
              
              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div 
                    className={`flex flex-col items-center flex-1 ${
                      isCurrent ? 'scale-110 z-10' : isPast ? 'opacity-40' : 'opacity-60'
                    }`}
                  >
                    <div className={`relative ${isCurrent ? 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-full' : ''}`}>
                      <PersonaAvatar persona={stage.key} size="xs" />
                    </div>
                    <span className={`text-[9px] mt-0.5 ${isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                      {stage.label}
                    </span>
                  </div>
                  {index < personaProgression.length - 1 && (
                    <ArrowRight className={`h-3 w-3 shrink-0 mx-0.5 ${
                      index < currentPersonaIndex ? 'text-muted-foreground/40' : 'text-muted-foreground/20'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Outreach */}
        {nextOutreach && workflow && (
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-accent/20 border border-accent/30">
            <CalendarClock className="h-4 w-4 text-accent-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                {nextOutreach.isComplete ? 'All outreach complete' : 'Next Outreach'}
              </p>
              {nextOutreach.date && !nextOutreach.isComplete && (
                <p className="text-xs text-muted-foreground">
                  {format(nextOutreach.date, 'MMM d')} · {nextOutreach.step.label}
                </p>
              )}
            </div>
            {!nextOutreach.isComplete && nextOutreach.daysUntil > 0 && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {nextOutreach.daysUntil}d
              </Badge>
            )}
          </div>
        )}

        {/* Activity Summary */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          {/* Tasks */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Tasks ({tasks.length})
              </span>
            </div>
            {loading ? (
              <div className="h-8 bg-muted/30 rounded animate-pulse" />
            ) : tasks.length > 0 ? (
              <div className="space-y-1">
                {tasks.slice(0, 2).map(task => (
                  <div key={task.id} className="flex items-center gap-1.5">
                    <Badge 
                      variant={task.status === 'done' ? 'secondary' : 'outline'}
                      className="text-[9px] px-1 py-0 shrink-0"
                    >
                      {task.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground truncate">{task.summary}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">No tasks</p>
            )}
          </div>

          {/* Inbound */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Inbound ({inboundEmails.length})
              </span>
            </div>
            {loading ? (
              <div className="h-8 bg-muted/30 rounded animate-pulse" />
            ) : inboundEmails.length > 0 ? (
              <div className="space-y-1">
                {inboundEmails.slice(0, 2).map(email => (
                  <div key={email.id} className="flex items-center gap-1.5">
                    <Mail className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground truncate">
                      {email.subject || 'No subject'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">No emails</p>
            )}
          </div>
        </div>

        {/* Workflow Steps Compact */}
        {workflow && sortedSteps.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Workflow: {workflow.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {outreachCount} of {sortedSteps.length} sent
              </span>
            </div>
            <div className="flex gap-1">
              {sortedSteps.slice(0, 6).map((step, index) => {
                // Use actual outreach count to determine completed steps
                const isSent = index < outreachCount;
                const isNext = index === outreachCount;
                
                return (
                  <div 
                    key={step.id}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      isNext ? 'bg-primary' : isSent ? 'bg-green-500' : 'bg-muted'
                    }`}
                    title={`Day ${step.day_offset}: ${step.label}${isSent ? ' (Sent)' : isNext ? ' (Next)' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
