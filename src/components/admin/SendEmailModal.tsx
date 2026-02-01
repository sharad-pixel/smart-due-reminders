import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Sparkles, Mail, Loader2, Save, AlertTriangle } from "lucide-react";

interface Lead {
  id: string;
  email: string;
  name: string | null;
  status: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Lead[];
  campaigns?: Campaign[];
  defaultCampaignId?: string | null;
  onSuccess?: () => void;
}

export function SendEmailModal({
  open,
  onOpenChange,
  selectedLeads,
  campaigns = [],
  defaultCampaignId = null,
  onSuccess,
}: SendEmailModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: "", body_html: "", body_text: "" });
  const [aiPrompt, setAiPrompt] = useState({ topic: "", tone: "professional", email_type: "outreach" });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(defaultCampaignId);

  // Filter out unsubscribed leads
  const activeLeads = selectedLeads.filter(l => l.status !== "unsubscribed");
  const unsubscribedLeads = selectedLeads.filter(l => l.status === "unsubscribed");

  const handleGenerateEmail = async () => {
    if (!aiPrompt.topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-marketing-email", {
        body: {
          email_type: aiPrompt.email_type,
          topic: aiPrompt.topic,
          tone: aiPrompt.tone,
        },
      });

      if (error) throw error;
      if (data?.email) {
        setEmailForm({
          subject: data.email.subject || "",
          body_html: data.email.body_html || "",
          body_text: data.email.body_text || "",
        });
        toast.success("Email content generated!");
      }
    } catch (err) {
      console.error("Generate error:", err);
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!emailForm.subject.trim() || !emailForm.body_html.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    setIsSavingDraft(true);
    try {
      const { error } = await supabase
        .from("email_broadcasts")
        .insert({
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text || null,
          audience: "specific_emails",
          status: "draft",
          total_recipients: activeLeads.length,
          campaign_id: selectedCampaignId,
        });

      if (error) throw error;

      toast.success("Draft saved successfully");
      onOpenChange(false);
      setEmailForm({ subject: "", body_html: "", body_text: "" });
      onSuccess?.();
    } catch (err) {
      console.error("Save draft error:", err);
      toast.error("Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSendEmail = async (testMode = false) => {
    if (!emailForm.subject.trim() || !emailForm.body_html.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    if (!testMode && activeLeads.length === 0) {
      toast.error("No eligible leads to send to (all are unsubscribed)");
      return;
    }

    setIsSending(true);
    try {
      const targetEmails = activeLeads.map(l => l.email);

      // Create broadcast record with campaign link
      const { data: broadcast, error: broadcastError } = await supabase
        .from("email_broadcasts")
        .insert({
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text || null,
          audience: "specific_emails",
          status: testMode ? "draft" : "sending",
          total_recipients: testMode ? 1 : targetEmails.length,
          campaign_id: selectedCampaignId,
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      // Send via edge function
      const { error: sendError } = await supabase.functions.invoke("send-broadcast-email", {
        body: {
          broadcast_id: broadcast.id,
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text,
          audience: "specific_emails",
          specific_emails: testMode ? undefined : targetEmails,
          test_mode: testMode,
        },
      });

      if (sendError) throw sendError;

      // Update last_engaged_at for sent leads and campaign stats
      if (!testMode) {
        await supabase
          .from("marketing_leads")
          .update({ last_engaged_at: new Date().toISOString() })
          .in("email", targetEmails);

        // Update campaign emails_sent count
        if (selectedCampaignId) {
          const { data: campaign } = await supabase
            .from("marketing_campaigns")
            .select("emails_sent")
            .eq("id", selectedCampaignId)
            .single();

          await supabase
            .from("marketing_campaigns")
            .update({ emails_sent: (campaign?.emails_sent || 0) + targetEmails.length })
            .eq("id", selectedCampaignId);
        }
      }

      toast.success(testMode ? "Test email sent to your email" : `Email sent to ${targetEmails.length} leads`);
      
      if (!testMode) {
        onOpenChange(false);
        setEmailForm({ subject: "", body_html: "", body_text: "" });
        onSuccess?.();
      }
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to Selected Leads
          </DialogTitle>
          <DialogDescription>
            Compose and send an email to {activeLeads.length} selected lead{activeLeads.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Campaign Selector */}
        {campaigns.length > 0 && (
          <div className="flex items-center gap-3 py-2 border-b">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Assign to Campaign:</Label>
            <Select
              value={selectedCampaignId || "none"}
              onValueChange={(v) => setSelectedCampaignId(v === "none" ? null : v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select campaign (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Campaign</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Recipient Summary */}
        <div className="flex flex-wrap gap-2 py-2 border-b">
          <span className="text-sm text-muted-foreground">Recipients:</span>
          <ScrollArea className="max-h-20 flex-1">
            <div className="flex flex-wrap gap-1">
              {activeLeads.slice(0, 10).map(lead => (
                <Badge key={lead.id} variant="secondary" className="text-xs">
                  {lead.name || lead.email}
                </Badge>
              ))}
              {activeLeads.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{activeLeads.length - 10} more
                </Badge>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Unsubscribed Warning */}
        {unsubscribedLeads.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                {unsubscribedLeads.length} unsubscribed lead{unsubscribedLeads.length !== 1 ? "s" : ""} excluded
              </p>
              <p className="text-amber-700 text-xs mt-1">
                {unsubscribedLeads.map(l => l.email).join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Email Composer */}
        <Tabs defaultValue="manual" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="manual">
              <Mail className="h-4 w-4 mr-2" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="flex-1 overflow-auto space-y-4 mt-4">
            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                placeholder="Enter email subject..."
                value={emailForm.subject}
                onChange={(e) => setEmailForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="body">Email Body (HTML)</Label>
              <Textarea
                id="body"
                placeholder="Enter email content... Use {{user_name}} for personalization."
                value={emailForm.body_html}
                onChange={(e) => setEmailForm(f => ({ ...f, body_html: e.target.value }))}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="body_text">Plain Text Version (Optional)</Label>
              <Textarea
                id="body_text"
                placeholder="Plain text fallback..."
                value={emailForm.body_text}
                onChange={(e) => setEmailForm(f => ({ ...f, body_text: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Email Type</Label>
                <Select
                  value={aiPrompt.email_type}
                  onValueChange={(v) => setAiPrompt(p => ({ ...p, email_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outreach">Outreach</SelectItem>
                    <SelectItem value="product_update">Product Update</SelectItem>
                    <SelectItem value="feature_announcement">Feature Announcement</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tone</Label>
                <Select
                  value={aiPrompt.tone}
                  onValueChange={(v) => setAiPrompt(p => ({ ...p, tone: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Topic / Prompt</Label>
              <Textarea
                placeholder="Describe what you want to communicate..."
                value={aiPrompt.topic}
                onChange={(e) => setAiPrompt(p => ({ ...p, topic: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            <Button onClick={handleGenerateEmail} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Email
            </Button>

            {emailForm.subject && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <p className="font-medium mb-2">{emailForm.subject}</p>
                <div 
                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: emailForm.body_html }}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0 pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleSaveDraft}
            disabled={isSavingDraft || !emailForm.subject || !emailForm.body_html}
          >
            {isSavingDraft ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSendEmail(true)}
            disabled={isSending || !emailForm.subject || !emailForm.body_html}
          >
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Send Test
          </Button>
          <Button 
            onClick={() => handleSendEmail(false)}
            disabled={isSending || !emailForm.subject || !emailForm.body_html || activeLeads.length === 0}
          >
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {activeLeads.length} Lead{activeLeads.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
