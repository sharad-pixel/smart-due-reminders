import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Clock, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkflowStep {
  id: string;
  step_order: number;
  day_offset: number;
  channel: "email" | "sms";
  label: string;
  is_active: boolean;
  ai_template_type: string;
  trigger_type: string;
  subject_template?: string;
  body_template: string;
  sms_template?: string;
}

interface WorkflowGraphProps {
  steps: WorkflowStep[];
  onGenerateContent?: (stepId: string) => void;
  onPreviewMessage?: (step: WorkflowStep) => void;
  isGenerating?: boolean;
  stepInvoiceCounts?: Record<number, number>;
}

const WorkflowGraph = ({ steps, onGenerateContent, onPreviewMessage, isGenerating, stepInvoiceCounts }: WorkflowGraphProps) => {
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
  const maxDayOffset = Math.max(...sortedSteps.map(s => s.day_offset), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Workflow Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
          
          {/* Steps */}
          <div className="space-y-8">
            {sortedSteps.map((step, index) => {
              const widthPercent = maxDayOffset > 0 ? (step.day_offset / maxDayOffset) * 80 : 50;
              
              return (
                <div key={step.id} className="relative flex items-start gap-4">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    step.is_active ? 'bg-primary border-primary' : 'bg-background border-muted'
                  }`}>
                    <span className={`text-sm font-bold ${step.is_active ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                      {step.step_order}
                    </span>
                  </div>

                  {/* Step content */}
                  <div className="flex-1 pb-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{step.label}</h4>
                          <Badge variant={step.is_active ? "default" : "secondary"} className="text-xs">
                            {step.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {stepInvoiceCounts && stepInvoiceCounts[step.step_order] && (
                            <Badge variant="outline" className="text-xs">
                              {stepInvoiceCounts[step.step_order]} invoice{stepInvoiceCounts[step.step_order] !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Day {step.day_offset}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {step.channel === "email" ? (
                              <>
                                <Mail className="h-3 w-3" />
                                <span>Email</span>
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-3 w-3" />
                                <span>SMS</span>
                              </>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {step.ai_template_type}
                          </Badge>
                        </div>

                        {/* Visual day indicator */}
                        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary/20 transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>

                      {onGenerateContent && (
                        <div className="flex items-center gap-2">
                          {onPreviewMessage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onPreviewMessage(step)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-3 w-3" />
                              Preview
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onGenerateContent(step.id)}
                            disabled={isGenerating}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-3 w-3" />
                            Generate
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {sortedSteps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No workflow steps configured yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowGraph;
