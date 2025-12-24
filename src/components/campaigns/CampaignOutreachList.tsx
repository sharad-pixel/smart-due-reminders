import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Phone, 
  MessageSquare, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Eye,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface OutreachDraft {
  id: string;
  subject: string | null;
  message_body: string;
  channel: string;
  status: string;
  recommended_send_date: string | null;
  sent_at: string | null;
  created_at: string;
  invoice_id: string | null;
  invoices?: {
    invoice_number: string;
    amount: number;
    debtors?: {
      name: string;
      company_name: string;
    };
  };
}

interface CampaignActivity {
  id: string;
  activity_type: string;
  channel: string;
  subject: string | null;
  message_body: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
  created_at: string;
  debtor_id: string;
  debtors?: {
    name: string;
    company_name: string;
    email: string;
  };
  metadata?: Record<string, any>;
}

interface CampaignOutreachListProps {
  campaignId: string;
  onViewDraft?: (draft: OutreachDraft) => void;
  onRegenerateDraft?: (draftId: string) => void;
}

export function CampaignOutreachList({ 
  campaignId, 
  onViewDraft,
  onRegenerateDraft 
}: CampaignOutreachListProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"drafts" | "sent">("drafts");

  // Fetch outreach activities for this campaign
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["campaign-activities", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_activities")
        .select(`
          *,
          debtors (name, company_name, email)
        `)
        .contains("metadata", { campaign_id: campaignId })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CampaignActivity[];
    },
  });

  // Fetch pending drafts (from ai_drafts table) - these may have campaign metadata
  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["campaign-drafts", campaignId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          *,
          invoices (
            invoice_number,
            amount,
            debtors (name, company_name)
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true });

      if (error) throw error;
      return data as OutreachDraft[];
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "phone": return <Phone className="h-4 w-4" />;
      case "sms": return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (draft: OutreachDraft) => {
    if (draft.sent_at) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Sent
        </Badge>
      );
    }
    if (draft.status === "approved") {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          Scheduled
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <AlertCircle className="h-3 w-3 mr-1" />
        Pending Review
      </Badge>
    );
  };

  const getActivityStatusBadge = (activity: CampaignActivity) => {
    if (activity.responded_at) {
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          Responded
        </Badge>
      );
    }
    if (activity.opened_at) {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Opened
        </Badge>
      );
    }
    if (activity.delivered_at) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Delivered
        </Badge>
      );
    }
    if (activity.sent_at) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          Sent
        </Badge>
      );
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const pendingDrafts = drafts?.filter(d => !d.sent_at) || [];
  const sentActivities = activities?.filter(a => a.sent_at) || [];
  const scheduledDrafts = pendingDrafts.filter(d => d.status === "approved");
  const reviewDrafts = pendingDrafts.filter(d => d.status === "pending_approval");

  const isLoading = activitiesLoading || draftsLoading;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <span className="font-medium">Outreach & Drafts</span>
            <Badge variant="outline" className="ml-2">
              {pendingDrafts.length} pending · {sentActivities.length} sent
            </Badge>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="border-t p-4 space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === "drafts" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("drafts")}
            >
              <Clock className="h-4 w-4 mr-1" />
              Pending Drafts ({pendingDrafts.length})
            </Button>
            <Button
              variant={activeTab === "sent" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("sent")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Sent ({sentActivities.length})
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : activeTab === "drafts" ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {/* Scheduled Section */}
              {scheduledDrafts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Scheduled to Send
                  </p>
                  {scheduledDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      getChannelIcon={getChannelIcon}
                      getStatusBadge={getStatusBadge}
                      onView={onViewDraft}
                      onRegenerate={onRegenerateDraft}
                    />
                  ))}
                </div>
              )}

              {/* Pending Review Section */}
              {reviewDrafts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Pending Review
                  </p>
                  {reviewDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      getChannelIcon={getChannelIcon}
                      getStatusBadge={getStatusBadge}
                      onView={onViewDraft}
                      onRegenerate={onRegenerateDraft}
                    />
                  ))}
                </div>
              )}

              {pendingDrafts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No pending drafts</p>
                  <p className="text-sm">Generate drafts to start outreach</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {sentActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  getChannelIcon={getChannelIcon}
                  getStatusBadge={getActivityStatusBadge}
                />
              ))}

              {sentActivities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sent messages yet</p>
                  <p className="text-sm">Approve and send drafts to see them here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Draft Card Component
function DraftCard({
  draft,
  getChannelIcon,
  getStatusBadge,
  onView,
  onRegenerate,
}: {
  draft: OutreachDraft;
  getChannelIcon: (channel: string) => React.ReactNode;
  getStatusBadge: (draft: OutreachDraft) => React.ReactNode;
  onView?: (draft: OutreachDraft) => void;
  onRegenerate?: (draftId: string) => void;
}) {
  const scheduledDate = draft.recommended_send_date ? parseISO(draft.recommended_send_date) : null;
  const isPastDue = scheduledDate && isAfter(new Date(), scheduledDate);

  return (
    <Card className={cn(
      "border",
      isPastDue && "border-orange-300 bg-orange-50/50 dark:bg-orange-900/10"
    )}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getChannelIcon(draft.channel)}
              <span className="font-medium text-sm truncate">
                {draft.invoices?.debtors?.company_name || draft.invoices?.debtors?.name || "Unknown"}
              </span>
            </div>
            {draft.subject && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {draft.subject}
              </p>
            )}
          </div>
          {getStatusBadge(draft)}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {scheduledDate && (
              <span className={cn(
                "flex items-center gap-1",
                isPastDue && "text-orange-600"
              )}>
                <Calendar className="h-3 w-3" />
                {isPastDue ? "Overdue: " : "Send: "}
                {format(scheduledDate, "MMM d, h:mm a")}
              </span>
            )}
            {draft.invoices && (
              <span>
                Invoice: {draft.invoices.invoice_number} (${draft.invoices.amount.toLocaleString()})
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {onView && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onView(draft)}>
                <Eye className="h-3 w-3" />
              </Button>
            )}
            {onRegenerate && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onRegenerate(draft.id)}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Activity Card Component
function ActivityCard({
  activity,
  getChannelIcon,
  getStatusBadge,
}: {
  activity: CampaignActivity;
  getChannelIcon: (channel: string) => React.ReactNode;
  getStatusBadge: (activity: CampaignActivity) => React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getChannelIcon(activity.channel)}
              <span className="font-medium text-sm truncate">
                {activity.debtors?.company_name || activity.debtors?.name || "Unknown"}
              </span>
            </div>
            {activity.subject && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {activity.subject}
              </p>
            )}
          </div>
          {getStatusBadge(activity)}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {activity.sent_at && (
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" />
              Sent {formatDistanceToNow(parseISO(activity.sent_at), { addSuffix: true })}
            </span>
          )}
          {activity.opened_at && (
            <span className="flex items-center gap-1 text-blue-600">
              <Eye className="h-3 w-3" />
              Opened {formatDistanceToNow(parseISO(activity.opened_at), { addSuffix: true })}
            </span>
          )}
          {activity.responded_at && (
            <span className="flex items-center gap-1 text-purple-600">
              <MessageSquare className="h-3 w-3" />
              Responded
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
