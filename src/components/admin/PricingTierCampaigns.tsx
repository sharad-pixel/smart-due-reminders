import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Rocket, 
  TrendingUp, 
  Crown, 
  Plus,
  Check,
  Sparkles
} from "lucide-react";
import { PLAN_CONFIGS } from "@/lib/subscriptionConfig";

interface PricingTierCampaign {
  id: string;
  tier: "solo_pro" | "starter" | "growth" | "professional";
  name: string;
  displayName: string;
  description: string;
  price: number;
  invoiceLimit: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  targetAudience: string;
  idealFor: string[];
}

export const PRICING_TIER_CAMPAIGNS: PricingTierCampaign[] = [
  {
    id: "campaign_solo_pro",
    tier: "solo_pro",
    name: "Solo Pro Campaign",
    displayName: PLAN_CONFIGS.solo_pro.displayName,
    description: "Target freelancers and solopreneurs with 25 or fewer invoices monthly",
    price: PLAN_CONFIGS.solo_pro.monthlyPrice,
    invoiceLimit: PLAN_CONFIGS.solo_pro.invoiceLimit,
    icon: Users,
    color: "bg-blue-500",
    targetAudience: "Freelancers, Consultants, Solo Business Owners",
    idealFor: [
      "Independent contractors",
      "Small consultancies",
      "Single-person agencies",
      "Part-time business owners",
    ],
  },
  {
    id: "campaign_starter",
    tier: "starter",
    name: "Starter Campaign",
    displayName: PLAN_CONFIGS.starter.displayName,
    description: "Target small businesses managing up to 100 invoices monthly",
    price: PLAN_CONFIGS.starter.monthlyPrice,
    invoiceLimit: PLAN_CONFIGS.starter.invoiceLimit,
    icon: Rocket,
    color: "bg-emerald-500",
    targetAudience: "Small Businesses, Growing Agencies",
    idealFor: [
      "Small service businesses",
      "Growing agencies",
      "Small retail operations",
      "Local service providers",
    ],
  },
  {
    id: "campaign_growth",
    tier: "growth",
    name: "Growth Campaign",
    displayName: PLAN_CONFIGS.growth.displayName,
    description: "Target scaling businesses with up to 300 invoices monthly",
    price: PLAN_CONFIGS.growth.monthlyPrice,
    invoiceLimit: PLAN_CONFIGS.growth.invoiceLimit,
    icon: TrendingUp,
    color: "bg-orange-500",
    targetAudience: "Mid-Market, Scaling Companies",
    idealFor: [
      "Scaling SaaS companies",
      "Mid-size agencies",
      "Regional businesses",
      "Fast-growing startups",
    ],
  },
  {
    id: "campaign_professional",
    tier: "professional",
    name: "Professional Campaign",
    displayName: PLAN_CONFIGS.professional.displayName,
    description: "Target established businesses with up to 500 invoices monthly",
    price: PLAN_CONFIGS.professional.monthlyPrice,
    invoiceLimit: PLAN_CONFIGS.professional.invoiceLimit,
    icon: Crown,
    color: "bg-purple-500",
    targetAudience: "Established Businesses, Large Teams",
    idealFor: [
      "Established companies",
      "Large agencies",
      "Multi-location businesses",
      "High-volume service providers",
    ],
  },
];

interface PricingTierCampaignsProps {
  existingCampaigns: Array<{ name: string; id: string }>;
  onCreateCampaign: (campaign: {
    name: string;
    description: string;
    campaign_type: string;
    target_segment: string;
    pricing_tier: string;
  }) => void;
  isCreating: boolean;
  leadsCountByTier: Record<string, number>;
}

export const PricingTierCampaigns = ({
  existingCampaigns,
  onCreateCampaign,
  isCreating,
  leadsCountByTier,
}: PricingTierCampaignsProps) => {
  const [creatingTier, setCreatingTier] = useState<string | null>(null);

  const campaignExists = (tier: string) => {
    return existingCampaigns.some((c: any) => c.pricing_tier === tier);
  };

  const handleCreate = (tier: PricingTierCampaign) => {
    setCreatingTier(tier.tier);
    onCreateCampaign({
      name: `${tier.displayName} Tier Campaign`,
      description: tier.description,
      campaign_type: "acquisition",
      target_segment: tier.targetAudience,
      pricing_tier: tier.tier,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pricing Tier Campaigns
          </h3>
          <p className="text-sm text-muted-foreground">
            Create campaigns aligned with your pricing plans to segment and target leads effectively
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PRICING_TIER_CAMPAIGNS.map((tier) => {
          const exists = campaignExists(tier.tier);
          const leadCount = leadsCountByTier[tier.tier] || 0;
          const Icon = tier.icon;

          return (
            <Card 
              key={tier.id} 
              className={`relative overflow-hidden transition-all ${
                exists ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"
              }`}
            >
              {/* Color accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${tier.color}`} />
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${tier.color}/10`}>
                    <Icon className={`h-5 w-5 ${tier.color.replace('bg-', 'text-')}`} />
                  </div>
                  {exists && (
                    <Badge variant="secondary" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-2">{tier.displayName}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {tier.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Pricing info */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">${tier.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Up to {tier.invoiceLimit} invoices/month
                </div>

                {/* Target audience */}
                <div className="text-xs">
                  <span className="font-medium">Target:</span>{" "}
                  <span className="text-muted-foreground">{tier.targetAudience}</span>
                </div>

                {/* Lead count */}
                {exists && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{leadCount}</span>
                    <span className="text-muted-foreground">leads assigned</span>
                  </div>
                )}

                {/* Action button */}
                {!exists ? (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => handleCreate(tier)}
                    disabled={isCreating}
                  >
                    {isCreating && creatingTier === tier.tier ? (
                      "Creating..."
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Campaign
                      </>
                    )}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" size="sm" disabled>
                    <Check className="h-4 w-4 mr-1" />
                    Campaign Active
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
