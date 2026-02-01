import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Mail, 
  MousePointerClick, 
  Target, 
  Calendar,
  Search,
  Send,
  UserMinus,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { LeadScoreBadge } from "./LeadScoreBadge";

interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  lead_score: number | null;
  segment: string | null;
  lifecycle_stage: string | null;
  last_engaged_at: string | null;
  created_at: string;
}

interface OutreachActivity {
  id: string;
  lead_email: string;
  activity_type: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  subject: string | null;
}

interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  target_segment: string | null;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  total_leads: number | null;
  emails_sent: number | null;
  opens: number | null;
  clicks: number | null;
  conversions: number | null;
  created_at: string;
}

interface CampaignDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MarketingCampaign | null;
  leads: MarketingLead[];
  activities: OutreachActivity[];
  isLoadingLeads?: boolean;
  isLoadingActivities?: boolean;
  onRemoveLeads?: (leadIds: string[]) => void;
  onSendOutreach?: (leadIds: string[]) => void;
  isRemovingLeads?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
};

const campaignTypeColors: Record<string, string> = {
  nurture: "bg-blue-100 text-blue-800",
  acquisition: "bg-green-100 text-green-800",
  reactivation: "bg-orange-100 text-orange-800",
  announcement: "bg-purple-100 text-purple-800",
  promotion: "bg-pink-100 text-pink-800",
};

export function CampaignDetailsModal({
  open,
  onOpenChange,
  campaign,
  leads,
  activities,
  isLoadingLeads,
  isLoadingActivities,
  onRemoveLeads,
  onSendOutreach,
  isRemovingLeads,
}: CampaignDetailsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.email.toLowerCase().includes(query) ||
        l.name?.toLowerCase().includes(query) ||
        l.company?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  // Calculate campaign metrics
  const metrics = useMemo(() => {
    if (!campaign) return { openRate: 0, clickRate: 0, conversionRate: 0 };
    
    const openRate = campaign.emails_sent && campaign.opens
      ? (campaign.opens / campaign.emails_sent) * 100
      : 0;
    const clickRate = campaign.opens && campaign.clicks
      ? (campaign.clicks / campaign.opens) * 100
      : 0;
    const conversionRate = campaign.total_leads && campaign.conversions
      ? (campaign.conversions / campaign.total_leads) * 100
      : 0;

    return { openRate, clickRate, conversionRate };
  }, [campaign]);

  // Toggle lead selection
  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const handleRemoveLeads = () => {
    if (onRemoveLeads && selectedLeadIds.length > 0) {
      onRemoveLeads(selectedLeadIds);
      setSelectedLeadIds([]);
    }
  };

  const handleSendOutreach = () => {
    if (onSendOutreach && selectedLeadIds.length > 0) {
      onSendOutreach(selectedLeadIds);
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{campaign.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {campaign.description || "No description provided"}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={campaignTypeColors[campaign.campaign_type] || "bg-slate-100"}>
                {campaign.campaign_type}
              </Badge>
              <Badge className={statusColors[campaign.status] || "bg-slate-100"}>
                {campaign.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Campaign Stats */}
        <div className="grid grid-cols-4 gap-3 py-4 border-b flex-shrink-0">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3 w-3" />
              Total Leads
            </div>
            <p className="text-xl font-bold">{leads.length || campaign.total_leads || 0}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Mail className="h-3 w-3" />
              Emails Sent
            </div>
            <p className="text-xl font-bold">{campaign.emails_sent || 0}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MousePointerClick className="h-3 w-3" />
              Clicks
            </div>
            <p className="text-xl font-bold">{campaign.clicks || 0}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3 w-3" />
              Conversions
            </div>
            <p className="text-xl font-bold">{campaign.conversions || 0}</p>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-4 py-3 flex-shrink-0">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Open Rate</span>
              <span className="font-medium">{metrics.openRate.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.openRate} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Click Rate</span>
              <span className="font-medium">{metrics.clickRate.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.clickRate} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Conversion Rate</span>
              <span className="font-medium">{metrics.conversionRate.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.conversionRate} className="h-2" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="leads" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="leads">
              <Users className="h-4 w-4 mr-2" />
              Assigned Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <TrendingUp className="h-4 w-4 mr-2" />
              Outreach Activity ({activities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="flex-1 overflow-hidden flex flex-col mt-4">
            {/* Search and Actions */}
            <div className="flex items-center gap-3 mb-3 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedLeadIds.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleSendOutreach}>
                    <Send className="h-3 w-3 mr-1" />
                    Send ({selectedLeadIds.length})
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleRemoveLeads}
                    disabled={isRemovingLeads}
                    className="text-destructive hover:text-destructive"
                  >
                    {isRemovingLeads ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <UserMinus className="h-3 w-3 mr-1" />
                    )}
                    Remove ({selectedLeadIds.length})
                  </Button>
                </div>
              )}
            </div>

            {/* Leads Table */}
            <ScrollArea className="flex-1">
              {isLoadingLeads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No leads assigned to this campaign</p>
                  <p className="text-sm mt-1">Add leads from the Leads tab</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            filteredLeads.length > 0 &&
                            selectedLeadIds.length === filteredLeads.length
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Last Engaged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeadIds.includes(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lead.name || lead.email}</p>
                            {lead.name && (
                              <p className="text-xs text-muted-foreground">{lead.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.company || "-"}</TableCell>
                        <TableCell>
                          <LeadScoreBadge score={lead.lead_score || 0} size="sm" />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {lead.lifecycle_stage || "lead"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lead.last_engaged_at
                            ? format(new Date(lead.last_engaged_at), "MMM d, yyyy")
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full">
              {isLoadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No outreach activity yet</p>
                  <p className="text-sm mt-1">Send emails to leads to see activity here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <Card key={activity.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{activity.lead_email}</p>
                            {activity.opened_at ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Opened
                              </Badge>
                            ) : activity.sent_at ? (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                <Mail className="h-3 w-3 mr-1" />
                                Sent
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {activity.clicked_at && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                <MousePointerClick className="h-3 w-3 mr-1" />
                                Clicked
                              </Badge>
                            )}
                          </div>
                          {activity.subject && (
                            <p className="text-sm text-muted-foreground truncate">
                              {activity.subject}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activity.sent_at
                            ? format(new Date(activity.sent_at), "MMM d, h:mm a")
                            : "Not sent"}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created {format(new Date(campaign.created_at), "MMM d, yyyy")}
            </span>
            {campaign.started_at && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Started {format(new Date(campaign.started_at), "MMM d, yyyy")}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
