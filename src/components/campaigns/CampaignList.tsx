import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Play, 
  Pause, 
  Trash2, 
  Eye,
  Target,
  DollarSign,
  Users,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import type { CollectionCampaign } from "@/hooks/useCollectionCampaigns";

interface CampaignListProps {
  campaigns: CollectionCampaign[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onView: (campaign: CollectionCampaign) => void;
}

export function CampaignList({ campaigns, onStatusChange, onDelete, onView }: CampaignListProps) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    };
    return styles[status] || styles.draft;
  };

  const getRiskTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      Low: "text-green-600",
      Medium: "text-yellow-600",
      High: "text-orange-600",
      Critical: "text-red-600",
      All: "text-primary",
    };
    return colors[tier] || colors.All;
  };

  const getToneLabel = (tone: string | null) => {
    if (!tone) return null;
    return tone.charAt(0).toUpperCase() + tone.slice(1);
  };

  if (campaigns.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Create your first AI-powered collection campaign to start recovering funds more effectively
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {campaign.name}
                  <Badge className={getStatusBadge(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </CardTitle>
                {campaign.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {campaign.description}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(campaign)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  {campaign.status === "draft" && (
                    <DropdownMenuItem onClick={() => onStatusChange(campaign.id, "active")}>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </DropdownMenuItem>
                  )}
                  {campaign.status === "active" && (
                    <DropdownMenuItem onClick={() => onStatusChange(campaign.id, "paused")}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </DropdownMenuItem>
                  )}
                  {campaign.status === "paused" && (
                    <DropdownMenuItem onClick={() => onStatusChange(campaign.id, "active")}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => onDelete(campaign.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Target className={`h-4 w-4 ${getRiskTierColor(campaign.target_risk_tier)}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Risk Tier</p>
                  <p className={`font-medium ${getRiskTierColor(campaign.target_risk_tier)}`}>
                    {campaign.target_risk_tier}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Accounts</p>
                  <p className="font-medium">{campaign.total_accounts}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Balance</p>
                  <p className="font-medium">${campaign.total_balance.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Collected</p>
                  <p className="font-medium">${campaign.amount_collected.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                {campaign.ai_recommended_tone && (
                  <span>Tone: <strong>{getToneLabel(campaign.ai_recommended_tone)}</strong></span>
                )}
                {campaign.ai_recommended_channel && (
                  <span>Channel: <strong className="capitalize">{campaign.ai_recommended_channel.replace("-", " ")}</strong></span>
                )}
                {campaign.ai_confidence_score && (
                  <span>AI Confidence: <strong>{campaign.ai_confidence_score}%</strong></span>
                )}
              </div>
              <span>Created {format(new Date(campaign.created_at), "MMM d, yyyy")}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
