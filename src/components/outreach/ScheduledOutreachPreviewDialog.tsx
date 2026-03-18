import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersonaAvatar } from "@/components/ai/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { Mail, Check, Save } from "lucide-react";
import { toast } from "sonner";

interface ScheduledItem {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  company_name: string;
  amount: number;
  scheduled_date: string;
  persona_key: string;
  source_type: 'invoice_workflow' | 'account_level';
  status: 'pending_approval' | 'approved';
  subject?: string;
  message_body?: string;
  step_number?: number;
}

interface ScheduledOutreachPreviewDialogProps {
  previewItem: ScheduledItem | null;
  onClose: () => void;
  onApprove: (item: ScheduledItem) => void;
  onRefresh: () => void;
}

// Convert HTML to plain text for display
const stripHtmlTags = (html: string): string => {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
};

export function ScheduledOutreachPreviewDialog({
  previewItem,
  onClose,
  onApprove,
  onRefresh,
}: ScheduledOutreachPreviewDialogProps) {
  const [previewSubject, setPreviewSubject] = useState(previewItem?.subject || '');
  const [previewBody, setPreviewBody] = useState(previewItem?.message_body || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when previewItem changes
  if (previewItem && previewSubject !== previewItem.subject && !isEditing) {
    setPreviewSubject(previewItem.subject || '');
    setPreviewBody(previewItem.message_body || '');
  }

  const handleSavePreview = async () => {
    if (!previewItem) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('ai_drafts')
        .update({
          subject: previewSubject,
          message_body: previewBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', previewItem.id);

      if (error) throw error;
      toast.success("Draft updated");
      onClose();
      setIsEditing(false);
      onRefresh();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!previewItem} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span>Draft Preview</span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {previewItem && personaConfig[previewItem.persona_key] && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted">
                  <PersonaAvatar persona={previewItem.persona_key} size="xs" />
                  <span className="text-xs font-medium">{personaConfig[previewItem.persona_key].name}</span>
                </div>
              )}
              {previewItem && (
                <Badge variant={previewItem.status === 'approved' ? 'default' : 'secondary'}>
                  {previewItem.status === 'approved' ? 'Approved' : 'Pending'}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {previewItem && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Account:</strong> {previewItem.company_name}</div>
                <div><strong>Type:</strong> {previewItem.source_type === 'account_level' ? 'Account Level' : 'Invoice Workflow'}</div>
                {previewItem.invoice_number && (
                  <div><strong>Invoice:</strong> #{previewItem.invoice_number}</div>
                )}
                <div><strong>Amount:</strong> {formatCurrency(previewItem.amount)}</div>
                <div><strong>Scheduled:</strong> {format(new Date(previewItem.scheduled_date), "MMM d, yyyy")}</div>
                {previewItem.step_number && (
                  <div><strong>Step:</strong> {previewItem.step_number}</div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? "Cancel Edit" : "Edit"}
              </Button>
              {previewItem.status === 'pending_approval' && (
                <Button
                  size="sm"
                  onClick={() => {
                    onApprove(previewItem);
                    onClose();
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Subject</CardTitle>
                  <Badge variant="outline">Email</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <Input
                    value={previewSubject}
                    onChange={(e) => setPreviewSubject(e.target.value)}
                    placeholder="Email subject"
                    className="font-medium"
                  />
                ) : (
                  <div className="p-3 bg-accent rounded border">
                    <p className="font-medium">{previewSubject || "No subject"}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Body</p>
                  {isEditing ? (
                    <Textarea
                      value={previewBody}
                      onChange={(e) => setPreviewBody(e.target.value)}
                      placeholder="Email body"
                      className="min-h-[200px]"
                    />
                  ) : (
                    <div className="p-4 bg-background rounded border max-h-[300px] overflow-y-auto">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {stripHtmlTags(previewBody) || "No content"}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
          {isEditing && (
            <Button onClick={handleSavePreview} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
