import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HelpCircle, Loader2 } from "lucide-react";

interface NeedHelpDialogProps {
  trigger?: React.ReactNode;
}

export const NeedHelpDialog = ({ trigger }: NeedHelpDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "",
    urgency: "medium",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.description || !form.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.functions.invoke("nicolas-escalate-support", {
        body: {
          user_id: user?.id,
          user_email: user?.email,
          user_name: user?.user_metadata?.full_name || user?.email,
          page_route: "/dashboard",
          question: form.subject,
          issue_description: form.description,
          issue_category: form.category,
          escalation_reason: "User submitted support ticket",
          urgency: form.urgency,
        },
      });

      if (error) throw error;

      toast.success("Support ticket submitted! Our team will get back to you soon.");
      setForm({ subject: "", description: "", category: "", urgency: "medium" });
      setOpen(false);
    } catch (err: any) {
      console.error("Error submitting ticket:", err);
      toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Need Help?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit a Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue and our team will get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="setup">Setup & Onboarding</SelectItem>
                <SelectItem value="integrations">Integrations</SelectItem>
                <SelectItem value="billing">Billing & Account</SelectItem>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="urgency">Priority</Label>
            <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High - Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Brief summary of your issue"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
