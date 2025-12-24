import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  MessageSquare, 
  Phone, 
  Mail, 
  Smartphone,
  Sparkles,
  Clock,
  Shield,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Loader2,
  Play,
  Pause,
  MoreVertical
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CampaignAccountsList } from "./CampaignAccountsList";
import type { CampaignStrategy, CampaignSummary, AccountSummary, CollectionCampaign } from "@/hooks/useCollectionCampaigns";

interface EnhancedCampaignCardProps {
  campaign: CollectionCampaign;
  strategy?: CampaignStrategy;
  summary?: CampaignSummary;
  accounts?: AccountSummary[];
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onGenerateDrafts?: () => void;
  onInitiateOutreach?: (accountId: string, channel: string) => void;
  isGeneratingDrafts?: boolean;
}

export function EnhancedCampaignCard({ 
  campaign,
  strategy,
  summary,
  accounts = [],
  onStatusChange,
  onDelete,
  onGenerateDrafts,
  onInitiateOutreach,
  isGeneratingDrafts
}: EnhancedCampaignCardProps) {
  const [showAccounts, setShowAccounts] = useState(false);

  const getToneBadge = (tone: string | null) => {
    const styles = {
      friendly: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      firm: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      urgent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      legal: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return styles[(tone || "firm") as keyof typeof styles] || styles.firm;
  };

  const getChannelIcon = (channel: string | null) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "phone": return <Phone className="h-4 w-4" />;
      case "sms": return <Smartphone className="h-4 w-4" />;
      case "multi-channel": return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Paused</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Completed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const collectionProgress = campaign.total_balance > 0 
    ? Math.round((campaign.amount_collected / campaign.total_balance) * 100) 
    : 0;

  const contactProgress = campaign.total_accounts > 0
    ? Math.round((campaign.accounts_contacted / campaign.total_accounts) * 100)
    : 0;

  const parsedStrategy = strategy || (campaign.ai_strategy ? JSON.parse(campaign.ai_strategy) : null);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            {getStatusBadge(campaign.status)}
          </div>
          <div className="flex items-center gap-2">
            {campaign.status === "draft" && (
              <Button size="sm" onClick={() => onStatusChange("active")}>
                <Play className="h-4 w-4 mr-1" />
                Activate
              </Button>
            )}
            {campaign.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => onStatusChange("paused")}>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button size="sm" onClick={() => onStatusChange("active")}>
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange("completed")}>
                  Mark Complete
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Delete Campaign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {campaign.description && (
          <p className="text-muted-foreground text-sm mt-1">{campaign.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Target Accounts</p>
            <p className="text-2xl font-bold">{campaign.total_accounts}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {campaign.accounts_contacted} contacted
            </p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Total Balance</p>
            <p className="text-2xl font-bold">${campaign.total_balance.toLocaleString()}</p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold text-green-600">${campaign.amount_collected.toLocaleString()}</p>
            <Progress value={collectionProgress} className="mt-2 h-1.5" />
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">AI Confidence</p>
            <p className="text-2xl font-bold">{campaign.ai_confidence_score || 0}%</p>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Recommended Tone</span>
            </div>
            <Badge className={`${getToneBadge(campaign.ai_recommended_tone)} capitalize`}>
              {campaign.ai_recommended_tone || "firm"}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getChannelIcon(campaign.ai_recommended_channel)}
              <span className="font-medium">Recommended Channel</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {(campaign.ai_recommended_channel || "email").replace("-", " ")}
            </Badge>
          </div>
        </div>

        {/* Strategy Points */}
        {parsedStrategy?.strategyPoints && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-medium">Key Strategy Points</span>
            </div>
            <ul className="space-y-1">
              {parsedStrategy.strategyPoints.slice(0, 3).map((point: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progress Bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Contact Progress</span>
              <span>{contactProgress}%</span>
            </div>
            <Progress value={contactProgress} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Collection Progress</span>
              <span className="text-green-600">{collectionProgress}%</span>
            </div>
            <Progress value={collectionProgress} className="h-2" />
          </div>
        </div>

        {/* Actions */}
        {campaign.status === "active" && onGenerateDrafts && (
          <div className="pt-4 border-t">
            <Button 
              onClick={onGenerateDrafts} 
              disabled={isGeneratingDrafts}
              className="w-full"
            >
              {isGeneratingDrafts ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Drafts...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Generate Outreach Drafts
                </>
              )}
            </Button>
          </div>
        )}

        {/* Expandable Accounts List */}
        {accounts.length > 0 && (
          <CampaignAccountsList
            accounts={accounts}
            recommendedTone={campaign.ai_recommended_tone || "firm"}
            recommendedChannel={campaign.ai_recommended_channel || "email"}
            onGenerateDraft={(accountId) => console.log("Generate draft for:", accountId)}
            onInitiateOutreach={onInitiateOutreach}
            isGenerating={isGeneratingDrafts}
          />
        )}
      </CardContent>
    </Card>
  );
}
