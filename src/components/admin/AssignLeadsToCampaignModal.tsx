import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Users, Rocket, TrendingUp, Crown, UserPlus } from "lucide-react";
import { PLAN_CONFIGS } from "@/lib/subscriptionConfig";

interface Campaign {
  id: string;
  name: string;
  total_leads: number | null;
  status: string;
  pricing_tier?: string | null;
}

interface AssignLeadsToCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: Campaign[];
  selectedLeadsCount: number;
  onAssign: (campaignId: string) => void;
  isAssigning: boolean;
}

const getTierIcon = (campaign: Campaign) => {
  const tier = campaign.pricing_tier;
  if (tier === "solo_pro") return Users;
  if (tier === "starter") return Rocket;
  if (tier === "growth") return TrendingUp;
  if (tier === "professional") return Crown;
  return Users;
};

const getTierColor = (campaign: Campaign) => {
  const tier = campaign.pricing_tier;
  if (tier === "solo_pro") return "text-blue-500";
  if (tier === "starter") return "text-emerald-500";
  if (tier === "growth") return "text-orange-500";
  if (tier === "professional") return "text-purple-500";
  return "text-primary";
};

const getTierBgColor = (campaign: Campaign) => {
  const tier = campaign.pricing_tier;
  if (tier === "solo_pro") return "bg-blue-500/10";
  if (tier === "starter") return "bg-emerald-500/10";
  if (tier === "growth") return "bg-orange-500/10";
  if (tier === "professional") return "bg-purple-500/10";
  return "bg-primary/10";
};

const getTierPrice = (campaign: Campaign): number | null => {
  const tier = campaign.pricing_tier;
  if (tier === "solo_pro") return PLAN_CONFIGS.solo_pro.monthlyPrice;
  if (tier === "starter") return PLAN_CONFIGS.starter.monthlyPrice;
  if (tier === "growth") return PLAN_CONFIGS.growth.monthlyPrice;
  if (tier === "professional") return PLAN_CONFIGS.professional.monthlyPrice;
  return null;
};

export const AssignLeadsToCampaignModal = ({
  open,
  onOpenChange,
  campaigns,
  selectedLeadsCount,
  onAssign,
  isAssigning,
}: AssignLeadsToCampaignModalProps) => {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const handleAssign = () => {
    if (!selectedCampaign) return;
    onAssign(selectedCampaign);
  };

  // Filter to show pricing-tier campaigns first, then others
  const pricingCampaigns = campaigns.filter((c) => c.pricing_tier);
  const otherCampaigns = campaigns.filter((c) => !c.pricing_tier);

  const sortedCampaigns = [...pricingCampaigns, ...otherCampaigns];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Assign Leads to Campaign
          </DialogTitle>
          <DialogDescription>
            Select a pricing tier campaign to assign {selectedLeadsCount} selected lead
            {selectedLeadsCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {sortedCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No campaigns available</p>
              <p className="text-sm">Create a pricing tier campaign first</p>
            </div>
          ) : (
            <RadioGroup
              value={selectedCampaign}
              onValueChange={setSelectedCampaign}
              className="space-y-3"
            >
              {sortedCampaigns.map((campaign) => {
                const Icon = getTierIcon(campaign);
                const iconColor = getTierColor(campaign);
                const bgColor = getTierBgColor(campaign);
                const price = getTierPrice(campaign);

                return (
                  <div
                    key={campaign.id}
                    className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedCampaign === campaign.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedCampaign(campaign.id)}
                  >
                    <RadioGroupItem value={campaign.id} id={campaign.id} />
                    <div className={`p-2 rounded-lg ${bgColor}`}>
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor={campaign.id}
                        className="font-medium cursor-pointer"
                      >
                        {campaign.name}
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        {price && (
                          <span className="text-sm text-muted-foreground">
                            ${price}/mo tier
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {campaign.total_leads || 0} leads
                        </Badge>
                        <Badge
                          variant={campaign.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedCampaign || isAssigning || sortedCampaigns.length === 0}
          >
            {isAssigning ? "Assigning..." : `Assign ${selectedLeadsCount} Lead${selectedLeadsCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
