import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Send, Clock, Edit2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProactiveDraftPreviewCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: {
    id: string;
    subject: string | null;
    message_body: string;
    channel: string;
    invoice_id: string | null;
    invoice_number?: string;
    company_name?: string;
    category?: string;
  } | null;
  onScheduled?: () => void;
}

const stripHtmlTags = (html: string): string => {
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
};

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const hour = h.toString().padStart(2, "0");
  return [
    { value: `${hour}:00`, label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h < 12 ? "AM" : "PM"}` },
    { value: `${hour}:30`, label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}:30 ${h < 12 ? "AM" : "PM"}` },
  ];
}).flat();

export function ProactiveDraftPreviewCard({
  open,
  onOpenChange,
  draft,
  onScheduled,
}: ProactiveDraftPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sendDate, setSendDate] = useState<Date | undefined>(undefined);
  const [sendTime, setSendTime] = useState("09:00");
  const [processing, setProcessing] = useState(false);

  if (!draft) return null;

  const handleStartEdit = () => {
    setEditSubject(draft.subject || "");
    setEditBody(stripHtmlTags(draft.message_body));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("ai_drafts")
        .update({
          subject: editSubject,
          message_body: editBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id);

      if (error) throw error;
      toast.success("Draft updated");
      setIsEditing(false);
    } catch (err: any) {
      toast.error("Failed to save", { description: err?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleScheduleSend = async () => {
    if (!sendDate) {
      toast.error("Please pick a send date");
      return;
    }

    setProcessing(true);
    try {
      // Combine date + time
      const [hours, minutes] = sendTime.split(":").map(Number);
      const scheduledAt = new Date(sendDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      if (scheduledAt <= new Date()) {
        toast.error("Scheduled time must be in the future");
        setProcessing(false);
        return;
      }

      const { error } = await supabase
        .from("ai_drafts")
        .update({
          status: "approved",
          recommended_send_date: scheduledAt.toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id);

      if (error) throw error;

      toast.success("Outreach scheduled", {
        description: `Will be sent on ${format(scheduledAt, "MMM d, yyyy")} at ${format(scheduledAt, "h:mm a")}`,
      });
      onOpenChange(false);
      onScheduled?.();
    } catch (err: any) {
      toast.error("Failed to schedule", { description: err?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNow = async () => {
    setProcessing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Please sign in to continue");
        setProcessing(false);
        return;
      }

      // If edits were made, save them first
      if (isEditing) {
        const { error: updateError } = await supabase
          .from("ai_drafts")
          .update({
            subject: editSubject,
            message_body: editBody,
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.id);
        if (updateError) throw updateError;
        setIsEditing(false);
      }

      // Approve the draft with today's date for immediate sending
      const { error } = await supabase
        .from("ai_drafts")
        .update({
          status: "approved",
          recommended_send_date: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id);

      if (error) throw error;

      // Invoke send-ai-draft to send immediately, bypassing workflow scheduling
      const { data: sendData, error: sendError } = await supabase.functions.invoke("send-ai-draft", {
        body: { draft_id: draft.id, outreach_category: "proactive" },
      });

      if (sendError) {
        console.error("Send now error:", sendError);
        toast.error("Failed to send immediately", {
          description: "Draft is approved and will be sent in the next outreach cycle.",
        });
      } else {
        toast.success("Proactive outreach sent successfully");
      }

      onOpenChange(false);
      onScheduled?.();
    } catch (err: any) {
      toast.error("Failed to send", { description: err?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleDiscard = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("ai_drafts")
        .update({ status: "discarded", updated_at: new Date().toISOString() })
        .eq("id", draft.id);

      if (error) throw error;
      toast.success("Draft discarded");
      onOpenChange(false);
      onScheduled?.();
    } catch (err: any) {
      toast.error("Failed to discard", { description: err?.message });
    } finally {
      setProcessing(false);
    }
  };

  const categoryLabel =
    draft.category === "due_soon"
      ? "Courtesy Reminder"
      : draft.category === "newly_past_due"
        ? "Follow-Up"
        : "Re-Engagement";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Draft Ready — Schedule Send
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            {draft.invoice_number && (
              <Badge variant="outline">INV #{draft.invoice_number}</Badge>
            )}
            {draft.company_name && (
              <span className="text-sm">{draft.company_name}</span>
            )}
            <Badge variant="secondary">{categoryLabel}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
            {isEditing ? (
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="text-sm"
              />
            ) : (
              <div className="p-3 bg-muted rounded-md text-sm font-medium">
                {draft.subject || "No subject"}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Message</Label>
            {isEditing ? (
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            ) : (
              <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {stripHtmlTags(draft.message_body)}
              </div>
            )}
          </div>

          {/* Schedule Send Date/Time */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <Label className="font-medium text-sm">Schedule Send</Label>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !sendDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {sendDate ? format(sendDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={sendDate}
                    onSelect={setSendDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Select value={sendTime} onValueChange={setSendTime}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={processing}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={processing}>
                <Save className="h-4 w-4 mr-1" /> {processing ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={processing} className="text-destructive">
                Discard
              </Button>
              <Button variant="outline" size="sm" onClick={handleStartEdit} disabled={processing}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendNow}
                disabled={processing}
              >
                <Send className="h-4 w-4 mr-1" />
                {processing ? "Sending..." : "Send Now"}
              </Button>
              <Button
                size="sm"
                onClick={handleScheduleSend}
                disabled={processing || !sendDate}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                {processing ? "Scheduling..." : "Schedule Send"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
