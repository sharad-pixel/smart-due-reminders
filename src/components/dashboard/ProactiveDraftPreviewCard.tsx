import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Send, Edit2, Save, X, Trash2 } from "lucide-react";
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

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  due_soon: { label: "Reminder", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  newly_past_due: { label: "Follow-Up", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  gone_silent: { label: "Re-Engage", color: "bg-red-500/10 text-red-600 border-red-200" },
};

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

  const cat = CATEGORY_CONFIG[draft.category || ""] || CATEGORY_CONFIG.gone_silent;

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
        .update({ subject: editSubject, message_body: editBody, updated_at: new Date().toISOString() })
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
    if (!sendDate) { toast.error("Pick a send date first"); return; }
    setProcessing(true);
    try {
      const [hours, minutes] = sendTime.split(":").map(Number);
      const scheduledAt = new Date(sendDate);
      scheduledAt.setHours(hours, minutes, 0, 0);
      if (scheduledAt <= new Date()) { toast.error("Must be in the future"); setProcessing(false); return; }

      const { error } = await supabase
        .from("ai_drafts")
        .update({ status: "approved", recommended_send_date: scheduledAt.toISOString().split("T")[0], updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      if (error) throw error;
      toast.success("Scheduled", { description: `${format(scheduledAt, "MMM d")} at ${format(scheduledAt, "h:mm a")}` });
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
      if (!session?.session?.access_token) { toast.error("Please sign in"); setProcessing(false); return; }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from("ai_drafts")
          .update({ subject: editSubject, message_body: editBody, updated_at: new Date().toISOString() })
          .eq("id", draft.id);
        if (updateError) throw updateError;
        setIsEditing(false);
      }

      const { error } = await supabase
        .from("ai_drafts")
        .update({ status: "approved", recommended_send_date: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      if (error) throw error;

      const { error: sendError } = await supabase.functions.invoke("send-ai-draft", {
        body: { draft_id: draft.id, outreach_category: "proactive" },
      });

      if (sendError) {
        toast.error("Draft approved — will send in next cycle");
      } else {
        toast.success("Sent successfully");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Send className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm truncate">
                {draft.company_name || "Outreach Draft"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {draft.invoice_number && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  INV #{draft.invoice_number}
                </Badge>
              )}
              <Badge className={cn("text-[10px] px-1.5 py-0 border", cat.color)}>
                {cat.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {/* Subject */}
          {isEditing ? (
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Subject line"
              className="text-sm h-8"
            />
          ) : (
            <p className="text-sm font-medium text-foreground leading-snug">
              {draft.subject || "No subject"}
            </p>
          )}

          {/* Body */}
          {isEditing ? (
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={8}
              className="font-mono text-xs leading-relaxed resize-none"
            />
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto border border-border/30">
              {stripHtmlTags(draft.message_body)}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
          {isEditing ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={processing} className="h-8 text-xs">
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={processing} className="h-8 text-xs">
                <Save className="h-3.5 w-3.5 mr-1" /> {processing ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Schedule row */}
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-8 text-xs flex-1 justify-start", !sendDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {sendDate ? format(sendDate, "MMM d, yyyy") : "Schedule date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={sendDate}
                      onSelect={setSendDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Select value={sendTime} onValueChange={setSendTime}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleScheduleSend}
                  disabled={processing || !sendDate}
                  className="h-8 text-xs whitespace-nowrap"
                >
                  {processing ? "…" : "Schedule"}
                </Button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={processing} className="h-7 text-xs text-destructive hover:text-destructive px-2">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleStartEdit} disabled={processing} className="h-7 text-xs px-2">
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSendNow}
                  disabled={processing}
                  className="h-8 text-xs gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {processing ? "Sending…" : "Send Now"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
