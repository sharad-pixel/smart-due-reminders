import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MessageSquare, DollarSign, AlertTriangle, TrendingUp, Clock, CheckCircle2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountSummary } from "@/hooks/useCollectionCampaigns";

interface CampaignAccountsListProps {
  accounts: AccountSummary[];
  recommendedTone: string;
  recommendedChannel: string;
  onGenerateDraft?: (accountId: string) => void;
  onInitiateOutreach?: (accountId: string, channel: string) => void;
  isGenerating?: boolean;
}

export function CampaignAccountsList({ 
  accounts, 
  recommendedTone,
  recommendedChannel,
  onGenerateDraft,
  onInitiateOutreach,
  isGenerating 
}: CampaignAccountsListProps) {

  // Sort accounts by priority: risk score desc, then balance desc
  const prioritizedAccounts = [...accounts].sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return b.totalBalance - a.totalBalance;
  });

  const getRiskColor = (score: number) => {
    if (score > 75) return "text-red-600 bg-red-100 dark:bg-red-900/30";
    if (score > 55) return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
    if (score > 30) return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
    return "text-green-600 bg-green-100 dark:bg-green-900/30";
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "phone": return <Phone className="h-3.5 w-3.5" />;
      case "sms": return <MessageSquare className="h-3.5 w-3.5" />;
      default: return <Mail className="h-3.5 w-3.5" />;
    }
  };

  // Calculate collection priority score (combines risk + balance + days past due)
  const getPriorityScore = (account: AccountSummary) => {
    const riskWeight = account.riskScore * 0.4;
    const balanceWeight = Math.min(account.totalBalance / 10000, 30) * 0.3;
    const daysWeight = Math.min(account.maxDaysPastDue / 120, 30) * 0.3;
    return Math.round(riskWeight + balanceWeight + daysWeight);
  };

  // Predict expected collection probability
  const getCollectionProbability = (account: AccountSummary) => {
    // Inverse of risk score - higher risk = lower probability
    const base = 100 - account.riskScore;
    // Adjust based on payment history
    const historyFactor = account.avgDaysToPay < 30 ? 1.1 : account.avgDaysToPay < 60 ? 1.0 : 0.85;
    return Math.min(Math.round(base * historyFactor), 95);
  };

  // Get recommended channel sequence for multi-channel
  const getChannelSequence = (account: AccountSummary) => {
    if (account.riskScore > 75) {
      return ["phone", "email", "sms"];
    } else if (account.riskScore > 55) {
      return ["email", "phone", "sms"];
    } else if (account.riskScore > 30) {
      return ["email", "sms"];
    }
    return ["email"];
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No accounts assigned to this campaign</p>
        <p className="text-sm mt-1">Use the Allocation tab to assign accounts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-500" />
          {accounts.length} accounts exclusively assigned to this campaign
        </p>
      </div>
      
      {prioritizedAccounts.map((account, index) => {
        const priorityScore = getPriorityScore(account);
        const collectionProb = getCollectionProbability(account);
        const channelSequence = getChannelSequence(account);
        
        return (
          <div
            key={account.id}
            className={cn(
              "border rounded-lg p-4 space-y-3",
              index === 0 && "border-primary/50 bg-primary/5"
            )}
          >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {index < 3 && (
                    <Badge variant="secondary" className="text-xs">
                      #{index + 1} Priority
                    </Badge>
                  )}
                  <h4 className="font-medium truncate">{account.name}</h4>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${account.totalBalance.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {account.maxDaysPastDue} days
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {account.openInvoicesCount} invoices
                  </span>
                </div>
              </div>
              <Badge className={cn("shrink-0", getRiskColor(account.riskScore))}>
                Risk: {account.riskScore}
              </Badge>
            </div>

            {/* AI Insights Row */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-muted/50 rounded p-2">
                <p className="text-xs text-muted-foreground">Collection Likelihood</p>
                <p className={cn(
                  "font-semibold",
                  collectionProb >= 70 ? "text-green-600" : collectionProb >= 50 ? "text-yellow-600" : "text-red-600"
                )}>
                  {collectionProb}%
                </p>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <p className="text-xs text-muted-foreground">Priority Score</p>
                <p className="font-semibold">{priorityScore}/100</p>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <p className="text-xs text-muted-foreground">Avg Days to Pay</p>
                <p className="font-semibold">{account.avgDaysToPay} days</p>
              </div>
            </div>

            {/* Channel Sequence */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Recommended sequence:</span>
              <div className="flex items-center gap-1">
                {channelSequence.map((channel, idx) => (
                  <div key={channel} className="flex items-center">
                    <Badge variant="outline" className="text-xs gap-1">
                      {getChannelIcon(channel)}
                      {channel}
                    </Badge>
                    {idx < channelSequence.length - 1 && (
                      <span className="text-muted-foreground mx-1">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t">
              {onGenerateDraft && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateDraft(account.id)}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Generate Draft
                </Button>
              )}
              {onInitiateOutreach && (
                <Button
                  size="sm"
                  onClick={() => onInitiateOutreach(account.id, channelSequence[0])}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {getChannelIcon(channelSequence[0])}
                  <span className="ml-1">Start Outreach</span>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
