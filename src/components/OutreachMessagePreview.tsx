import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, Sparkles, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";

interface OutreachMessagePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  companyName: string;
  amount: number;
  dueDate: string;
  personaKey: string;
  outreachSequence: number;
}

interface DraftData {
  id: string;
  subject: string | null;
  message_body: string;
  status: string;
  step_number: number;
}

const OutreachMessagePreview = ({ 
  open, 
  onOpenChange, 
  invoiceId, 
  invoiceNumber,
  companyName,
  amount,
  dueDate,
  personaKey,
  outreachSequence
}: OutreachMessagePreviewProps) => {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const persona = personaConfig[personaKey];

  useEffect(() => {
    if (open && invoiceId) {
      fetchExistingDraft();
    }
  }, [open, invoiceId]);

  const fetchExistingDraft = async () => {
    setLoading(true);
    try {
      // Always preview from approved templates (or invoice-level override), without creating a draft.
      const { data, error } = await supabase.functions.invoke('generate-outreach-draft', {
        body: {
          invoice_id: invoiceId,
          step_number: outreachSequence,
          preview_only: true,
          use_ai_generation: false,
        }
      });

      if (error) throw error;

      setDraft(null);
      setEditedSubject(data?.email_subject || "");
      setEditedBody(data?.email_body || "");
    } catch (error) {
      console.error("Error loading approved template preview:", error);
      const generatedContent = generateSampleContent();
      setEditedSubject(generatedContent.subject);
      setEditedBody(generatedContent.body);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleContent = () => {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Generate content based on persona tone
    const tones: Record<string, { subject: string; body: string }> = {
      sam: {
        subject: `Friendly Reminder: Invoice ${invoiceNumber} - ${formattedAmount}`,
        body: `Hi there,\n\nI hope this message finds you well! I wanted to reach out regarding invoice ${invoiceNumber} for ${formattedAmount}, which was due on ${formattedDate}.\n\nWould you mind taking a moment to check on this? If you've already sent the payment, please disregard this message.\n\nLet me know if you have any questions!\n\nBest regards`
      },
      james: {
        subject: `Invoice ${invoiceNumber} - Payment Request`,
        body: `Dear ${companyName},\n\nI'm following up on invoice ${invoiceNumber} for ${formattedAmount}, which was due on ${formattedDate}.\n\nPlease arrange payment at your earliest convenience. If there are any issues preventing payment, I'd be happy to discuss.\n\nThank you for your attention to this matter.\n\nBest regards`
      },
      katy: {
        subject: `Important: Outstanding Invoice ${invoiceNumber} - Immediate Attention Required`,
        body: `Dear ${companyName},\n\nThis is a formal notice regarding invoice ${invoiceNumber} for ${formattedAmount}, which is now significantly overdue (original due date: ${formattedDate}).\n\nWe require immediate payment to resolve this matter. Please contact us within 48 hours to discuss payment arrangements.\n\nRegards`
      },
      troy: {
        subject: `Final Notice: Invoice ${invoiceNumber} - ${formattedAmount}`,
        body: `Dear ${companyName},\n\nDespite previous communications, invoice ${invoiceNumber} for ${formattedAmount} remains unpaid since ${formattedDate}.\n\nThis is a final notice before we escalate this matter. Payment must be received within 7 days.\n\nContact us immediately to avoid further action.\n\nRegards`
      },
      jimmy: {
        subject: `Urgent Collection Notice: Invoice ${invoiceNumber}`,
        body: `Dear ${companyName},\n\nThis is an urgent collection notice for invoice ${invoiceNumber} totaling ${formattedAmount}.\n\nThis account is severely past due and requires immediate resolution. Failure to respond may result in referral to collections.\n\nContact our office immediately.\n\nCollections Department`
      },
      rocco: {
        subject: `Final Internal Notice - Invoice ${invoiceNumber}`,
        body: `Dear ${companyName},\n\nThis is our final internal notice regarding the delinquent balance of ${formattedAmount} for invoice ${invoiceNumber}.\n\nWithout payment or a satisfactory payment arrangement within 5 business days, this account will be referred for external collection action.\n\nImmediate action is required.\n\nCollections Department`
      }
    };

    return tones[personaKey] || tones.james;
  };

  const handleEnhanceWithAI = async () => {
    setIsGenerating(true);
    try {
      // Reload preview strictly from approved templates (or invoice override)
      const { data, error } = await supabase.functions.invoke('generate-outreach-draft', {
        body: {
          invoice_id: invoiceId,
          step_number: outreachSequence,
          preview_only: true,
          use_ai_generation: false,
        }
      });

      if (error) throw error;

      setEditedSubject(data?.email_subject || "");
      setEditedBody(data?.email_body || "");
      toast.success("Loaded approved template preview");
    } catch (error) {
      console.error('Error loading approved template preview:', error);
      const generated = generateSampleContent();
      setEditedSubject(generated.subject);
      setEditedBody(generated.body);
      toast.info("Generated sample content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Saving here means: invoice-level template override (no draft row is created).
      const { error } = await supabase
        .from('invoices')
        .update({
          use_custom_template: true,
          custom_template_subject: editedSubject,
          custom_template_body: editedBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success("Saved invoice-level template override");
      setIsEditing(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving invoice-level override:', error);
      toast.error("Failed to save override");
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span>Outreach Preview</span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {persona && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted">
                  <PersonaAvatar persona={persona} size="xs" />
                  <span className="text-xs font-medium">{persona.name}</span>
                </div>
              )}
              <Badge variant="outline">Step {outreachSequence}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice Context */}
            <div className="p-3 sm:p-4 bg-muted rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                Invoice Details:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Company:</strong> {companyName}</div>
                <div><strong>Invoice:</strong> #{invoiceNumber}</div>
                <div><strong>Amount:</strong> {formatCurrency(amount)}</div>
                <div><strong>Due Date:</strong> {new Date(dueDate).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel Edit" : "Edit"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnhanceWithAI}
                disabled={isGenerating}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating ? "Loading..." : "Reload approved template"}
              </Button>
            </div>

            {/* Email Content */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                  <Badge variant="outline">Email</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isEditing ? (
                    <Input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      placeholder="Email subject"
                      className="font-medium"
                    />
                  ) : (
                    <div className="p-3 bg-accent rounded border">
                      <p className="font-medium">{editedSubject || "No subject"}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Body</p>
                    {isEditing ? (
                      <Textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        placeholder="Email body"
                        className="min-h-[200px]"
                      />
                    ) : (
                      <div className="p-4 bg-background rounded border">
                        <div className="whitespace-pre-wrap text-sm">
                          {editedBody}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          {isEditing && (
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutreachMessagePreview;
