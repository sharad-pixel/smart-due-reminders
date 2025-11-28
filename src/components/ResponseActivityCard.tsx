import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Phone, FileText, Link2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ResponseActivityCardProps {
  activity: {
    id: string;
    created_at: string;
    direction: string;
    channel: string;
    activity_type: string;
    subject?: string;
    message_body: string;
    response_message?: string;
    linked_outreach_log_id?: string;
    metadata?: {
      task_type?: string;
      from_email?: string;
      ai_generated_summary?: boolean;
    };
  };
  showLinkedOutreach?: boolean;
}

export const ResponseActivityCard = ({ activity, showLinkedOutreach = true }: ResponseActivityCardProps) => {
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const isInbound = activity.direction === 'inbound';
  const hasLinkedOutreach = !!activity.linked_outreach_log_id;

  return (
    <Card className={`${isInbound ? 'border-l-4 border-l-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getChannelIcon(activity.channel)}
            <CardTitle className="text-base">
              {isInbound ? 'Customer Response' : 'Outreach'}
            </CardTitle>
            {activity.metadata?.ai_generated_summary && (
              <Badge variant="secondary" className="text-xs">AI Summary</Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
        {activity.subject && (
          <p className="text-sm font-medium mt-1">{activity.subject}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Summary/Message Body */}
        <div className="text-sm text-muted-foreground">
          {activity.message_body}
        </div>

        {/* Full Response (if available) */}
        {activity.response_message && (
          <div className="mt-2 p-3 bg-muted/50 rounded-md">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Full Response:</p>
            <p className="text-sm whitespace-pre-wrap">{activity.response_message.substring(0, 300)}...</p>
          </div>
        )}

        {/* Linked Outreach Indicator */}
        {showLinkedOutreach && hasLinkedOutreach && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3 w-3" />
            <span>Response to recent outreach</span>
          </div>
        )}

        {/* Task Type Badge */}
        {activity.metadata?.task_type && (
          <Badge variant="outline" className="mt-2">
            {activity.metadata.task_type.replace(/_/g, ' ')}
          </Badge>
        )}

        {/* From Email */}
        {activity.metadata?.from_email && (
          <div className="text-xs text-muted-foreground">
            From: {activity.metadata.from_email}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
