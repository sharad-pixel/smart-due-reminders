import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Workflow, Mail, MessageSquare, Clock, Pencil, Settings, Sparkles, Trash2, BarChart3, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import WorkflowStepEditor from "@/components/WorkflowStepEditor";
import WorkflowSettingsEditor from "@/components/WorkflowSettingsEditor";
import WorkflowTemplates, { Template } from "@/components/WorkflowTemplates";
import WorkflowGraph from "@/components/WorkflowGraph";
import MessagePreview from "@/components/MessagePreview";

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
  trigger_type: string;
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
  { value: "dpd_121_plus", label: "120+ Days Past Due", description: "Critical collection stage" },
];

const AIWorkflows = () => {
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState("dpd_1_30");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [previewStep, setPreviewStep] = useState<WorkflowStep | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchWorkflows();
    fetchInvoiceCounts();
  }, []);

  const fetchInvoiceCounts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-aging-bucket-invoices`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch invoice counts");

      const result = await response.json();
      if (result.success && result.data) {
        const counts: Record<string, number> = {};
        Object.keys(result.data).forEach((bucket) => {
          counts[bucket] = result.data[bucket].count || 0;
        });
        setBucketCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching invoice counts:", error);
    }
  };

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

  const handlePreviewMessage = (step: WorkflowStep) => {
    setPreviewStep(step);
    setShowPreview(true);
  };

  const handleGenerateContent = async (stepId: string) => {
    if (!selectedWorkflow) return;

    const step = selectedWorkflow.steps.find(s => s.id === stepId);
    if (!step) return;

    setGeneratingContent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-workflow-content`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stepId: step.id,
            agingBucket: selectedBucket,
            tone: step.ai_template_type,
            channel: step.channel,
            dayOffset: step.day_offset,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate content');
      }

      const result = await response.json();
      
      if (result.success) {
        await fetchWorkflows();
        toast.success("AI content generated successfully");
      }
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast.error(error.message || "Failed to generate content");
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowToDelete) return;

    try {
      // First delete all workflow steps
      const { error: stepsError } = await supabase
        .from("collection_workflow_steps")
        .delete()
        .eq("workflow_id", workflowToDelete.id);

      if (stepsError) throw stepsError;

      // Then delete the workflow
      const { error: workflowError } = await supabase
        .from("collection_workflows")
        .delete()
        .eq("id", workflowToDelete.id);

      if (workflowError) throw workflowError;

      await fetchWorkflows();
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
      toast.success("Workflow deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete workflow");
      console.error(error);
    }
  };

  const handleCreateCustomWorkflow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const bucketInfo = agingBuckets.find(b => b.value === selectedBucket);
      if (!bucketInfo) return;

      // Create user-specific workflow
      const { data: newWorkflow, error: createError } = await supabase
        .from("collection_workflows")
        .insert({
          user_id: user.id,
          aging_bucket: selectedBucket,
          name: `${bucketInfo.label} - Custom`,
          description: "Custom workflow for this aging bucket",
          is_active: false,
          is_locked: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      // If there's an existing locked workflow, copy its steps
      if (selectedWorkflow?.is_locked && selectedWorkflow.steps?.length) {
        const newSteps = selectedWorkflow.steps.map((step, index) => ({
          workflow_id: newWorkflow.id,
          step_order: index + 1,
          day_offset: step.day_offset,
          channel: step.channel,
          label: step.label,
          trigger_type: step.trigger_type,
          ai_template_type: step.ai_template_type,
          body_template: step.body_template,
          subject_template: step.subject_template,
          sms_template: step.sms_template,
          is_active: step.is_active,
          requires_review: true,
        }));

        const { error: stepsError } = await supabase
          .from("collection_workflow_steps")
          .insert(newSteps);

        if (stepsError) throw stepsError;
      }

      await fetchWorkflows();
      toast.success("Custom workflow created");
    } catch (error: any) {
      toast.error("Failed to create custom workflow");
      console.error(error);
    }
  };

  const handleSaveSettings = async (settings: Partial<Workflow>) => {
    if (!selectedWorkflow) return;

    try {
      const { error } = await supabase
        .from("collection_workflows")
        .update({
          name: settings.name,
          description: settings.description,
        })
        .eq("id", selectedWorkflow.id);

      if (error) throw error;

      await fetchWorkflows();
      toast.success("Workflow settings updated");
    } catch (error: any) {
      toast.error("Failed to update settings");
      console.error(error);
    }
  };

  const handleApplyTemplate = async (template: Template) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let workflowId = selectedWorkflow?.id;

      // If no workflow exists for this bucket, create one
      if (!selectedWorkflow) {
        const bucketInfo = agingBuckets.find(b => b.value === selectedBucket);
        if (!bucketInfo) {
          toast.error("Invalid aging bucket selected");
          return;
        }

        const { data: newWorkflow, error: createError } = await supabase
          .from("collection_workflows")
          .insert({
            user_id: user.id,
            aging_bucket: selectedBucket,
            name: `${bucketInfo.label} - ${template.name}`,
            description: template.description,
            is_active: false,
            is_locked: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        workflowId = newWorkflow.id;
      } else {
        // Check if workflow is locked
        if (selectedWorkflow.is_locked) {
          toast.error("Cannot modify locked workflows");
          return;
        }

        // Update existing workflow description
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
      }

      // Create new steps from template
      const newSteps = template.steps.map((step, index) => ({
        workflow_id: workflowId,
        step_order: index + 1,
        day_offset: step.day_offset,
        channel: step.channel,
        label: step.label,
        trigger_type: "relative_to_due",
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
                const invoiceCount = bucketCounts[bucket.value] || 0;
                
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bucket.label}</span>
                        <Badge variant={selectedBucket === bucket.value ? "secondary" : "outline"} className="text-xs">
                          {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}
                        </Badge>
                      </div>
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
                        {selectedWorkflow.is_locked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateCustomWorkflow}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Create Custom Workflow
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSettings(true)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setWorkflowToDelete(selectedWorkflow);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </>
                        )}
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="workflow-active" className="text-sm">
                            {selectedWorkflow.is_active ? "Enabled" : "Disabled"}
                          </Label>
                          <Switch
                            id="workflow-active"
                            checked={selectedWorkflow.is_active}
                            onCheckedChange={(checked) => toggleWorkflow(selectedWorkflow.id, checked)}
                            disabled={selectedWorkflow.is_locked}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedWorkflow.is_locked ? (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          This is a default workflow template. Click "Create Custom Workflow" to make your own editable version with these same steps.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Customize this workflow to fit your collection strategy.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "graph")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="list">List View</TabsTrigger>
                    <TabsTrigger value="graph">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Graph View
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="list" className="mt-6">
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
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePreviewMessage(step)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleGenerateContent(step.id)}
                                      disabled={generatingContent}
                                    >
                                      <Sparkles className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingStep(step)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </>
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
                  </TabsContent>

                  <TabsContent value="graph" className="mt-6">
                    <WorkflowGraph 
                      steps={selectedWorkflow.steps || []}
                      onGenerateContent={!selectedWorkflow.is_locked ? handleGenerateContent : undefined}
                      onPreviewMessage={handlePreviewMessage}
                      isGenerating={generatingContent}
                    />
                  </TabsContent>
                </Tabs>
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
        selectedBucket={selectedBucket}
        bucketLabel={agingBuckets.find(b => b.value === selectedBucket)?.label}
      />

      <MessagePreview
        open={showPreview}
        onOpenChange={setShowPreview}
        stepId={previewStep?.id || null}
        channel={previewStep?.channel || "email"}
        subject={previewStep?.subject_template}
        body={previewStep?.channel === "email" ? previewStep?.body_template : previewStep?.sms_template || ""}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workflowToDelete?.name}"? This will permanently delete the workflow and all its steps. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWorkflowToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkflow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default AIWorkflows;
