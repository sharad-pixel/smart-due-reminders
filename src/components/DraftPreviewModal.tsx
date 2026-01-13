import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { getPersonaByName } from "@/lib/personaConfig";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ToneGauge } from "@/components/ToneGauge";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DraftPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: {
    id: string;
    channel: string;
    subject: string | null;
    message_body: string;
    persona_name?: string;
    invoice_number?: string;
    system_prompt?: string;
    user_prompt?: string;
  } | null;
  onApprove: (draftId: string) => Promise<void>;
  onEdit: (draftId: string, subject: string, body: string) => Promise<void>;
  onDiscard: (draftId: string) => Promise<void>;
  onRegenerate?: (draftId: string, toneIntensity?: number) => Promise<void>;
}

export const DraftPreviewModal = ({
  open,
  onOpenChange,
  draft,
  onApprove,
  onEdit,
  onDiscard,
  onRegenerate
}: DraftPreviewModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [processing, setProcessing] = useState(false);
  const [toneIntensity, setToneIntensity] = useState(3); // 1-5, 3 is standard
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!draft) return null;

  const persona = draft.persona_name ? getPersonaByName(draft.persona_name) : null;

  const handleRegenerateWithTone = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(draft.id, toneIntensity);
      toast.success("Draft regenerated with new tone");
    } catch (error) {
      toast.error("Failed to regenerate draft");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleEdit = () => {
    setEditSubject(draft.subject || "");
    setEditBody(draft.message_body);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setProcessing(true);
    try {
      await onEdit(draft.id, editSubject, editBody);
      setIsEditing(false);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await onApprove(draft.id);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleDiscard = async () => {
    setProcessing(true);
    try {
      await onDiscard(draft.id);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  // Convert HTML to plain text for display
  const stripHtmlTags = (html: string): string => {
    // Replace <br/> and </p><p> with newlines
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n');
    // Remove any remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Clean up extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  };

  const formattedMessageBody = stripHtmlTags(draft.message_body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Generated Draft</DialogTitle>
          {draft.invoice_number && (
            <DialogDescription>
              Invoice #{draft.invoice_number}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Channel</Label>
            <Badge className="ml-2">{draft.channel.toUpperCase()}</Badge>
          </div>

          {/* Tone Gauge for regeneration */}
          {onRegenerate && !isEditing && (
            <div className="p-4 bg-muted/50 rounded-lg border">
              <ToneGauge 
                value={toneIntensity} 
                onChange={setToneIntensity}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 w-full"
                onClick={handleRegenerateWithTone}
                disabled={isRegenerating || processing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? "Regenerating..." : "Regenerate with New Tone"}
              </Button>
            </div>
          )}

          {draft.channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              {isEditing ? (
                <Input
                  id="subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />
              ) : (
                <div className="p-3 bg-muted rounded-md text-sm">
                  {draft.subject || "No subject"}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            {isEditing ? (
              <Textarea
                id="message"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            ) : (
              <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap leading-relaxed">
                {formattedMessageBody}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={processing}>
                {processing ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleDiscard} disabled={processing}>
                Discard
              </Button>
              <Button variant="outline" onClick={handleEdit} disabled={processing}>
                Edit
              </Button>
              {/* Removed standalone regenerate button - using tone gauge instead */}
              <Button onClick={handleApprove} disabled={processing}>
                {processing ? "Approving..." : "Approve & Send"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
