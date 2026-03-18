import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface WorkflowSettings {
  id: string;
  name: string;
  description: string;
  aging_bucket: string;
}

interface WorkflowSettingsEditorProps {
  workflow: WorkflowSettings | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: Partial<WorkflowSettings>) => Promise<void>;
}

const WorkflowSettingsEditor = ({ workflow, open, onOpenChange, onSave }: WorkflowSettingsEditorProps) => {
  const [formData, setFormData] = useState<Partial<WorkflowSettings>>(workflow || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.description?.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
      toast.success("Workflow settings updated");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Workflow Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workflow Name *</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Professional B2B Collection"
            />
            <p className="text-xs text-muted-foreground">
              Give your workflow a clear, descriptive name
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Workflow Description *</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose and approach of this workflow..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This helps you understand the workflow's purpose and strategy
            </p>
          </div>
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

export default WorkflowSettingsEditor;
