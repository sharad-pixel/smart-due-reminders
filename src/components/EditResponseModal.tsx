import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Link, FileText, Globe } from "lucide-react";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CollectionTask;
  initialSubject: string;
  initialBody: string;
  recipientEmail: string;
  onSent?: () => void;
}

export function EditResponseModal({
  open,
  onOpenChange,
  task,
  initialSubject,
  initialBody,
  recipientEmail,
  onSent,
}: EditResponseModalProps) {
  const [sendTo, setSendTo] = useState(recipientEmail);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isSending, setIsSending] = useState(false);

  // Fetch user's smart response settings for quick inserts
  const handleQuickInsert = async (type: "w9" | "invoice" | "portal") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from("smart_response_settings")
        .select("w9_document_url, ar_portal_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: branding } = await supabase
        .from("branding_settings")
        .select("stripe_payment_link")
        .eq("user_id", user.id)
        .maybeSingle();

      let insertText = "";
      if (type === "w9" && settings?.w9_document_url) {
        insertText = `\n\nW9 Document: ${settings.w9_document_url}`;
      } else if (type === "portal" && (settings?.ar_portal_url || branding?.stripe_payment_link)) {
        insertText = `\n\nPayment Portal: ${settings?.ar_portal_url || branding?.stripe_payment_link}`;
      } else if (type === "invoice") {
        // Get invoice link if available
        const taskData = task as any;
        if (taskData.invoices?.integration_url) {
          insertText = `\n\nView Invoice: ${taskData.invoices.integration_url}`;
        } else {
          toast.info("No invoice link available");
          return;
        }
      }

      if (insertText) {
        setBody((prev) => prev + insertText);
        toast.success("Link inserted");
      } else {
        toast.info(`No ${type} link configured. Set it in Smart Response Settings.`);
      }
    } catch (error) {
      console.error("Error inserting link:", error);
    }
  };

  const handleSend = async () => {
    if (!sendTo || !sendTo.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter a message body");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-task-response", {
        body: {
          task_id: task.id,
          subject: subject,
          body: body,
          send_to: sendTo,
          was_edited: true,
        },
      });

      if (error) throw error;

      toast.success(`Response sent to ${data.sent_to}`);
      onOpenChange(false);
      onSent?.();
    } catch (error: any) {
      console.error("Error sending response:", error);
      toast.error("Failed to send response");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Response</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="send-to">To</Label>
            <Input
              id="send-to"
              type="email"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Re: Subject line"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Your response message..."
              className="font-mono text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Quick Insert:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickInsert("w9")}
            >
              <FileText className="h-3 w-3 mr-1" />
              W9 Link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickInsert("invoice")}
            >
              <Link className="h-3 w-3 mr-1" />
              Invoice Link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickInsert("portal")}
            >
              <Globe className="h-3 w-3 mr-1" />
              Portal Link
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Response
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
