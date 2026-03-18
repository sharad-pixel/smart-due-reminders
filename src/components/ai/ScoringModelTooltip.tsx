import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";

interface ScoringModelTooltipProps {
  variant?: "icon" | "badge";
  className?: string;
}

export const ScoringModelTooltip = ({ variant = "icon", className }: ScoringModelTooltipProps) => {
  const content = (
    <div className="space-y-4 text-sm max-w-sm">
      <div>
        <h4 className="font-semibold text-foreground mb-1">Risk Score Model</h4>
        <p className="text-muted-foreground text-xs">
          Higher score = Higher risk. Modeled after FICO SBSS, D&B PAYDEX, and Experian Intelliscore.
        </p>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="font-medium">0-30: Low Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="font-medium">31-55: Medium Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="font-medium">56-75: High Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="font-medium">76-100: Critical Risk</span>
        </div>
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="font-medium text-xs text-foreground">Scoring Components:</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li><strong>Invoice Behavior (50%)</strong> - Avg days past due, aging mix, broken promises</li>
          <li><strong>Payment Patterns (20%)</strong> - On-time rate, disputes, recency</li>
          <li><strong>Customer Health (15%)</strong> - Type, concentration risk</li>
          <li><strong>Operational Signals (15%)</strong> - Sentiment, engagement, escalations</li>
        </ul>
      </div>

      <div className="border-t pt-3">
        <p className="font-medium text-xs text-foreground mb-1">Avg DPD Calculation:</p>
        <p className="text-xs text-muted-foreground">
          Average Days Past Due = Total days past due across all open invoices ÷ Number of open invoices
        </p>
      </div>
    </div>
  );

  if (variant === "badge") {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="ghost" size="sm" className={`h-5 px-1.5 gap-1 text-xs ${className}`}>
            <HelpCircle className="h-3 w-3" />
            How it works
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" align="start">
          {content}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}>
          <HelpCircle className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        {content}
      </HoverCardContent>
    </HoverCard>
  );
};

export default ScoringModelTooltip;