import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send, Edit, XCircle, Eye, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditResponseModal } from "@/components/EditResponseModal";

interface SmartResponseSectionProps {
  task: CollectionTask;
  onResponseSent?: () => void;
}

export function SmartResponseSection({ task, onResponseSent }: SmartResponseSectionProps) {
  const [isSending, setIsSending] = useState(false);
  const [isIgnoring, setIsIgnoring] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);

  const responseStatus = task.response_status || "pending";
  const suggestedSubject = task.suggested_response_subject;
  const suggestedBody = task.suggested_response_body;
  const responseSentAt = task.response_sent_at;
  const responseSentTo = task.response_sent_to;
  const originalEmailFrom = task.from_email;

  // No response available
  if (!suggestedSubject && !suggestedBody && responseStatus === "pending") {
    return null;
  }

  const handleSendResponse = async () => {
    if (!suggestedSubject || !suggestedBody) {
      toast.error("No response content available");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-task-response", {
        body: {
          task_id: task.id,
          subject: suggestedSubject,
          body: suggestedBody,
          send_to: originalEmailFrom,
          was_edited: false,
        },
      });

      if (error) throw error;

      toast.success(`Response sent to ${data.sent_to}`);
      onResponseSent?.();
    } catch (error: any) {
      console.error("Error sending response:", error);
      toast.error("Failed to send response");
    } finally {
      setIsSending(false);
    }
  };

  const handleIgnoreResponse = async () => {
    setIsIgnoring(true);
    try {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ response_status: "ignored" })
        .eq("id", task.id);

      if (error) throw error;
      toast.success("Response skipped");
      onResponseSent?.();
    } catch (error: any) {
      console.error("Error ignoring response:", error);
      toast.error("Failed to update status");
    } finally {
      setIsIgnoring(false);
    }
  };

  const handleRegenerateResponse = async () => {
    toast.info("Response regeneration coming soon");
  };

  // Response already sent
  if (responseStatus === "sent" || responseStatus === "edited_sent") {
    return (
      <div className="space-y-2 pt-3 border-t">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Smart Response
          </h4>
          <Badge variant="default" className="bg-green-600 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {responseStatus === "edited_sent" ? "Edited & Sent" : "Sent"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Sent to {responseSentTo} on {format(new Date(responseSentAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setShowFullBody(true)} className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          View Sent Response
        </Button>
        
        {showFullBody && (
          <Card className="mt-2">
            <CardContent className="p-3 text-sm">
              <p className="font-medium mb-2">Subject: {suggestedSubject}</p>
              <div className="whitespace-pre-wrap text-muted-foreground">{suggestedBody}</div>
              <Button variant="ghost" size="sm" onClick={() => setShowFullBody(false)} className="mt-2">
                Hide
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Response was ignored/skipped
  if (responseStatus === "ignored") {
    return (
      <div className="space-y-2 pt-3 border-t">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Smart Response
          </h4>
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Skipped
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Response was not sent for this task
        </p>
        <Button variant="outline" size="sm" onClick={handleRegenerateResponse} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Generate New Response
        </Button>
      </div>
    );
  }

  // Pending - show preview and actions
  const truncatedBody = suggestedBody && suggestedBody.length > 200 
    ? suggestedBody.substring(0, 200) + "..." 
    : suggestedBody;

  return (
    <>
      <div className="space-y-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Smart Response
          </h4>
          <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="text-xs h-7">
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">To:</span> {originalEmailFrom || "Unknown"}
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Subject:</span> {suggestedSubject}
            </div>
            <div className="border-t pt-2 mt-2">
              <p className="text-sm whitespace-pre-wrap">
                {showFullBody ? suggestedBody : truncatedBody}
              </p>
              {suggestedBody && suggestedBody.length > 200 && (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setShowFullBody(!showFullBody)}
                  className="text-xs p-0 h-auto mt-1"
                >
                  {showFullBody ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleSendResponse}
            disabled={isSending}
            className="flex-1"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Send Response
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEditModal(true)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit & Send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleIgnoreResponse}
            disabled={isIgnoring}
          >
            {isIgnoring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <EditResponseModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        task={task}
        initialSubject={suggestedSubject || ""}
        initialBody={suggestedBody || ""}
        recipientEmail={originalEmailFrom || ""}
        onSent={onResponseSent}
      />
    </>
  );
}
