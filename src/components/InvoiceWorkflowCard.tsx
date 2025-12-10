import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Calendar, Mail, MessageSquare, Clock, Bot, CalendarClock } from "lucide-react";
import { format, addDays } from "date-fns";

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

interface InvoiceWorkflowCardProps {
  daysPastDue: number;
  workflow: CollectionWorkflow | null;
  workflowSteps: WorkflowStep[];
  isActiveInvoice: boolean;
  dueDate: string;
}

const getAgingBucketLabel = (bucket: string): string => {
  const labels: Record<string, string> = {
    'current': 'Current',
    'dpd_1_30': '1-30 Days',
    'dpd_31_60': '31-60 Days',
    'dpd_61_90': '61-90 Days',
    'dpd_91_120': '91-120 Days',
    'dpd_121_150': '121-150 Days',
    'dpd_150_plus': '150+ Days',
  };
  return labels[bucket] || bucket;
};

const getPersonaNameFromBucket = (bucket: string): string | null => {
  const bucketToPersona: Record<string, string> = {
    'dpd_1_30': 'sam',
    'dpd_31_60': 'james',
    'dpd_61_90': 'katy',
    'dpd_91_120': 'troy',
    'dpd_121_150': 'jimmy',
    'dpd_150_plus': 'rocco',
  };
  return bucketToPersona[bucket] || null;
};

export const InvoiceWorkflowCard = ({ 
  daysPastDue, 
  workflow, 
  workflowSteps,
  isActiveInvoice,
  dueDate
}: InvoiceWorkflowCardProps) => {
  const persona = getPersonaByDaysPastDue(daysPastDue);
  const sortedSteps = [...workflowSteps].sort((a, b) => a.step_order - b.step_order);
  
  // Calculate which step is "current" based on days past due
  const getCurrentStepIndex = () => {
    for (let i = sortedSteps.length - 1; i >= 0; i--) {
      if (daysPastDue >= sortedSteps[i].day_offset) {
        return i;
      }
    }
    return -1;
  };
  
  const currentStepIndex = getCurrentStepIndex();
  
  // Calculate next outreach date
  const getNextOutreachInfo = () => {
    if (sortedSteps.length === 0) return null;
    
    // Find the next step that hasn't been reached yet
    const nextStep = sortedSteps.find(step => step.day_offset > daysPastDue);
    
    if (nextStep) {
      // Calculate the date: due_date + day_offset
      const dueDateObj = new Date(dueDate);
      const nextOutreachDate = addDays(dueDateObj, nextStep.day_offset);
      return {
        step: nextStep,
        date: nextOutreachDate,
        daysUntil: nextStep.day_offset - daysPastDue
      };
    }
    
    // All steps have been reached - return the last step info
    const lastStep = sortedSteps[sortedSteps.length - 1];
    return {
      step: lastStep,
      date: null, // Already passed
      daysUntil: 0,
      isComplete: true
    };
  };
  
  const nextOutreach = getNextOutreachInfo();

  if (!isActiveInvoice) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Collection Agent
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
          <Bot className="h-4 w-4" />
          AI Collection Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Assigned Persona */}
        {persona ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <PersonaAvatar persona={persona.name.toLowerCase()} size="md" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{persona.name}</span>
                <Badge 
                  variant="outline" 
                  className="text-xs"
                  style={{ borderColor: persona.color, color: persona.color }}
                >
                  {getAgingBucketLabel(workflow?.aging_bucket || '')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{persona.description}</p>
              <p className="text-xs text-muted-foreground mt-1 italic">Tone: {persona.tone}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              No persona assigned - Invoice is not past due
            </p>
          </div>
        )}

        {/* Workflow Info */}
        {workflow && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Workflow</span>
              <span className="text-sm text-muted-foreground">{workflow.name}</span>
            </div>

            {/* Outreach Schedule */}
            {sortedSteps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Outreach Schedule</span>
                </div>
                <div className="space-y-2 ml-6">
                  {sortedSteps.map((step, index) => {
                    const isPast = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isFuture = index > currentStepIndex;
                    
                    return (
                      <div 
                        key={step.id} 
                        className={`flex items-center gap-3 p-2 rounded-md text-sm transition-colors ${
                          isCurrent 
                            ? 'bg-primary/10 border border-primary/30' 
                            : isPast 
                            ? 'opacity-50' 
                            : 'bg-muted/30'
                        }`}
                      >
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          isCurrent 
                            ? 'bg-primary text-primary-foreground' 
                            : isPast 
                            ? 'bg-muted-foreground/50 text-background' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {step.step_order}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-1">
                          {step.channel === 'email' ? (
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className={isCurrent ? 'font-medium' : ''}>
                            {step.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Day {step.day_offset}
                        </div>
                        
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sortedSteps.length === 0 && (
              <p className="text-sm text-muted-foreground ml-6">
                No workflow steps configured
              </p>
            )}
          </div>
        )}

        {!workflow && persona && (
          <p className="text-sm text-muted-foreground">
            No active workflow found for this aging bucket
          </p>
        )}
      </CardContent>
    </Card>
  );
};
