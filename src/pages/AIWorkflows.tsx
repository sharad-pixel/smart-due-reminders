import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Workflow, Mail, MessageSquare, Clock, Pencil, Settings, Sparkles } from "lucide-react";
import WorkflowStepEditor from "@/components/WorkflowStepEditor";
import WorkflowSettingsEditor from "@/components/WorkflowSettingsEditor";
import WorkflowTemplates, { Template } from "@/components/WorkflowTemplates";

interface WorkflowStep {
  id: string;
  step_order: number;
  day_offset: number;
  channel: "email" | "sms";
  label: string;
  is_active: boolean;
  subject_template?: string;
  body_template: string;
  sms_template?: string;
  ai_template_type: string;
}

interface Workflow {
  id: string;
  aging_bucket: string;
  name: string;
  description: string;
  is_active: boolean;
  is_locked?: boolean;
  steps: WorkflowStep[];
}

const agingBuckets = [
  { value: "current", label: "Current (0 days)", description: "Not yet overdue" },
  { value: "dpd_1_30", label: "1-30 Days Past Due", description: "Early stage collection" },
  { value: "dpd_31_60", label: "31-60 Days Past Due", description: "Mid-stage collection" },
  { value: "dpd_61_90", label: "61-90 Days Past Due", description: "Late stage collection" },
  { value: "dpd_91_120", label: "91-120 Days Past Due", description: "Final collection efforts" },
];

const AIWorkflows = () => {
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState("dpd_1_30");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: workflowsData, error } = await supabase
        .from("collection_workflows")
        .select(`
          *,
          steps:collection_workflow_steps(*)
        `)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("aging_bucket");

      if (error) throw error;

      setWorkflows(workflowsData || []);
    } catch (error: any) {
      toast.error("Failed to load workflows");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("collection_workflows")
        .update({ is_active: isActive })
        .eq("id", workflowId);

      if (error) throw error;

      setWorkflows(workflows.map(w => 
        w.id === workflowId ? { ...w, is_active: isActive } : w
      ));
      
      toast.success(isActive ? "Workflow enabled" : "Workflow disabled");
    } catch (error: any) {
      toast.error("Failed to update workflow");
      console.error(error);
    }
  };

  const handleSaveStep = async (step: WorkflowStep) => {
    try {
      const { error } = await supabase
        .from("collection_workflow_steps")
        .update({
          label: step.label,
          day_offset: step.day_offset,
          ai_template_type: step.ai_template_type,
          subject_template: step.subject_template,
          body_template: step.body_template,
          sms_template: step.sms_template,
        })
        .eq("id", step.id);

      if (error) throw error;

      await fetchWorkflows();
      toast.success("Step updated successfully");
    } catch (error: any) {
      toast.error("Failed to update step");
      console.error(error);
    }
  };

  const handleSaveSettings = async (settings: Partial<Workflow>) => {
    if (!selectedWorkflow) return;

    try {
      const { error } = await supabase
        .from("collection_workflows")
        .update({
          description: settings.description,
        })
        .eq("id", selectedWorkflow.id);

      if (error) throw error;

      await fetchWorkflows();
    } catch (error: any) {
      toast.error("Failed to update settings");
      console.error(error);
    }
  };

  const handleApplyTemplate = async (template: Template) => {
    if (!selectedWorkflow) {
      toast.error("Please select an aging bucket first");
      return;
    }

    if (selectedWorkflow.is_locked) {
      toast.error("Cannot modify locked workflows");
      return;
    }

    try {
      // Update workflow description
      const { error: workflowError } = await supabase
        .from("collection_workflows")
        .update({
          description: template.description,
        })
        .eq("id", selectedWorkflow.id);

      if (workflowError) throw workflowError;

      // Delete existing steps
      const { error: deleteError } = await supabase
        .from("collection_workflow_steps")
        .delete()
        .eq("workflow_id", selectedWorkflow.id);

      if (deleteError) throw deleteError;

      // Create new steps from template
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newSteps = template.steps.map((step, index) => ({
        workflow_id: selectedWorkflow.id,
        step_order: index + 1,
        day_offset: step.day_offset,
        channel: step.channel,
        label: step.label,
        trigger_type: "days_past_due",
        ai_template_type: step.tone,
        body_template: `Generated ${step.tone} collection message`,
        subject_template: step.channel === "email" ? `Payment reminder for invoice {{invoice_number}}` : null,
        sms_template: step.channel === "sms" ? `Hi {{debtor_name}}, this is a reminder about invoice {{invoice_number}}` : null,
        is_active: true,
        requires_review: true,
      }));

      const { error: insertError } = await supabase
        .from("collection_workflow_steps")
        .insert(newSteps);

      if (insertError) throw insertError;

      await fetchWorkflows();
      setShowTemplates(false);
      toast.success(`${template.name} template applied successfully`);
    } catch (error: any) {
      toast.error("Failed to apply template");
      console.error(error);
    }
  };

  const selectedWorkflow = workflows.find(w => w.aging_bucket === selectedBucket);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary">AI Workflows</h1>
            <p className="text-muted-foreground mt-2">
              Configure automated AI-powered collection outreach by aging bucket
            </p>
          </div>
          <Button onClick={() => setShowTemplates(true)} className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4" />
            <span>Browse Templates</span>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Aging Buckets Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Aging Buckets</CardTitle>
              <CardDescription>Select a bucket to configure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {agingBuckets.map((bucket) => {
                const workflow = workflows.find(w => w.aging_bucket === bucket.value);
                const isActive = workflow?.is_active ?? false;
                
                return (
                  <button
                    key={bucket.value}
                    onClick={() => setSelectedBucket(bucket.value)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedBucket === bucket.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{bucket.label}</span>
                      {isActive && (
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs opacity-80">{bucket.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Workflow Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {selectedWorkflow ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center space-x-2">
                          <Workflow className="h-5 w-5 text-primary" />
                          <span>{selectedWorkflow.name}</span>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {selectedWorkflow.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-4">
                        {!selectedWorkflow.is_locked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSettings(true)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </Button>
                        )}
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="workflow-active" className="text-sm">
                            {selectedWorkflow.is_active ? "Enabled" : "Disabled"}
                          </Label>
                          <Switch
                            id="workflow-active"
                            checked={selectedWorkflow.is_active}
                            onCheckedChange={(checked) => toggleWorkflow(selectedWorkflow.id, checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  {!selectedWorkflow.is_locked && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Customize this workflow to fit your collection strategy.
                      </p>
                    </CardContent>
                  )}
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Workflow Steps</CardTitle>
                    <CardDescription>
                      AI will generate drafts at these intervals for human review
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedWorkflow.steps?.sort((a, b) => a.step_order - b.step_order).map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                              {step.step_order}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{step.label}</p>
                              <div className="flex items-center space-x-3 mt-1">
                                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>Day {step.day_offset}</span>
                                </div>
                                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
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
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={step.is_active ? "default" : "secondary"}>
                              {step.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {!selectedWorkflow.is_locked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingStep(step)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        <strong>How it works:</strong> When an invoice reaches the specified days past due,
                        the AI will generate a draft message using your branding settings. All drafts require
                        human review before sending.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No workflow configured for this aging bucket yet.
                  </p>
                  <Button variant="outline" className="mt-4" disabled>
                    Create Workflow (Coming Soon)
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <WorkflowStepEditor
        step={editingStep}
        open={!!editingStep}
        onOpenChange={(open) => !open && setEditingStep(null)}
        onSave={handleSaveStep}
      />

      <WorkflowSettingsEditor
        workflow={selectedWorkflow}
        open={editingSettings}
        onOpenChange={setEditingSettings}
        onSave={handleSaveSettings}
      />

      <WorkflowTemplates
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelectTemplate={handleApplyTemplate}
      />
    </Layout>
  );
};

export default AIWorkflows;
