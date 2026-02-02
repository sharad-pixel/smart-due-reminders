import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  Clock, 
  Send, 
  Sparkles, 
  Loader2, 
  Save,
  Check,
  Calendar,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CampaignOutreachEmail {
  id: string;
  campaign_id: string;
  step_number: number;
  day_offset: number;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CampaignOutreachWorkflowProps {
  campaignId: string;
  campaignName: string;
  pricingTier?: string | null;
}

const WORKFLOW_STEPS = [
  { step: 0, dayOffset: 0, label: "Day 0 - Welcome", description: "Initial introduction email sent immediately after assignment" },
  { step: 1, dayOffset: 3, label: "Day 3 - Follow-up", description: "First follow-up to gauge interest and engagement" },
  { step: 2, dayOffset: 7, label: "Day 7 - Final Touch", description: "Last outreach with special offer or call-to-action" },
];

export function CampaignOutreachWorkflow({ 
  campaignId, 
  campaignName,
  pricingTier 
}: CampaignOutreachWorkflowProps) {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailForms, setEmailForms] = useState<Record<number, { subject: string; body_html: string; body_text: string }>>({
    0: { subject: "", body_html: "", body_text: "" },
    1: { subject: "", body_html: "", body_text: "" },
    2: { subject: "", body_html: "", body_text: "" },
  });

  // Fetch existing outreach emails for this campaign
  const { data: outreachEmails = [], isLoading } = useQuery({
    queryKey: ["campaign-outreach-emails", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_outreach_emails")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("step_number");
      if (error) throw error;
      
      // Update form state with existing data
      const forms: Record<number, { subject: string; body_html: string; body_text: string }> = {
        0: { subject: "", body_html: "", body_text: "" },
        1: { subject: "", body_html: "", body_text: "" },
        2: { subject: "", body_html: "", body_text: "" },
      };
      
      (data || []).forEach((email: CampaignOutreachEmail) => {
        forms[email.step_number] = {
          subject: email.subject || "",
          body_html: email.body_html || "",
          body_text: email.body_text || "",
        };
      });
      setEmailForms(forms);
      
      return data as CampaignOutreachEmail[];
    },
  });

  // Save email draft mutation
  const saveEmailMutation = useMutation({
    mutationFn: async ({ stepNumber, dayOffset, form }: { stepNumber: number; dayOffset: number; form: typeof emailForms[0] }) => {
      const existingEmail = outreachEmails.find(e => e.step_number === stepNumber);
      
      if (existingEmail) {
        const { error } = await supabase
          .from("campaign_outreach_emails")
          .update({
            subject: form.subject,
            body_html: form.body_html,
            body_text: form.body_text || null,
          })
          .eq("id", existingEmail.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campaign_outreach_emails")
          .insert({
            campaign_id: campaignId,
            step_number: stepNumber,
            day_offset: dayOffset,
            subject: form.subject,
            body_html: form.body_html,
            body_text: form.body_text || null,
            status: "draft",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Email draft saved");
      queryClient.invalidateQueries({ queryKey: ["campaign-outreach-emails", campaignId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Approve step mutation
  const approveStepMutation = useMutation({
    mutationFn: async (stepNumber: number) => {
      const existingEmail = outreachEmails.find(e => e.step_number === stepNumber);
      if (!existingEmail) {
        throw new Error("Please save the draft first");
      }
      
      const { error } = await supabase
        .from("campaign_outreach_emails")
        .update({ status: "approved" })
        .eq("id", existingEmail.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email step approved");
      queryClient.invalidateQueries({ queryKey: ["campaign-outreach-emails", campaignId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Generate AI email content
  const handleGenerateEmail = async (stepNumber: number) => {
    setIsGenerating(true);
    try {
      const stepInfo = WORKFLOW_STEPS[stepNumber];
      const tierName = pricingTier ? pricingTier.replace("_", " ") : "general";
      
      const prompts: Record<number, string> = {
        0: `Welcome email for ${campaignName} campaign targeting ${tierName} tier prospects. Introduce Recouply.ai's AI-powered accounts receivable automation. Be warm and professional.`,
        1: `Follow-up email for ${campaignName} campaign. Reference the initial email and highlight key benefits like automated collections, AI-generated outreach, and time savings. Create urgency.`,
        2: `Final outreach email for ${campaignName} campaign. Include a compelling call-to-action, possibly a limited-time offer. Make it clear this is the last planned outreach.`,
      };

      const { data, error } = await supabase.functions.invoke("generate-marketing-email", {
        body: {
          email_type: stepNumber === 0 ? "outreach" : stepNumber === 1 ? "follow_up" : "promotion",
          topic: prompts[stepNumber],
          tone: "professional",
        },
      });

      if (error) throw error;
      if (data?.email) {
        setEmailForms(prev => ({
          ...prev,
          [stepNumber]: {
            subject: data.email.subject || "",
            body_html: data.email.body_html || "",
            body_text: data.email.body_text || "",
          },
        }));
        toast.success("Email content generated!");
      }
    } catch (err) {
      console.error("Generate error:", err);
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveStep = (stepNumber: number) => {
    const stepConfig = WORKFLOW_STEPS[stepNumber];
    const form = emailForms[stepNumber];
    
    if (!form.subject || !form.body_html) {
      toast.error("Subject and body are required");
      return;
    }
    
    saveEmailMutation.mutate({ 
      stepNumber, 
      dayOffset: stepConfig.dayOffset, 
      form 
    });
  };

  const getStepStatus = (stepNumber: number): "empty" | "draft" | "approved" | "active" => {
    const email = outreachEmails.find(e => e.step_number === stepNumber);
    if (!email) return "empty";
    return email.status as "draft" | "approved" | "active";
  };

  const getStepStatusBadge = (status: string) => {
    switch (status) {
      case "empty":
        return <Badge variant="outline" className="text-xs">Not Created</Badge>;
      case "draft":
        return <Badge variant="secondary" className="text-xs">Draft</Badge>;
      case "approved":
        return <Badge className="text-xs bg-green-100 text-green-800">Approved</Badge>;
      case "active":
        return <Badge className="text-xs bg-blue-100 text-blue-800">Active</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Workflow Overview */}
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium text-sm">3-Step Outreach Workflow</p>
          <p className="text-xs text-muted-foreground">
            Automated email sequence: Day 0 → Day 3 → Day 7
          </p>
        </div>
        <div className="flex gap-2">
          {WORKFLOW_STEPS.map((step) => {
            const status = getStepStatus(step.step);
            return (
              <div
                key={step.step}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  status === "approved" || status === "active"
                    ? "bg-green-100 text-green-800"
                    : status === "draft"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span>Day {step.dayOffset}</span>
                {(status === "approved" || status === "active") && (
                  <Check className="h-3 w-3" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Tabs */}
      <Tabs value={String(activeStep)} onValueChange={(v) => setActiveStep(Number(v))}>
        <TabsList className="w-full grid grid-cols-3">
          {WORKFLOW_STEPS.map((step) => (
            <TabsTrigger key={step.step} value={String(step.step)} className="relative">
              <Clock className="h-4 w-4 mr-1" />
              {step.label}
              <span className="ml-2">
                {getStepStatusBadge(getStepStatus(step.step))}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {WORKFLOW_STEPS.map((step) => (
          <TabsContent key={step.step} value={String(step.step)} className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{step.label}</CardTitle>
                    <CardDescription className="text-xs">{step.description}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateEmail(step.step)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Generate with AI
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="Enter email subject..."
                    value={emailForms[step.step]?.subject || ""}
                    onChange={(e) => setEmailForms(prev => ({
                      ...prev,
                      [step.step]: { ...prev[step.step], subject: e.target.value }
                    }))}
                  />
                </div>
                
                <div>
                  <Label>Email Body (HTML)</Label>
                  <Textarea
                    placeholder="Enter email content... Use {{user_name}} for personalization."
                    value={emailForms[step.step]?.body_html || ""}
                    onChange={(e) => setEmailForms(prev => ({
                      ...prev,
                      [step.step]: { ...prev[step.step], body_html: e.target.value }
                    }))}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>

                <div>
                  <Label>Plain Text Version (Optional)</Label>
                  <Textarea
                    placeholder="Plain text fallback..."
                    value={emailForms[step.step]?.body_text || ""}
                    onChange={(e) => setEmailForms(prev => ({
                      ...prev,
                      [step.step]: { ...prev[step.step], body_text: e.target.value }
                    }))}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveStep(step.step)}
                    disabled={saveEmailMutation.isPending}
                  >
                    {saveEmailMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save Draft
                  </Button>
                  
                  {getStepStatus(step.step) === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => approveStepMutation.mutate(step.step)}
                      disabled={approveStepMutation.isPending}
                    >
                      {approveStepMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Approve Step
                    </Button>
                  )}
                  
                  {getStepStatus(step.step) === "approved" && (
                    <Badge className="bg-green-100 text-green-800 self-center">
                      <Check className="h-3 w-3 mr-1" />
                      Ready to Send
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
