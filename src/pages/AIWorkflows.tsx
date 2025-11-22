import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Workflow, Mail, MessageSquare, Clock } from "lucide-react";

interface WorkflowStep {
  id: string;
  step_order: number;
  day_offset: number;
  channel: "email" | "sms";
  label: string;
  is_active: boolean;
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
        <div>
          <h1 className="text-4xl font-bold text-primary">AI Workflows</h1>
          <p className="text-muted-foreground mt-2">
            Configure automated AI-powered collection outreach by aging bucket
          </p>
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
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <Workflow className="h-5 w-5 text-primary" />
                          <span>{selectedWorkflow.name}</span>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {selectedWorkflow.description}
                        </CardDescription>
                      </div>
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
                  </CardHeader>
                  <CardContent>
                    {!selectedWorkflow.is_locked && (
                      <p className="text-sm text-muted-foreground mb-4">
                        This is a default workflow template. Customize it to fit your collection strategy.
                      </p>
                    )}
                  </CardContent>
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
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                              {step.step_order}
                            </div>
                            <div>
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
                          <Badge variant={step.is_active ? "default" : "secondary"}>
                            {step.is_active ? "Active" : "Inactive"}
                          </Badge>
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
    </Layout>
  );
};

export default AIWorkflows;
