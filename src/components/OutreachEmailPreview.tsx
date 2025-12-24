import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, Sparkles, Save, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OutreachEmailPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  companyName: string;
  debtorName: string;
  amount: number;
  dueDate: string;
  agingBucket: string;
  outreachSequence: number;
  onSaved?: () => void;
}

const OutreachEmailPreview = ({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  companyName,
  debtorName,
  amount,
  dueDate,
  agingBucket,
  outreachSequence,
  onSaved,
}: OutreachEmailPreviewProps) => {
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOrGenerateDraft();
    }
  }, [open, invoiceId, outreachSequence]);

  const fetchOrGenerateDraft = async () => {
    setLoading(true);
    try {
      // Check if there's an existing draft for this invoice/step
      const { data: existingDraft, error } = await supabase
        .from("ai_drafts")
        .select("id, subject, message_body, step_number")
        .eq("invoice_id", invoiceId)
        .eq("step_number", outreachSequence)
        .maybeSingle();

      if (error) throw error;

      if (existingDraft) {
        setDraftId(existingDraft.id);
        setSubject(existingDraft.subject || "");
        setBody(existingDraft.message_body || "");
      } else {
        // Generate a template-based default
        const defaultSubject = `Payment Reminder for Invoice #${invoiceNumber}`;
        const defaultBody = `Dear ${debtorName || companyName},

This is a friendly reminder regarding Invoice #${invoiceNumber} for ${formatCurrency(amount)}, which was due on ${formatDate(dueDate)}.

We kindly request that you process this payment at your earliest convenience.

If you have already made this payment, please disregard this notice and accept our thanks.

If you have any questions or need to discuss payment arrangements, please don't hesitate to contact us.

Best regards,
Accounts Receivable Team`;

        setSubject(defaultSubject);
        setBody(defaultBody);
        setDraftId(null);
      }
      setHasChanges(false);
    } catch (error) {
      console.error("Error fetching draft:", error);
      toast.error("Failed to load email content");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleEnhanceWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-outreach-draft', {
        body: {
          invoice_id: invoiceId,
          aging_bucket: agingBucket,
          step_number: outreachSequence,
          tone: 'professional',
        }
      });

      if (error) throw error;

      if (data?.subject) setSubject(data.subject);
      if (data?.message_body) setBody(data.message_body);
      if (data?.draft_id) setDraftId(data.draft_id);
      
      setHasChanges(true);
      toast.success("Email enhanced with AI");
    } catch (error) {
      console.error('Error enhancing with AI:', error);
      toast.error("Failed to enhance with AI - using template");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (draftId) {
        // Update existing draft
        const { error } = await supabase
          .from("ai_drafts")
          .update({
            subject,
            message_body: body,
            status: 'pending_approval',
          })
          .eq("id", draftId);

        if (error) throw error;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("ai_drafts")
          .insert({
            user_id: user.id,
            invoice_id: invoiceId,
            step_number: outreachSequence,
            subject,
            message_body: body,
            channel: 'email',
            status: 'pending_approval',
            recommended_send_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (error) throw error;
        setDraftId(data.id);
      }

      setHasChanges(false);
      toast.success("Email saved successfully");
      onSaved?.();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save email");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    setHasChanges(true);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    setHasChanges(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview - Step {outreachSequence}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice Context */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Customer:</strong> {companyName}</div>
                <div><strong>Invoice:</strong> #{invoiceNumber}</div>
                <div><strong>Amount:</strong> {formatCurrency(amount)}</div>
                <div><strong>Due Date:</strong> {formatDate(dueDate)}</div>
              </div>
            </div>

            {/* Email Editor */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Email Content</CardTitle>
                  <div className="flex items-center gap-2">
                    {draftId && (
                      <Badge variant="outline" className="text-xs">
                        Draft Saved
                      </Badge>
                    )}
                    <Badge variant="secondary">Step {outreachSequence}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Subject
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    placeholder="Email subject"
                    className="font-medium"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Body
                  </label>
                  <Textarea
                    value={body}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    placeholder="Email body"
                    className="min-h-[250px] font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <div className="flex gap-2 w-full sm:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleEnhanceWithAI}
                  disabled={isGenerating || loading}
                  className="flex-1 sm:flex-none"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Enhance with AI
                </Button>
              </TooltipTrigger>
              <TooltipContent>Use AI to improve this email</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 sm:flex-none"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close without saving</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || loading || !hasChanges}
                  className="flex-1 sm:flex-none"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Draft
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save as pending draft</TooltipContent>
            </Tooltip>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutreachEmailPreview;
