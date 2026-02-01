import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Play, 
  Pause, 
  BarChart2, 
  Users, 
  Mail, 
  MousePointerClick, 
  Target, 
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  Send
} from "lucide-react";
import { format } from "date-fns";

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

interface MarketingCampaignCardProps {
  campaign: MarketingCampaign;
  onToggleStatus: (id: string, newStatus: string) => void;
  onViewDetails: (campaign: MarketingCampaign) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (campaign: MarketingCampaign) => void;
  onSendToLeads?: (campaign: MarketingCampaign) => void;
}

const campaignTypeColors: Record<string, string> = {
  nurture: "bg-blue-100 text-blue-800",
  acquisition: "bg-green-100 text-green-800",
  reactivation: "bg-orange-100 text-orange-800",
  announcement: "bg-purple-100 text-purple-800",
  promotion: "bg-pink-100 text-pink-800",
};

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
};

export const MarketingCampaignCard = ({
  campaign,
  onToggleStatus,
  onViewDetails,
  onDelete,
  onDuplicate,
  onSendToLeads,
}: MarketingCampaignCardProps) => {
  const openRate = campaign.emails_sent && campaign.opens
    ? ((campaign.opens / campaign.emails_sent) * 100).toFixed(1)
    : "0";
  const clickRate = campaign.opens && campaign.clicks
    ? ((campaign.clicks / campaign.opens) * 100).toFixed(1)
    : "0";
  const conversionRate = campaign.total_leads && campaign.conversions
    ? ((campaign.conversions / campaign.total_leads) * 100).toFixed(1)
    : "0";

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {campaign.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge className={campaignTypeColors[campaign.campaign_type] || "bg-slate-100"}>
              {campaign.campaign_type}
            </Badge>
            <Badge className={statusColors[campaign.status] || "bg-slate-100"}>
              {campaign.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(campaign)}>
                  <BarChart2 className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {onSendToLeads && campaign.total_leads && campaign.total_leads > 0 && (
                  <DropdownMenuItem onClick={() => onSendToLeads(campaign)}>
                    <Send className="h-4 w-4 mr-2" />
                    Send to Leads
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(campaign.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Campaign
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="text-xs">Leads</span>
            </div>
            <p className="font-bold text-lg">{campaign.total_leads || 0}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Mail className="h-3 w-3" />
              <span className="text-xs">Sent</span>
            </div>
            <p className="font-bold text-lg">{campaign.emails_sent || 0}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <MousePointerClick className="h-3 w-3" />
              <span className="text-xs">Clicks</span>
            </div>
            <p className="font-bold text-lg">{campaign.clicks || 0}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span className="text-xs">Converts</span>
            </div>
            <p className="font-bold text-lg">{campaign.conversions || 0}</p>
          </div>
        </div>

        {/* Performance Bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Open Rate</span>
            <span className="font-medium">{openRate}%</span>
          </div>
          <Progress value={parseFloat(openRate)} className="h-2" />
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Click Rate</span>
            <span className="font-medium">{clickRate}%</span>
          </div>
          <Progress value={parseFloat(clickRate)} className="h-2" />
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Conversion Rate</span>
            <span className="font-medium">{conversionRate}%</span>
          </div>
          <Progress value={parseFloat(conversionRate)} className="h-2" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {campaign.started_at
              ? `Started ${format(new Date(campaign.started_at), "MMM d, yyyy")}`
              : `Created ${format(new Date(campaign.created_at), "MMM d, yyyy")}`}
          </div>
          <div className="flex gap-2">
            {campaign.status === "active" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onToggleStatus(campaign.id, "paused")}
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            ) : campaign.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onToggleStatus(campaign.id, "active")}
              >
                <Play className="h-3 w-3 mr-1" />
                Activate
              </Button>
            )}
            <Button size="sm" onClick={() => onViewDetails(campaign)}>
              <BarChart2 className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
