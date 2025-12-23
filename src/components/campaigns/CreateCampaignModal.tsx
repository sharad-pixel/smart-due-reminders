import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ArrowRight, Check } from "lucide-react";
import { useCollectionCampaigns, CampaignStrategy, CampaignSummary, AccountSummary } from "@/hooks/useCollectionCampaigns";
import { CampaignStrategyCard } from "./CampaignStrategyCard";

interface CreateCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "strategy" | "confirm";

export function CreateCampaignModal({ open, onOpenChange }: CreateCampaignModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [targetRiskTier, setTargetRiskTier] = useState<"Low" | "Medium" | "High" | "Critical" | "All">("High");
  const [minBalance, setMinBalance] = useState<string>("");
  const [maxBalance, setMaxBalance] = useState<string>("");
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");

  const { generateStrategy, createCampaign } = useCollectionCampaigns();

  const handleGenerateStrategy = async () => {
    const result = await generateStrategy.mutateAsync({
      targetRiskTier,
      minBalance: minBalance ? parseFloat(minBalance) : undefined,
      maxBalance: maxBalance ? parseFloat(maxBalance) : undefined,
    });

    if (result.strategy) {
      setStrategy(result.strategy);
      setSummary(result.summary);
      setAccounts(result.accounts);
      setCampaignName(result.strategy.campaignName);
      setCampaignDescription(result.strategy.executiveSummary);
      setStep("strategy");
    }
  };

  const handleCreateCampaign = async () => {
    if (!strategy || !summary) return;

    await createCampaign.mutateAsync({
      name: campaignName,
      description: campaignDescription,
      target_risk_tier: targetRiskTier,
      ai_strategy: JSON.stringify(strategy),
      ai_recommended_tone: strategy.recommendedTone,
      ai_recommended_channel: strategy.recommendedChannel,
      ai_confidence_score: strategy.confidenceScore,
      min_balance: minBalance ? parseFloat(minBalance) : 0,
      max_balance: maxBalance ? parseFloat(maxBalance) : undefined,
      total_accounts: summary.totalAccounts,
      total_balance: summary.totalBalance,
    });

    handleClose();
  };

  const handleClose = () => {
    setStep("select");
    setStrategy(null);
    setSummary(null);
    setAccounts([]);
    setCampaignName("");
    setCampaignDescription("");
    setMinBalance("");
    setMaxBalance("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Collection Campaign
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Select target criteria and let AI recommend the optimal collection strategy"}
            {step === "strategy" && "Review the AI-generated strategy and customize as needed"}
            {step === "confirm" && "Confirm campaign details and launch"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-6">
            {/* Risk Tier Selection */}
            <div className="space-y-2">
              <Label>Target Risk Tier</Label>
              <Select value={targetRiskTier} onValueChange={(v: typeof targetRiskTier) => setTargetRiskTier(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Risk Tiers</SelectItem>
                  <SelectItem value="Low">Low Risk (≤30)</SelectItem>
                  <SelectItem value="Medium">Medium Risk (31-55)</SelectItem>
                  <SelectItem value="High">High Risk (56-75)</SelectItem>
                  <SelectItem value="Critical">Critical Risk (&gt;75)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Higher risk scores indicate accounts more likely to become bad debt
              </p>
            </div>

            {/* Balance Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Balance ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minBalance}
                  onChange={(e) => setMinBalance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Balance ($)</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={maxBalance}
                  onChange={(e) => setMaxBalance(e.target.value)}
                />
              </div>
            </div>

            {/* Risk Tier Explanation */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium">Risk Tier Guide</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span><strong>Low:</strong> Good payers, gentle reminders</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span><strong>Medium:</strong> Some delays, proactive outreach</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span><strong>High:</strong> Significant issues, urgent action</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span><strong>Critical:</strong> Severe delinquency, escalation</span>
                </div>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleGenerateStrategy}
              disabled={generateStrategy.isPending}
            >
              {generateStrategy.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Accounts...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Strategy
                </>
              )}
            </Button>
          </div>
        )}

        {step === "strategy" && strategy && summary && (
          <div className="space-y-6">
            <CampaignStrategyCard strategy={strategy} summary={summary} />

            {/* Customize Name */}
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
                placeholder="Campaign description"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("select")} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleCreateCampaign} 
                disabled={createCampaign.isPending || !campaignName}
                className="flex-1"
              >
                {createCampaign.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
