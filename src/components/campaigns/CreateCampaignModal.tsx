import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ArrowRight, Check, Users, AlertCircle } from "lucide-react";
import { useCollectionCampaigns, CampaignStrategy, CampaignSummary, AccountSummary } from "@/hooks/useCollectionCampaigns";
import { CampaignStrategyCard } from "./CampaignStrategyCard";
import { toast } from "sonner";

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
  const [noAccountsMessage, setNoAccountsMessage] = useState<string | null>(null);

  const { generateStrategy, createCampaign } = useCollectionCampaigns();

  const handleGenerateStrategy = async () => {
    setNoAccountsMessage(null);
    
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
    } else if (result.message) {
      setNoAccountsMessage(result.message);
      toast.info(result.message);
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
      accountIds: accounts.map(a => a.id), // Assign all matching accounts
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
    setNoAccountsMessage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create AI Collection Campaign
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Select target criteria and let AI recommend the optimal collection strategy with risk-based prioritization"}
            {step === "strategy" && "Review the AI-generated strategy, payment predictions, and qualifying accounts"}
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
                  <SelectItem value="Low">Low Risk (≤30) - Gentle Reminders</SelectItem>
                  <SelectItem value="Medium">Medium Risk (31-55) - Proactive Outreach</SelectItem>
                  <SelectItem value="High">High Risk (56-75) - Urgent Collection</SelectItem>
                  <SelectItem value="Critical">Critical Risk (&gt;75) - Escalation</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Higher risk scores indicate accounts more likely to become bad debt. AI will tailor the strategy accordingly.
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
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">AI Campaign Features</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <span className="font-medium">Auto-Generate Drafts</span>
                    <p className="text-xs text-muted-foreground">AI creates personalized outreach for each account</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <span className="font-medium">Risk-Based Priority</span>
                    <p className="text-xs text-muted-foreground">Accounts ranked by collection likelihood</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <span className="font-medium">Multi-Channel Sequencing</span>
                    <p className="text-xs text-muted-foreground">Optimal contact order: email → phone → SMS</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <span className="font-medium">Payment Prediction</span>
                    <p className="text-xs text-muted-foreground">AI estimates recovery amount and timeline</p>
                  </div>
                </div>
              </div>
            </div>

            {/* No Accounts Warning */}
            {noAccountsMessage && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{noAccountsMessage}</span>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleGenerateStrategy}
              disabled={generateStrategy.isPending}
            >
              {generateStrategy.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Accounts & Generating Strategy...
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
            <CampaignStrategyCard 
              strategy={strategy} 
              summary={summary} 
              accounts={accounts}
            />

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

            {/* Summary before creation */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <h4 className="font-medium mb-2">Campaign Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Accounts to assign:</span>
                  <span className="ml-2 font-medium">{accounts.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total balance:</span>
                  <span className="ml-2 font-medium">${summary.totalBalance.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Recommended tone:</span>
                  <span className="ml-2 font-medium capitalize">{strategy.recommendedTone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Primary channel:</span>
                  <span className="ml-2 font-medium capitalize">{strategy.recommendedChannel.replace("-", " ")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                All outreach will be tracked in the Inbound Command Center for response monitoring.
              </p>
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
                    Creating Campaign...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Campaign ({accounts.length} accounts)
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
