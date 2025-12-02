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
import { Workflow, Mail, MessageSquare, Clock, Pencil, Settings, Sparkles, Trash2, BarChart3, Eye, Zap, PlayCircle, Loader2, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import WorkflowStepEditor from "@/components/WorkflowStepEditor";
import WorkflowSettingsEditor from "@/components/WorkflowSettingsEditor";
import WorkflowGraph from "@/components/WorkflowGraph";
import MessagePreview from "@/components/MessagePreview";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { personaConfig } from "@/lib/personaConfig";
import { cn } from "@/lib/utils";

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
  auto_generate_drafts?: boolean;
  steps: WorkflowStep[];
}

const agingBuckets = [
  { value: "current", label: "Current (0 days)", description: "Not yet overdue" },
  { value: "dpd_1_30", label: "1-30 Days Past Due", description: "Early stage collection" },
  { value: "dpd_31_60", label: "31-60 Days Past Due", description: "Mid-stage collection" },
  { value: "dpd_61_90", label: "61-90 Days Past Due", description: "Late stage collection" },
  { value: "dpd_91_120", label: "91-120 Days Past Due", description: "Final collection efforts" },
  { value: "dpd_120_plus", label: "121+ Days Past Due", description: "Critical collection stage" },
];

interface DraftsByPersona {
  [personaId: string]: {
    persona: any;
    drafts: any[];
  };
}

const AIWorkflows = () => {
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState("dpd_1_30");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({});
  const [stepInvoiceCounts, setStepInvoiceCounts] = useState<Record<string, Record<number, number>>>({});
  const [stepDraftCounts, setStepDraftCounts] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [previewStep, setPreviewStep] = useState<{
    stepId: string;
    channel: "email" | "sms";
    subject?: string;
    body: string;
    agingBucket?: string;
    dayOffset?: number;
  } | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [draftsByPersona, setDraftsByPersona] = useState<DraftsByPersona>({});
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [autoSending, setAutoSending] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [generatingPersonaDrafts, setGeneratingPersonaDrafts] = useState(false);
  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [stepInvoices, setStepInvoices] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchWorkflows();
    fetchInvoiceCounts();
    fetchDraftsByPersona();
    fetchStepInvoiceCounts();
    fetchStepDraftCounts();
  }, []);

  const fetchInvoiceCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch invoices grouped by days past due
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, due_date')
        .eq('user_id', user.id)
        .in('status', ['Open', 'InPaymentPlan']);

      if (error) throw error;

      // Calculate counts per persona bucket range
      const counts: Record<string, number> = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      invoices?.forEach(invoice => {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Find matching persona
        Object.entries(personaConfig).forEach(([key, persona]) => {
          if (daysPastDue >= persona.bucketMin && 
              (!persona.bucketMax || daysPastDue <= persona.bucketMax)) {
            counts[key] = (counts[key] || 0) + 1;
          }
        });
      });

      setBucketCounts(counts);
    } catch (error) {
      console.error("Error fetching invoice counts:", error);
    }
  };

  const fetchStepInvoiceCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all open invoices with bucket_entered_at
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, due_date, aging_bucket, bucket_entered_at, created_at')
        .eq('user_id', user.id)
        .in('status', ['Open', 'InPaymentPlan']);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count invoices per persona per step (based on days since entering bucket)
      const stepCounts: Record<string, Record<number, number>> = {};

      invoices?.forEach(invoice => {
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Find matching persona
        Object.entries(personaConfig).forEach(([personaKey, persona]) => {
          if (daysPastDue >= persona.bucketMin && 
              (!persona.bucketMax || daysPastDue <= persona.bucketMax)) {
            
            if (!stepCounts[personaKey]) {
              stepCounts[personaKey] = {};
            }

            // Calculate which step based on days since entering bucket
            const bucketEnteredDate = new Date(invoice.bucket_entered_at || invoice.created_at);
            bucketEnteredDate.setHours(0, 0, 0, 0);
            const daysSinceEntered = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

            // Map to step (1-5 based on day offsets: 3, 7, 14, 21, 30)
            let step = 1;
            if (daysSinceEntered >= 30) step = 5;
            else if (daysSinceEntered >= 21) step = 4;
            else if (daysSinceEntered >= 14) step = 3;
            else if (daysSinceEntered >= 7) step = 2;

            stepCounts[personaKey][step] = (stepCounts[personaKey][step] || 0) + 1;
          }
        });
      });

      setStepInvoiceCounts(stepCounts);
    } catch (error) {
      console.error("Error fetching step invoice counts:", error);
    }
  };

  const fetchStepDraftCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all approved templates with workflow info
      const { data: templates, error } = await supabase
        .from('draft_templates')
        .select(`
          id,
          workflow_step_id,
          aging_bucket,
          status,
          collection_workflow_steps!inner(workflow_id)
        `)
        .eq('user_id', user.id)
        .eq('channel', 'email')
        .eq('status', 'approved');

      if (error) throw error;

      // Count approved templates per bucket per workflow_step_id
      // Store as { bucket: { workflow_id: { step_id: count } } }
      const draftCounts: Record<string, Record<string, Record<string, number>>> = {};

      templates?.forEach(template => {
        const bucket = template.aging_bucket;
        const workflowId = template.collection_workflow_steps?.workflow_id;
        
        if (!bucket || !workflowId) return;
        
        if (!draftCounts[bucket]) {
          draftCounts[bucket] = {};
        }
        if (!draftCounts[bucket][workflowId]) {
          draftCounts[bucket][workflowId] = {};
        }

        const stepId = template.workflow_step_id;
        draftCounts[bucket][workflowId][stepId] = (draftCounts[bucket][workflowId][stepId] || 0) + 1;
      });

      setStepDraftCounts(draftCounts);
    } catch (error) {
      console.error("Error fetching step draft counts:", error);
    }
  };

  const fetchInvoicesForStep = async (stepId: string, dayOffset: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          bucket_entered_at,
          created_at,
          debtors(company_name, email)
        `)
        .eq('user_id', user.id)
        .eq('aging_bucket', selectedBucket)
        .in('status', ['Open', 'InPaymentPlan']);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter invoices that match this step's day offset
      const matchingInvoices = invoices?.filter(invoice => {
        const bucketEnteredDate = new Date(invoice.bucket_entered_at || invoice.created_at);
        bucketEnteredDate.setHours(0, 0, 0, 0);
        const daysSinceEntered = Math.floor((today.getTime() - bucketEnteredDate.getTime()) / (1000 * 60 * 60 * 24));

        // Check if invoice is in the range for this step
        if (dayOffset === 3) return daysSinceEntered >= 3 && daysSinceEntered < 7;
        if (dayOffset === 7) return daysSinceEntered >= 7 && daysSinceEntered < 14;
        if (dayOffset === 14) return daysSinceEntered >= 14 && daysSinceEntered < 21;
        if (dayOffset === 21) return daysSinceEntered >= 21 && daysSinceEntered < 30;
        if (dayOffset === 30) return daysSinceEntered >= 30;
        return false;
      }) || [];

      setStepInvoices(prev => ({
        ...prev,
        [stepId]: matchingInvoices
      }));
    } catch (error) {
      console.error("Error fetching step invoices:", error);
    }
  };

  const toggleStepExpansion = async (stepId: string, dayOffset: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
      // Fetch invoices if not already loaded
      if (!stepInvoices[stepId]) {
        await fetchInvoicesForStep(stepId, dayOffset);
      }
    }
    setExpandedSteps(newExpanded);
  };

  const fetchDraftsByPersona = async () => {
    setLoadingDrafts(true);
    try {
      const { data: templates, error } = await supabase
        .from('draft_templates')
        .select(`
          *,
          ai_agent_personas(id, name, persona_summary, bucket_min, bucket_max),
          collection_workflow_steps!inner(label, step_order, day_offset, workflow_id)
        `)
        .eq('channel', 'email')
        .in('status', ['pending_approval', 'approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group templates by persona and workflow
      const grouped: DraftsByPersona = {};
      templates?.forEach(template => {
        if (template.agent_persona_id && template.ai_agent_personas) {
          if (!grouped[template.agent_persona_id]) {
            grouped[template.agent_persona_id] = {
              persona: template.ai_agent_personas,
              drafts: []
            };
          }
          // Store template with workflow_id from the step
          grouped[template.agent_persona_id].drafts.push({
            ...template,
            step_workflow_id: template.collection_workflow_steps?.workflow_id
          });
        }
      });

      setDraftsByPersona(grouped);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast.error("Failed to load templates");
    } finally {
      setLoadingDrafts(false);
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

  const handleGenerateBucketDrafts = async (agingBucket: string) => {
    setGeneratingDrafts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template-drafts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ aging_bucket: agingBucket }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate templates');
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(
          `Generated ${result.templates_created} template${result.templates_created !== 1 ? 's' : ''}`,
          { duration: 5000 }
        );
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} occurred during generation`);
        }
        
        // Refresh templates after generation
        await fetchDraftsByPersona();
        await fetchStepDraftCounts();
      }
    } catch (error: any) {
      console.error('Error generating templates:', error);
      toast.error(error.message || "Failed to generate templates");
    } finally {
      setGeneratingDrafts(false);
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

  const handlePreviewMessage = (step: WorkflowStep, workflow?: Workflow) => {
    setPreviewStep({
      stepId: step.id,
      channel: step.channel,
      subject: step.subject_template,
      body: step.body_template,
      agingBucket: workflow?.aging_bucket || selectedBucket,
      dayOffset: step.day_offset,
    });
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

  const handleManualReassignment = async () => {
    setReassigning(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-workflow-reassignment');

      if (error) throw error;

      if (data?.summary) {
        toast.success(
          `Reassignment complete: ${data.summary.reassigned} invoices reassigned, ${data.summary.skipped} skipped, ${data.summary.errors} errors`,
          { duration: 6000 }
        );
      } else {
        toast.success("Workflow reassignment completed successfully");
      }

      // Refresh invoice counts
      await fetchInvoiceCounts();
      await fetchStepInvoiceCounts();
    } catch (error: any) {
      console.error('Manual reassignment error:', error);
      toast.error(error.message || "Failed to reassign workflows");
    } finally {
      setReassigning(false);
    }
  };

  const handleAutoSendApprovedDrafts = async () => {
    setAutoSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-template-based-messages');

      if (error) throw error;

      if (data?.sent > 0) {
        toast.success(
          `Sent ${data.sent} personalized message${data.sent !== 1 ? 's' : ''}${data.skipped > 0 ? `, skipped ${data.skipped}` : ''}`,
          { duration: 6000 }
        );
      } else {
        toast.info("No messages ready to send (check if invoices match template day offsets)");
      }

      if (data?.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} error${data.errors.length !== 1 ? 's' : ''} occurred`);
      }

      // Refresh templates after sending
      await fetchDraftsByPersona();
      await fetchStepDraftCounts();
    } catch (error: any) {
      console.error('Auto-send error:', error);
      toast.error(error.message || "Failed to send messages");
    } finally {
      setAutoSending(false);
    }
  };

  const handleGeneratePersonaDrafts = async (personaName: string) => {
    const persona = Object.values(personaConfig).find(p => p.name === personaName);
    if (!persona) return;

    // Determine aging bucket from persona bucket range
    let agingBucket = '';
    if (persona.bucketMin === 1 && persona.bucketMax === 30) agingBucket = 'dpd_1_30';
    else if (persona.bucketMin === 31 && persona.bucketMax === 60) agingBucket = 'dpd_31_60';
    else if (persona.bucketMin === 61 && persona.bucketMax === 90) agingBucket = 'dpd_61_90';
    else if (persona.bucketMin === 91 && persona.bucketMax === 120) agingBucket = 'dpd_91_120';
    else if (persona.bucketMin === 121) agingBucket = 'dpd_120_plus';

    if (!agingBucket) {
      toast.error("Could not determine aging bucket for this persona");
      return;
    }

    setGeneratingPersonaDrafts(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-template-drafts', {
        body: { aging_bucket: agingBucket }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Generated ${data.templates_created} template${data.templates_created !== 1 ? 's' : ''} for ${personaName}`,
          { duration: 5000 }
        );
        
        if (data.errors && data.errors.length > 0) {
          toast.warning(`${data.errors.length} error${data.errors.length !== 1 ? 's' : ''} occurred during generation`);
        }
      } else {
        toast.info(data.message || 'No templates were created');
      }

      await fetchDraftsByPersona();
      await fetchStepDraftCounts();
    } catch (error: any) {
      console.error('Generate templates error:', error);
      toast.error(error.message || "Failed to generate templates");
    } finally {
      setGeneratingPersonaDrafts(false);
    }
  };

  const handleApproveDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('draft_templates')
        .update({ status: 'approved' })
        .eq('id', draftId);

      if (error) throw error;

      toast.success('Template approved - will auto-send to matching invoices');
      await fetchDraftsByPersona();
      await fetchStepDraftCounts();
    } catch (error: any) {
      console.error('Error approving template:', error);
      toast.error('Failed to approve template');
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('draft_templates')
        .update({ status: 'discarded' })
        .eq('id', draftId);

      if (error) throw error;

      toast.success('Template discarded');
      await fetchDraftsByPersona();
      await fetchStepDraftCounts();
    } catch (error: any) {
      console.error('Error discarding template:', error);
      toast.error('Failed to discard template');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('draft_templates')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      toast.success('Template deleted');
      await fetchDraftsByPersona();
      await fetchStepDraftCounts();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleRegenerateDraft = async (draftId: string, agingBucket: string) => {
    try {
      // First delete the existing draft
      const { error: deleteError } = await supabase
        .from('draft_templates')
        .delete()
        .eq('id', draftId);

      if (deleteError) throw deleteError;

      // Then regenerate
      await handleGenerateBucketDrafts(agingBucket);
    } catch (error: any) {
      console.error('Error regenerating template:', error);
      toast.error('Failed to regenerate template');
    }
  };

  const [editingDraft, setEditingDraft] = useState<{id: string, subject: string, body: string} | null>(null);

  const handleEditDraft = (draftId: string, subject: string, body: string) => {
    setEditingDraft({ id: draftId, subject, body });
  };

  const handleSaveDraftEdit = async () => {
    if (!editingDraft) return;

    try {
      const { error } = await supabase
        .from('draft_templates')
        .update({ 
          subject_template: editingDraft.subject,
          message_body_template: editingDraft.body 
        })
        .eq('id', editingDraft.id);

      if (error) throw error;

      toast.success('Template updated');
      setEditingDraft(null);
      await fetchDraftsByPersona();
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const toggleDraftExpanded = (draftId: string) => {
    setExpandedDrafts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(draftId)) {
        newSet.delete(draftId);
      } else {
        newSet.add(draftId);
      }
      return newSet;
    });
  };

  const handleSetupDefaultWorkflow = async (aging_bucket: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-default-workflows', {
        body: { aging_bucket },
      });

      if (error) throw error;

      toast.success(data.message || "Default workflow created successfully");
      await fetchWorkflows();
    } catch (error: any) {
      console.error('Setup default workflow error:', error);
      toast.error(error.message || "Failed to create default workflow");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (personaKey: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const persona = personaConfig[personaKey];
      if (!persona) throw new Error("Invalid persona");

      // Find or create workflow for this persona's bucket
      const agingBucket = `dpd_${persona.bucketMin}_${persona.bucketMax || 'plus'}`;
      
      let workflowId = selectedWorkflow?.id;

      // If no workflow exists for this bucket, create one
      if (!selectedWorkflow) {
        const { data: newWorkflow, error: createError } = await supabase
          .from("collection_workflows")
          .insert({
            user_id: user.id,
            aging_bucket: agingBucket,
            name: `${persona.name}'s Workflow - ${persona.description}`,
            description: `AI-powered collection workflow managed by ${persona.name}`,
            is_active: false,
            is_locked: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        workflowId = newWorkflow.id;
      } else {
        // Delete existing steps
        const { error: deleteError } = await supabase
          .from("collection_workflow_steps")
          .delete()
          .eq("workflow_id", selectedWorkflow.id);

        if (deleteError) throw deleteError;
      }

      // Create 5 predefined email steps based on persona tone
      const steps = [
        { day_offset: 3, label: "Initial Reminder", channel: "email" as const },
        { day_offset: 7, label: "Follow-up Notice", channel: "email" as const },
        { day_offset: 14, label: "Urgent Payment Request", channel: "email" as const },
        { day_offset: 21, label: "Final Notice", channel: "email" as const },
        { day_offset: 30, label: "Critical Action Required", channel: "email" as const },
      ];

      const newSteps = steps.map((step, index) => ({
        workflow_id: workflowId,
        step_order: index + 1,
        day_offset: step.day_offset,
        channel: step.channel,
        label: step.label,
        trigger_type: "relative_to_due",
        ai_template_type: persona.tone,
        body_template: `AI-generated ${persona.tone} collection message`,
        subject_template: step.channel === "email" ? `Payment reminder for invoice {{invoice_number}}` : null,
        sms_template: null,
        is_active: true,
        requires_review: true,
      }));

      const { error: insertError } = await supabase
        .from("collection_workflow_steps")
        .insert(newSteps);

      if (insertError) throw insertError;

      await fetchWorkflows();
      toast.success(`${persona.name}'s workflow configured successfully`);
    } catch (error: any) {
      toast.error("Failed to configure workflow");
      console.error(error);
    }
  };

  // Prioritize active workflows for the selected bucket
  const selectedWorkflow = workflows
    .filter(w => w.aging_bucket === selectedBucket)
    .sort((a, b) => {
      // Active workflows first
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return 0;
    })[0];

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
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">AI Workflows</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
              Configure automated AI-powered collection outreach by aging bucket
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleAutoSendApprovedDrafts}
              disabled={autoSending}
              className="flex items-center space-x-2"
            >
              <Mail className="h-4 w-4" />
              <span>{autoSending ? "Sending..." : "Send Templates Now"}</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleManualReassignment}
              disabled={reassigning}
              className="flex items-center space-x-2"
            >
              <Workflow className="h-4 w-4" />
              <span>{reassigning ? "Reassigning..." : "Reassign All"}</span>
            </Button>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              AI Collections Agents
            </CardTitle>
            <CardDescription className="text-base">
              Your team of AI agents automatically adapts messaging based on invoice age
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pb-6">
            <TooltipProvider>
              <div className="flex justify-evenly items-center">
                {Object.entries(personaConfig).map(([key, persona]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedPersona(persona.name)}
                        className={cn(
                          "flex flex-col items-center gap-2 cursor-pointer transition-all hover:scale-105 p-2 rounded-lg",
                          selectedPersona === persona.name && "bg-primary/10 ring-2 ring-primary"
                        )}
                      >
                        <PersonaAvatar persona={persona} size="lg" />
                        <div className="text-center">
                          <p className="text-xs font-semibold">{persona.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days
                          </p>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: persona.color }}
                          />
                          <p className="font-semibold">{persona.name}</p>
                        </div>
                        <p className="text-sm">{persona.description}</p>
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs font-medium mb-1">Coverage:</p>
                          <Badge variant="outline" className="text-xs">
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Tone:</span> {persona.tone}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* AI Drafts by Persona */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Draft Templates by Collection Agent
                </CardTitle>
                <CardDescription>
                  {selectedPersona 
                    ? `Viewing templates for ${selectedPersona}` 
                    : 'Click on a collection agent above to view their draft templates'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {selectedPersona && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedPersona(null)}
                  >
                    View All
                  </Button>
                )}
                {selectedWorkflow && (
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="workflow-active-drafts" className="text-sm">
                      {selectedWorkflow.is_active ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                      id="workflow-active-drafts"
                      checked={selectedWorkflow.is_active}
                      onCheckedChange={(checked) => toggleWorkflow(selectedWorkflow.id, checked)}
                      disabled={selectedWorkflow.is_locked}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDrafts ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !selectedPersona ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-muted-foreground">Select a collection agent above to view their templates</p>
              </div>
            ) : (() => {
              // Find the matching persona from draftsByPersona
              const matchingEntry = Object.entries(draftsByPersona).find(
                ([_, { persona }]) => persona.name === selectedPersona
              );
              
              if (!matchingEntry) {
                // No drafts for this persona
                return (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-muted-foreground">
                      No draft templates found for {selectedPersona}
                    </p>
                    <Button 
                      onClick={() => handleGeneratePersonaDrafts(selectedPersona)}
                      disabled={generatingPersonaDrafts}
                    >
                      {generatingPersonaDrafts ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Templates for {selectedPersona}
                        </>
                      )}
                    </Button>
                  </div>
                );
              }

              const [personaId, { persona, drafts }] = matchingEntry;
              const personaInfo = Object.values(personaConfig).find(p => p.name === persona.name);

              // Filter drafts to only show those belonging to the selected workflow
              const filteredDrafts = drafts.filter((template: any) => 
                template.step_workflow_id === selectedWorkflow?.id
              );

              if (filteredDrafts.length === 0) {
                return (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-muted-foreground">
                      No draft templates found for {selectedPersona} in the currently selected workflow
                    </p>
                    <Button 
                      onClick={() => handleGeneratePersonaDrafts(selectedPersona)}
                      disabled={generatingPersonaDrafts}
                    >
                      {generatingPersonaDrafts ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Templates for {selectedPersona}
                        </>
                      )}
                    </Button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      {personaInfo && <PersonaAvatar persona={personaInfo} size="md" />}
                      <div className="flex-1">
                        <h3 className="font-semibold">{persona.name}</h3>
                        <p className="text-sm text-muted-foreground">{persona.bucket_min}-{persona.bucket_max || "+"} days past due</p>
                      </div>
                      <Badge variant="outline">{filteredDrafts.length} template{filteredDrafts.length === 1 ? '' : 's'}</Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {filteredDrafts.map((template: any) => {
                        const isExpanded = expandedDrafts.has(template.id);
                        const stepInfo = template.collection_workflow_steps;
                        return (
                          <Card key={template.id} className="bg-card border">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <p className="font-medium text-sm">
                                      {stepInfo?.label || `Step ${template.step_number}`} - Day {template.day_offset}
                                    </p>
                                    <Badge variant="secondary" className="text-xs">
                                      {template.channel}
                                    </Badge>
                                    <Badge variant={template.status === 'approved' ? 'default' : 'outline'} className="text-xs">
                                      {template.status}
                                    </Badge>
                                  </div>
                                  {template.channel === 'email' && template.subject_template && (
                                    <p className="text-xs font-medium mt-2 truncate">
                                      {template.subject_template}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Template will auto-send to all invoices in {template.aging_bucket}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleDraftExpanded(template.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>

                              {isExpanded && (
                                <div className="space-y-3 pt-3 border-t">
                                  {editingDraft?.id === template.id ? (
                                    <div className="space-y-3">
                                      {template.channel === 'email' && (
                                        <div className="space-y-2">
                                          <Label className="text-xs">Subject</Label>
                                          <input
                                            type="text"
                                            value={editingDraft.subject}
                                            onChange={(e) => setEditingDraft({ ...editingDraft, subject: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border rounded-md"
                                          />
                                        </div>
                                      )}
                                      <div className="space-y-2">
                                        <Label className="text-xs">Message Body</Label>
                                        <textarea
                                          value={editingDraft.body}
                                          onChange={(e) => setEditingDraft({ ...editingDraft, body: e.target.value })}
                                          rows={8}
                                          className="w-full px-3 py-2 text-sm border rounded-md whitespace-pre-wrap"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={handleSaveDraftEdit}
                                        >
                                          Save Changes
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEditingDraft(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                                        {template.message_body_template}
                                      </div>
                                      {template.status === 'pending_approval' && (
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => handleApproveDraft(template.id)}
                                            className="flex-1"
                                          >
                                            <Check className="h-3 w-3 mr-1" />
                                            Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDiscardDraft(template.id)}
                                            className="flex-1"
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            Discard
                                          </Button>
                                        </div>
                                      )}
                                      {template.status === 'approved' && (
                                        <div className="flex items-center justify-center">
                                          <Badge variant="default">
                                            <Check className="h-3 w-3 mr-1" />
                                            Approved - Auto-sending enabled
                                          </Badge>
                                        </div>
                                      )}
                                      <div className="flex gap-2 pt-2 border-t">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditDraft(template.id, template.subject_template || '', template.message_body_template)}
                                        >
                                          <Pencil className="h-3 w-3 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleRegenerateDraft(template.id, template.aging_bucket)}
                                        >
                                          <Sparkles className="h-3 w-3 mr-1" />
                                          Regenerate
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteDraft(template.id)}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Delete
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Automatic Template-Based Sending</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  When you approve draft templates, they will automatically send personalized emails to all invoices in that aging bucket based on the cadence (days since invoice entered bucket). 
                  Templates are personalized with invoice-specific data for each debtor. Runs daily at 2 AM UTC.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Automatic Workflow Assignment</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Invoices are automatically assigned to workflows based on their aging bucket when created. 
                  Every day at 2 AM UTC, all invoices are checked and reassigned to the appropriate workflow as they age. 
                  You can also manually trigger reassignment using the "Reassign All" button above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Invoice Count by Collection Agent */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Invoices by Collection Agent</CardTitle>
              <CardDescription>Open invoices grouped by AI agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(personaConfig).map(([key, persona]) => {
                const invoiceCount = bucketCounts[key] || 0;
                const bucket = agingBuckets.find(b => {
                  if (persona.bucketMin === 1 && persona.bucketMax === 30) return b.value === 'dpd_1_30';
                  if (persona.bucketMin === 31 && persona.bucketMax === 60) return b.value === 'dpd_31_60';
                  if (persona.bucketMin === 61 && persona.bucketMax === 90) return b.value === 'dpd_61_90';
                  if (persona.bucketMin === 91 && persona.bucketMax === 120) return b.value === 'dpd_91_120';
                  if (persona.bucketMin === 121) return b.value === 'dpd_120_plus';
                  return false;
                });

                return (
                  <div
                    key={key}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PersonaAvatar persona={persona} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{persona.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}
                      </Badge>
                    </div>
                    {bucket && (
                      <button
                        onClick={() => setSelectedBucket(bucket.value)}
                        className={cn(
                          "w-full text-xs py-1.5 px-2 rounded border transition-colors mt-2",
                          selectedBucket === bucket.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-muted/70"
                        )}
                      >
                        View {bucket.label} Workflow
                      </button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Workflow Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {selectedWorkflow ? (
              <>
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
                        {/* Show selected persona */}
                        {(() => {
                          const persona = Object.entries(personaConfig).find(([_, p]) => {
                            const bucketLabel = `dpd_${p.bucketMin}_${p.bucketMax || 'plus'}`;
                            return bucketLabel === selectedBucket || 
                                   (selectedBucket === 'dpd_1_30' && p.bucketMin === 1 && p.bucketMax === 30) ||
                                   (selectedBucket === 'dpd_31_60' && p.bucketMin === 31 && p.bucketMax === 60) ||
                                   (selectedBucket === 'dpd_61_90' && p.bucketMin === 61 && p.bucketMax === 90) ||
                                   (selectedBucket === 'dpd_91_120' && p.bucketMin === 91 && p.bucketMax === 120) ||
                                   (selectedBucket === 'dpd_120_plus' && p.bucketMin >= 121);
                          });
                          
                          return persona && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                              <div className="flex items-center gap-3">
                                <PersonaAvatar persona={persona[1]} size="md" />
                                <div>
                                  <p className="font-semibold text-lg">{persona[1].name}</p>
                                  <p className="text-sm text-muted-foreground">{persona[1].description}</p>
                                  <Badge variant="outline" className="mt-1">
                                    {persona[1].bucketMin}-{persona[1].bucketMax || "+"} Days Past Due
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="space-y-4">
                          {selectedWorkflow.steps
                            ?.sort((a, b) => a.step_order - b.step_order)
                            .filter((step) => {
                              // Only show steps that have approved templates
                              const stepDraftCount = stepDraftCounts[selectedBucket]?.[selectedWorkflow.id]?.[step.id] || 0;
                              return stepDraftCount > 0;
                            })
                            .map((step) => {
                            // Check if this step has an approved template for the SELECTED workflow
                            const stepDraftCount = stepDraftCounts[selectedBucket]?.[selectedWorkflow.id]?.[step.id] || 0;
                            const hasApprovedTemplate = stepDraftCount > 0;
                            const isExpanded = expandedSteps.has(step.id);
                            const invoices = stepInvoices[step.id] || [];
                            
                            return (
                            <div
                              key={step.id}
                              className="border rounded-lg"
                            >
                              <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                                <div className="flex items-center space-x-4 flex-1">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                                    {step.step_order}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{step.label}</p>
                                      {hasApprovedTemplate && (
                                        <Badge variant="default" className="text-xs">
                                          <Check className="h-3 w-3 mr-1" />
                                          Template Ready
                                        </Badge>
                                      )}
                                    </div>
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleStepExpansion(step.id, step.day_offset)}
                                  >
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Expanded invoices section */}
                              {isExpanded && (
                                <div className="border-t px-4 py-3 bg-muted/30">
                                  <p className="text-sm font-medium mb-3">
                                    Invoices at this stage ({invoices.length})
                                  </p>
                                  {invoices.length > 0 ? (
                                    <div className="space-y-2">
                                      {invoices.map((invoice: any) => (
                                        <div
                                          key={invoice.id}
                                          className="flex items-center justify-between p-2 bg-background rounded border hover:border-primary/50 transition-colors"
                                        >
                                          <div>
                                            <p className="font-medium text-sm">{invoice.invoice_number}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {invoice.debtors?.company_name}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-semibold text-sm">
                                              ${invoice.amount.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Due: {new Date(invoice.due_date).toLocaleDateString()}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No invoices at this stage</p>
                                  )}
                                </div>
                              )}
                            </div>
                           )})}
                          
                          {selectedWorkflow.steps?.filter((step) => {
                            const stepDraftCount = stepDraftCounts[selectedBucket]?.[selectedWorkflow.id]?.[step.id] || 0;
                            return stepDraftCount > 0;
                          }).length === 0 && (
                            <div className="text-center py-8">
                              <p className="text-muted-foreground">
                                No workflow steps with approved templates yet. Generate templates above to get started.
                              </p>
                            </div>
                          )}
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
                      steps={selectedWorkflow.steps?.filter((step) => {
                        // Only show steps with approved templates in graph view
                        const stepDraftCount = stepDraftCounts[selectedBucket]?.[selectedWorkflow.id]?.[step.id] || 0;
                        return stepDraftCount > 0;
                      }) || []}
                      onGenerateContent={!selectedWorkflow.is_locked ? handleGenerateContent : undefined}
                      onPreviewMessage={(step) => handlePreviewMessage(step, selectedWorkflow)}
                      isGenerating={generatingContent}
                      stepInvoiceCounts={(() => {
                        // Find persona key based on aging bucket
                        const persona = Object.entries(personaConfig).find(([_, p]) => {
                          const bucketLabel = `dpd_${p.bucketMin}_${p.bucketMax || 'plus'}`;
                          return bucketLabel === selectedBucket || 
                                 (selectedBucket === 'dpd_1_30' && p.bucketMin === 1 && p.bucketMax === 30) ||
                                 (selectedBucket === 'dpd_31_60' && p.bucketMin === 31 && p.bucketMax === 60) ||
                                 (selectedBucket === 'dpd_61_90' && p.bucketMin === 61 && p.bucketMax === 90) ||
                                 (selectedBucket === 'dpd_91_120' && p.bucketMin === 91 && p.bucketMax === 120) ||
                                 (selectedBucket === 'dpd_120_plus' && p.bucketMin >= 121);
                        });
                        return persona ? stepInvoiceCounts[persona[0]] || {} : {};
                      })()}
                      stepDraftCounts={stepDraftCounts[selectedBucket]?.[selectedWorkflow.id] || {}}
                    />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-2">
                    No workflow configured for this aging bucket yet.
                  </p>
                  {selectedBucket === 'dpd_120_plus' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Create a specialized workflow for critical 121+ day overdue invoices
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={() => handleSetupDefaultWorkflow(selectedBucket)}
                          disabled={loading}
                        >
                          {loading ? "Creating..." : "Create Critical Collections Workflow"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={handleCreateCustomWorkflow}
                    >
                      Create Custom Workflow
                    </Button>
                  )}
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

      <MessagePreview
        open={!!previewStep}
        onOpenChange={(open) => !open && setPreviewStep(null)}
        stepId={previewStep?.stepId || null}
        channel={previewStep?.channel || "email"}
        subject={previewStep?.subject}
        body={previewStep?.body || ""}
        agingBucket={previewStep?.agingBucket}
        dayOffset={previewStep?.dayOffset}
        onContentUpdated={fetchWorkflows}
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
