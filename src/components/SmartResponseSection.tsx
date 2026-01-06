import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send, Edit, XCircle, Eye, Loader2, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";
import { CollectionTask } from "@/hooks/useCollectionTasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditResponseModal } from "@/components/EditResponseModal";
import { useSmartResponseSettings, getTaskTypeActionKey } from "@/hooks/useSmartResponseSettings";

interface SmartResponseSectionProps {
  task: CollectionTask;
  onResponseSent?: () => void;
}

export function SmartResponseSection({ task, onResponseSent }: SmartResponseSectionProps) {
  const [isSending, setIsSending] = useState(false);
  const [isIgnoring, setIsIgnoring] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);
  const { settings } = useSmartResponseSettings();

  const responseStatus = task.response_status || "pending";
  const suggestedSubject = task.suggested_response_subject;
  const suggestedBody = task.suggested_response_body;
  const responseSentAt = task.response_sent_at;
  const responseSentTo = task.response_sent_to;
  const originalEmailFrom = task.from_email;

  // Check if smart response is enabled for this task type
  const actionKey = getTaskTypeActionKey(task.task_type);
  const actionSetting = actionKey && settings ? settings[actionKey] : 'manual';
  
  // Hide section if action is 'manual' and no response exists and no from_email
  if (!originalEmailFrom && !suggestedSubject && !suggestedBody && responseStatus === "pending") {
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

  const getResponseTemplate = (taskType: string) => {
    const templates: Record<string, { subject: string; bodyTemplate: string }> = {
      'W9_REQUEST': {
        subject: 'Re: W9 Document Request',
        bodyTemplate: 'Thank you for your request. Please find our W9 document at the link provided. If you have any questions, please don\'t hesitate to reach out.'
      },
      'INVOICE_COPY_REQUEST': {
        subject: 'Re: Invoice Copy Request',
        bodyTemplate: 'Here is the invoice information you requested. You can view and download the invoice at the link provided. To make a payment, please visit our portal.'
      },
      'PROMISE_TO_PAY': {
        subject: 'Re: Payment Confirmation',
        bodyTemplate: 'Thank you for confirming your intent to pay. We appreciate your commitment and look forward to receiving your payment. If you need to make a payment now, you can do so through our portal.'
      },
      'PAYMENT_PLAN_REQUEST': {
        subject: 'Re: Payment Plan Discussion',
        bodyTemplate: 'Thank you for reaching out regarding a payment plan. We\'re happy to discuss options that work for your situation. A member of our team will follow up with you within 1-2 business days.'
      },
      'NEEDS_CALLBACK': {
        subject: 'Re: Callback Scheduled',
        bodyTemplate: 'We received your request for a callback. A member of our team will call you within 1-2 business days at the number on file.'
      },
      'DISPUTE': {
        subject: 'Re: Dispute Received',
        bodyTemplate: 'We\'ve received your message and have noted your concerns. Our team will review the details and follow up with you within 2-3 business days.'
      },
      'ALREADY_PAID': {
        subject: 'Re: Payment Verification',
        bodyTemplate: 'Thank you for letting us know about your payment. To help us locate and apply your payment quickly, could you please provide the payment date, method, and amount?'
      }
    };
    return templates[taskType] || {
      subject: 'Re: Your Inquiry',
      bodyTemplate: 'Thank you for your message. We\'ve received your inquiry and a member of our team will respond within 1-2 business days.'
    };
  };

  const handleGenerateResponse = async () => {
    if (!originalEmailFrom) {
      toast.error("No sender email available");
      return;
    }
    
    setIsGenerating(true);
    try {
      const template = getResponseTemplate(task.task_type);
      const debtorName = task.summary?.split(' - ')?.[0]?.replace(/^\w+:?\s*/, '') || 'Customer';
      
      const systemPrompt = `You are a professional accounts receivable representative. Generate a helpful, professional email response to a customer inquiry. 
Be concise, friendly, and helpful. Use the customer's name if provided.
Keep the response under 150 words. Do not include placeholder text like [Your Name] - end naturally.`;

      const userPrompt = `Generate a response email for:
Task Type: ${task.task_type}
Customer: ${debtorName}
Customer Email: ${originalEmailFrom}
Task Details: ${task.details || task.summary}
${task.original_email_body ? `Original Email Content: ${task.original_email_body.substring(0, 500)}` : ''}

Base the response on this template but make it natural:
Subject: ${template.subject}
Body concept: ${template.bodyTemplate}`;

      const { data, error } = await supabase.functions.invoke("regenerate-draft", {
        body: {
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          channel: 'email',
        },
      });

      if (error) throw error;

      // Save the generated response to the task
      const { error: updateError } = await supabase
        .from('collection_tasks')
        .update({
          suggested_response_subject: data.subject || template.subject,
          suggested_response_body: data.message_body,
          response_status: 'pending'
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      toast.success("Response generated!");
      onResponseSent?.();
    } catch (error: any) {
      console.error("Error generating response:", error);
      toast.error("Failed to generate response");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateResponse = async () => {
    await handleGenerateResponse();
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

  // No response generated yet but has from_email - show generate option
  if (!suggestedSubject && !suggestedBody && originalEmailFrom) {
    return (
      <div className="space-y-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Smart Response
          </h4>
          <Badge variant="outline" className="gap-1 text-xs">
            Not Generated
          </Badge>
        </div>
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Generate an AI response to reply to {originalEmailFrom}
            </p>
            <Button
              size="sm"
              onClick={handleGenerateResponse}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate Response
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending with response - show preview and actions
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
