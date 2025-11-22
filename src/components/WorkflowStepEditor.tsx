import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface WorkflowStep {
  id: string;
  step_order: number;
  day_offset: number;
  channel: "email" | "sms";
  label: string;
  subject_template?: string;
  body_template: string;
  sms_template?: string;
  ai_template_type: string;
}

interface WorkflowStepEditorProps {
  step: WorkflowStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (step: WorkflowStep) => Promise<void>;
}

const WorkflowStepEditor = ({ step, open, onOpenChange, onSave }: WorkflowStepEditorProps) => {
  const [formData, setFormData] = useState<Partial<WorkflowStep>>(step || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.label || formData.day_offset === undefined || !formData.body_template) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await onSave(formData as WorkflowStep);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving step:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Workflow Step</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Step Label *</Label>
            <Input
              id="label"
              value={formData.label || ""}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Initial Reminder"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day_offset">Days Past Due *</Label>
            <Input
              id="day_offset"
              type="number"
              value={formData.day_offset ?? ""}
              onChange={(e) => setFormData({ ...formData, day_offset: parseInt(e.target.value) })}
              placeholder="e.g., 7"
            />
            <p className="text-xs text-muted-foreground">
              Trigger this step when invoice reaches this many days past due
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai_template_type">AI Template Type *</Label>
            <Select
              value={formData.ai_template_type || "reminder"}
              onValueChange={(value) => setFormData({ ...formData, ai_template_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reminder">Friendly Reminder</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
                <SelectItem value="urgent">Urgent Notice</SelectItem>
                <SelectItem value="final">Final Notice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject_template">Email Subject Template</Label>
              <Input
                id="subject_template"
                value={formData.subject_template || ""}
                onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                placeholder="e.g., Reminder: Invoice {invoice_number} is now {days_past_due} days overdue"
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {"{invoice_number}"}, {"{days_past_due}"}, {"{amount}"}, {"{debtor_name}"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="body_template">
              {formData.channel === "email" ? "Email Body Template *" : "Message Template *"}
            </Label>
            <Textarea
              id="body_template"
              value={formData.body_template || ""}
              onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
              placeholder={`Provide context and instructions for the AI to generate the message.\n\nExample:\n"Generate a professional reminder about the overdue invoice. Mention the invoice number, amount, and original due date. Include a clear call-to-action to pay or contact us if there are issues."`}
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              This template guides the AI in generating the actual message content
            </p>
          </div>

          {formData.channel === "sms" && (
            <div className="space-y-2">
              <Label htmlFor="sms_template">SMS Template</Label>
              <Textarea
                id="sms_template"
                value={formData.sms_template || ""}
                onChange={(e) => setFormData({ ...formData, sms_template: e.target.value })}
                placeholder="Keep it brief and direct for SMS"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowStepEditor;
