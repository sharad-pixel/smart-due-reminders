import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Phone, FileText, Link2, ExternalLink, CheckSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

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
    debtor_id: string;
    invoice_id?: string;
    metadata?: {
      task_type?: string;
      from_email?: string;
      ai_generated_summary?: boolean;
    };
  };
  showLinkedOutreach?: boolean;
}

export const ResponseActivityCard = ({ activity, showLinkedOutreach = true }: ResponseActivityCardProps) => {
  const [linkedOutreach, setLinkedOutreach] = useState<any>(null);
  const [relatedTasks, setRelatedTasks] = useState<any[]>([]);
  const [debtor, setDebtor] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [showFullResponse, setShowFullResponse] = useState(false);

  useEffect(() => {
    const fetchRelatedData = async () => {
      // Fetch linked outreach
      if (activity.linked_outreach_log_id) {
        const { data: outreach } = await supabase
          .from("outreach_logs")
          .select("*")
          .eq("id", activity.linked_outreach_log_id)
          .single();
        setLinkedOutreach(outreach);
      }

      // Fetch related tasks
      const { data: tasks } = await supabase
        .from("collection_tasks")
        .select("*")
        .eq("activity_id", activity.id);
      if (tasks) setRelatedTasks(tasks);

      // Fetch debtor info
      const { data: debtorData } = await supabase
        .from("debtors")
        .select("name, company_name, reference_id")
        .eq("id", activity.debtor_id)
        .single();
      setDebtor(debtorData);

      // Fetch invoice info if exists
      if (activity.invoice_id) {
        const { data: invoiceData } = await supabase
          .from("invoices")
          .select("invoice_number, reference_id, amount")
          .eq("id", activity.invoice_id)
          .single();
        setInvoice(invoiceData);
      }
    };

    fetchRelatedData();
  }, [activity]);

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
      
      <CardContent className="space-y-4">
        {/* Summary/Message Body */}
        <div className="text-sm text-muted-foreground">
          {activity.message_body}
        </div>

        {/* Full Response (if available) */}
        {activity.response_message && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullResponse(!showFullResponse)}
              className="mb-2"
            >
              {showFullResponse ? "Hide Full Response" : "View Full Response"}
            </Button>
            {showFullResponse && (
              <div className="p-3 bg-muted/50 rounded-md border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Full Email Response:</p>
                <p className="text-sm whitespace-pre-wrap">{activity.response_message}</p>
              </div>
            )}
          </div>
        )}

        {/* Links Section */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {/* Debtor Link */}
          {debtor && (
            <Link 
              to={`/debtors/${activity.debtor_id}`}
              className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {debtor.company_name} ({debtor.reference_id})
            </Link>
          )}

          {/* Invoice Link */}
          {invoice && (
            <Link 
              to={`/invoices/${activity.invoice_id}`}
              className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileText className="h-3 w-3 mr-1" />
              Invoice {invoice.invoice_number}
            </Link>
          )}
        </div>

        {/* Linked Outreach */}
        {showLinkedOutreach && linkedOutreach && (
          <div className="p-3 bg-accent/50 rounded-md border">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-3 w-3" />
              <span className="text-xs font-semibold">Response to Outreach</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              <strong>Subject:</strong> {linkedOutreach.subject}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {linkedOutreach.message_body}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sent {formatDistanceToNow(new Date(linkedOutreach.sent_at || linkedOutreach.created_at), { addSuffix: true })}
            </p>
          </div>
        )}

        {/* Related Tasks */}
        {relatedTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckSquare className="h-3 w-3" />
              <span>Generated Tasks ({relatedTasks.length})</span>
            </div>
            {relatedTasks.map((task) => (
              <Link 
                key={task.id} 
                to="/tasks" 
                className="block p-2 bg-primary/5 rounded border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{task.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.task_type.replace(/_/g, ' ')} • {task.priority} priority
                    </p>
                  </div>
                  <Badge variant={task.status === 'open' ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {task.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-2">
          {activity.metadata?.task_type && (
            <Badge variant="outline" className="text-xs">
              {activity.metadata.task_type.replace(/_/g, ' ')}
            </Badge>
          )}
          {activity.metadata?.from_email && (
            <Badge variant="secondary" className="text-xs">
              From: {activity.metadata.from_email}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
