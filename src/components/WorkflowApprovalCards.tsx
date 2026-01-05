import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, ChevronUp, Mail, Eye, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  id: string;
  step_order: number;
  day_offset: number;
  label: string;
  subject_template?: string;
  body_template: string;
  is_step_approved?: boolean;
}

interface Workflow {
  id: string;
  aging_bucket: string;
  name: string;
  is_active: boolean;
  is_template_approved?: boolean;
  template_approved_at?: string;
  persona_id?: string;
  persona?: {
    id: string;
    name: string;
    persona_summary?: string;
  };
  steps: WorkflowStep[];
}

interface Props {
  workflows: Workflow[];
  onRefresh: () => void;
  onPreviewStep?: (step: WorkflowStep, agingBucket: string) => void;
}

const agentMeta: Record<string, { tone: string; color: string }> = {
  Sam: { tone: "Friendly, Helpful", color: "text-green-600" },
  James: { tone: "Professional, Reminder", color: "text-blue-600" },
  Katy: { tone: "Firm, Urgent", color: "text-amber-600" },
  Jimmy: { tone: "Serious, Escalation", color: "text-orange-600" },
  Troy: { tone: "Final Warning", color: "text-red-500" },
  Rocco: { tone: "Collections, Consequences", color: "text-red-700" },
};

const bucketLabels: Record<string, string> = {
  dpd_1_30: "0-30 Days Past Due",
  dpd_31_60: "31-60 Days Past Due",
  dpd_61_90: "61-90 Days Past Due",
  dpd_91_120: "91-120 Days Past Due",
  dpd_121_150: "121-150 Days Past Due",
  dpd_150_plus: "150+ Days Past Due",
};

export function WorkflowApprovalCards({ workflows, onRefresh, onPreviewStep }: Props) {
  const queryClient = useQueryClient();
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [approvingWorkflow, setApprovingWorkflow] = useState<string | null>(null);

  const toggleExpanded = (workflowId: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      if (next.has(workflowId)) {
        next.delete(workflowId);
      } else {
        next.add(workflowId);
      }
      return next;
    });
  };

  const approveWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update workflow as approved
      const { error } = await supabase
        .from("collection_workflows")
        .update({
          is_template_approved: true,
          template_approved_at: new Date().toISOString(),
          template_approved_by: user.id,
        })
        .eq("id", workflowId);

      if (error) throw error;

      // Also approve all steps
      await supabase
        .from("collection_workflow_steps")
        .update({
          is_step_approved: true,
          step_approved_at: new Date().toISOString(),
        })
        .eq("workflow_id", workflowId);

      return workflowId;
    },
    onSuccess: (workflowId) => {
      const workflow = workflows.find(w => w.id === workflowId);
      const agentName = workflow?.persona?.name || "Agent";
      toast.success(`${agentName}'s templates approved! Outreach will auto-send.`);
      onRefresh();
    },
    onError: () => {
      toast.error("Failed to approve workflow");
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const unapproved = workflows.filter(w => !w.is_template_approved);
      
      for (const workflow of unapproved) {
        await supabase
          .from("collection_workflows")
          .update({
            is_template_approved: true,
            template_approved_at: new Date().toISOString(),
            template_approved_by: user.id,
          })
          .eq("id", workflow.id);

        await supabase
          .from("collection_workflow_steps")
          .update({
            is_step_approved: true,
            step_approved_at: new Date().toISOString(),
          })
          .eq("workflow_id", workflow.id);
      }

      return unapproved.length;
    },
    onSuccess: (count) => {
      toast.success(`All ${count} workflow(s) approved! Outreach will auto-send.`);
      onRefresh();
    },
    onError: () => {
      toast.error("Failed to approve workflows");
    },
  });

  const handleApprove = async (workflowId: string) => {
    setApprovingWorkflow(workflowId);
    try {
      await approveWorkflowMutation.mutateAsync(workflowId);
    } finally {
      setApprovingWorkflow(null);
    }
  };

  const activeWorkflows = workflows.filter(w => w.is_active);
  const sortedWorkflows = [...activeWorkflows].sort((a, b) => {
    const order = ["dpd_1_30", "dpd_31_60", "dpd_61_90", "dpd_91_120", "dpd_121_150", "dpd_150_plus"];
    return order.indexOf(a.aging_bucket) - order.indexOf(b.aging_bucket);
  });

  const unapprovedCount = sortedWorkflows.filter(w => !w.is_template_approved).length;

  if (sortedWorkflows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No active workflows found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Collection Workflows by Aging Bucket
            </CardTitle>
            {unapprovedCount > 0 && (
              <Button
                onClick={() => approveAllMutation.mutate()}
                disabled={approveAllMutation.isPending}
                size="sm"
              >
                {approveAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve All ({unapprovedCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedWorkflows.map((workflow) => {
            const isExpanded = expandedWorkflows.has(workflow.id);
            const agentName = workflow.persona?.name || "Unknown";
            const meta = agentMeta[agentName] || { tone: "Standard", color: "text-foreground" };
            const isApproved = workflow.is_template_approved;
            const isApproving = approvingWorkflow === workflow.id;

            return (
              <Collapsible key={workflow.id} open={isExpanded} onOpenChange={() => toggleExpanded(workflow.id)}>
                <Card className={cn(
                  "border transition-colors",
                  isApproved ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <PersonaAvatar persona={agentName} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{bucketLabels[workflow.aging_bucket] || workflow.aging_bucket}</span>
                            <Badge variant={isApproved ? "default" : "secondary"} className={cn(
                              isApproved ? "bg-green-600" : "bg-amber-500"
                            )}>
                              {isApproved ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  APPROVED
                                </>
                              ) : (
                                "⚠️ PENDING"
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Agent: <span className={meta.color}>{agentName}</span> ({meta.tone})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isApproved && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(workflow.id);
                            }}
                            disabled={isApproving}
                          >
                            {isApproving ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        )}
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-4">
                      <div className="space-y-2 pl-10">
                        {workflow.steps
                          ?.sort((a, b) => a.step_order - b.step_order)
                          .map((step) => (
                            <div
                              key={step.id}
                              className="flex items-center justify-between p-2 rounded bg-background border"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm">Day {step.day_offset}:</span>
                                <span className="text-sm font-medium">{step.label}</span>
                              </div>
                              {onPreviewStep && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onPreviewStep(step, workflow.aging_bucket)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Preview
                                </Button>
                              )}
                            </div>
                          ))}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
