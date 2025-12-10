import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue, personaConfig } from "@/lib/personaConfig";
import { Calendar, Mail, MessageSquare, Clock, Bot, CalendarClock, CheckCircle2, Circle, ListTodo, MessageCircle, AlertCircle, Brain } from "lucide-react";
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
  { key: 'sam', bucketMin: 1, bucketMax: 30, label: '1-30 Days' },
  { key: 'james', bucketMin: 31, bucketMax: 60, label: '31-60 Days' },
  { key: 'katy', bucketMin: 61, bucketMax: 90, label: '61-90 Days' },
  { key: 'troy', bucketMin: 91, bucketMax: 120, label: '91-120 Days' },
  { key: 'jimmy', bucketMin: 121, bucketMax: 150, label: '121-150 Days' },
  { key: 'rocco', bucketMin: 151, bucketMax: null, label: '150+ Days' },
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
  const [loading, setLoading] = useState(true);

  // Fetch invoice-level tasks and inbound emails
  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!invoiceId) return;
      
      setLoading(true);
      
      // Fetch tasks for this invoice
      const { data: tasksData } = await supabase
        .from('collection_tasks')
        .select('id, summary, status, priority, task_type, notes, created_at')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch inbound emails for this invoice
      const { data: emailsData } = await supabase
        .from('inbound_emails')
        .select('id, subject, ai_summary, from_email, created_at')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(5);

      setTasks(tasksData || []);
      setInboundEmails(emailsData || []);
      setLoading(false);
    };

    fetchInvoiceData();
  }, [invoiceId]);
  
  // Calculate next outreach date
  const getNextOutreachInfo = () => {
    if (sortedSteps.length === 0) return null;
    
    const nextStep = sortedSteps.find(step => step.day_offset > daysPastDue);
    
    if (nextStep) {
      const dueDateObj = new Date(dueDate);
      const nextOutreachDate = addDays(dueDateObj, nextStep.day_offset);
      return {
        step: nextStep,
        date: nextOutreachDate,
        daysUntil: nextStep.day_offset - daysPastDue
      };
    }
    
    const lastStep = sortedSteps[sortedSteps.length - 1];
    return {
      step: lastStep,
      date: null,
      daysUntil: 0,
      isComplete: true
    };
  };
  
  const nextOutreach = getNextOutreachInfo();

  // Determine the current persona index based on days past due
  const getCurrentPersonaIndex = () => {
    if (daysPastDue <= 0) return -1;
    return personaProgression.findIndex(p => {
      if (p.bucketMax === null) return daysPastDue >= p.bucketMin;
      return daysPastDue >= p.bucketMin && daysPastDue <= p.bucketMax;
    });
  };

  const currentPersonaIndex = getCurrentPersonaIndex();

  if (!isActiveInvoice) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Collection Intelligence - Invoice Level
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" />
          Collection Intelligence - Invoice Level
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Next Outreach Date */}
        {nextOutreach && workflow && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-accent/50">
            <CalendarClock className="h-5 w-5 text-accent-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {nextOutreach.isComplete ? 'All Steps Complete' : 'Next Scheduled Outreach'}
              </p>
              {nextOutreach.date && !nextOutreach.isComplete ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-semibold text-foreground">
                    {format(nextOutreach.date, 'MMM d, yyyy')}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {nextOutreach.daysUntil === 0 ? 'Today' : 
                     nextOutreach.daysUntil === 1 ? 'Tomorrow' : 
                     `In ${nextOutreach.daysUntil} days`}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {nextOutreach.isComplete ? 'Workflow has completed all scheduled steps' : 'No upcoming outreach scheduled'}
                </p>
              )}
              {nextOutreach.step && !nextOutreach.isComplete && (
                <p className="text-xs text-muted-foreground mt-1">
                  Step {nextOutreach.step.step_order}: {nextOutreach.step.label}
                </p>
              )}
            </div>
          </div>
        )}

        {/* AI Agent Progression */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">AI Agent Progression</span>
            <span className="text-xs text-muted-foreground">(Active invoices progress through all agents)</span>
          </div>
          
          <div className="grid grid-cols-6 gap-1">
            {personaProgression.map((stage, index) => {
              const persona = personaConfig[stage.key];
              const isPast = index < currentPersonaIndex;
              const isCurrent = index === currentPersonaIndex;
              const isFuture = index > currentPersonaIndex;
              
              return (
                <div 
                  key={stage.key}
                  className={`relative flex flex-col items-center p-2 rounded-lg transition-all ${
                    isCurrent 
                      ? 'bg-primary/10 ring-2 ring-primary/50' 
                      : isPast 
                      ? 'bg-muted/30 opacity-60' 
                      : 'bg-muted/20'
                  }`}
                >
                  <div className="relative">
                    <PersonaAvatar persona={stage.key} size="sm" />
                    {isPast && (
                      <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 text-green-500 bg-background rounded-full" />
                    )}
                    {isCurrent && (
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                        <Circle className="h-2 w-2 text-primary-foreground fill-current" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-medium mt-1 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                    {persona?.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{stage.label}</span>
                  {isCurrent && (
                    <Badge variant="default" className="text-[9px] mt-1 px-1 py-0">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Persona Details */}
        {currentPersona && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <PersonaAvatar persona={currentPersona.name.toLowerCase()} size="md" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{currentPersona.name}</span>
                <Badge 
                  variant="outline" 
                  className="text-xs"
                  style={{ borderColor: currentPersona.color, color: currentPersona.color }}
                >
                  Day {daysPastDue}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{currentPersona.description}</p>
              <p className="text-xs text-muted-foreground mt-1 italic">Tone: {currentPersona.tone}</p>
            </div>
          </div>
        )}

        {daysPastDue <= 0 && (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Invoice is not yet past due - AI agents will activate once past due date
            </p>
          </div>
        )}

        {/* Invoice Intelligence Summary */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Invoice Activity Summary</span>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Loading intelligence...</div>
          ) : (
            <div className="space-y-3">
              {/* Tasks Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Tasks ({tasks.length})</span>
                </div>
                {tasks.length > 0 ? (
                  <div className="space-y-1.5 ml-5">
                    {tasks.slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-start gap-2 text-xs">
                        <Badge 
                          variant={task.status === 'done' ? 'secondary' : task.priority === 'high' ? 'destructive' : 'outline'}
                          className="text-[10px] px-1.5"
                        >
                          {task.status}
                        </Badge>
                        <span className="text-muted-foreground line-clamp-1">{task.summary}</span>
                      </div>
                    ))}
                    {tasks.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{tasks.length - 3} more tasks</span>
                    )}
                    {/* Task Notes */}
                    {tasks.some(t => t.notes && Array.isArray(t.notes) && t.notes.length > 0) && (
                      <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                        <span className="font-medium">Latest Note: </span>
                        <span className="text-muted-foreground">
                          {tasks.find(t => t.notes && Array.isArray(t.notes) && t.notes.length > 0)?.notes[0]?.content || 'No notes'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground ml-5">No tasks for this invoice</p>
                )}
              </div>

              {/* Inbound AI Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Inbound AI ({inboundEmails.length})</span>
                </div>
                {inboundEmails.length > 0 ? (
                  <div className="space-y-1.5 ml-5">
                    {inboundEmails.slice(0, 2).map(email => (
                      <div key={email.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium line-clamp-1">{email.subject || 'No subject'}</span>
                        </div>
                        {email.ai_summary && (
                          <p className="text-muted-foreground ml-5 line-clamp-2 italic">
                            "{email.ai_summary}"
                          </p>
                        )}
                      </div>
                    ))}
                    {inboundEmails.length > 2 && (
                      <span className="text-xs text-muted-foreground">+{inboundEmails.length - 2} more emails</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground ml-5">No inbound communications</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Workflow Steps */}
        {workflow && sortedSteps.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Outreach Schedule</span>
              <span className="text-xs text-muted-foreground">({workflow.name})</span>
            </div>
            <div className="space-y-1.5 ml-6">
              {sortedSteps.slice(0, 4).map((step, index) => {
                const stepDaysPastDue = step.day_offset;
                const isPast = daysPastDue > stepDaysPastDue;
                const isCurrent = daysPastDue >= stepDaysPastDue && (index === sortedSteps.length - 1 || daysPastDue < sortedSteps[index + 1]?.day_offset);
                
                return (
                  <div 
                    key={step.id} 
                    className={`flex items-center gap-2 p-1.5 rounded text-xs transition-colors ${
                      isCurrent 
                        ? 'bg-primary/10 border border-primary/30' 
                        : isPast 
                        ? 'opacity-50' 
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${
                      isCurrent 
                        ? 'bg-primary text-primary-foreground' 
                        : isPast 
                        ? 'bg-muted-foreground/50 text-background' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.step_order}
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-1">
                      {step.channel === 'email' ? (
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={isCurrent ? 'font-medium' : ''}>
                        {step.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      Day {step.day_offset}
                    </div>
                  </div>
                );
              })}
              {sortedSteps.length > 4 && (
                <p className="text-xs text-muted-foreground">+{sortedSteps.length - 4} more steps</p>
              )}
            </div>
          </div>
        )}

        {!workflow && daysPastDue > 0 && (
          <p className="text-sm text-muted-foreground">
            No active workflow found for this aging bucket
          </p>
        )}
      </CardContent>
    </Card>
  );
};
