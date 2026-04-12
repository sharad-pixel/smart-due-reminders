import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OnboardingProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
}

export const OnboardingProgressRing = ({
  percentage,
  children,
}: OnboardingProgressRingProps) => {
  const navigate = useNavigate();
  const isComplete = percentage >= 100;
  const roundedPct = Math.round(percentage);

  if (isComplete) return <>{children}</>;

  const getBadgeColor = () => {
    if (percentage >= 75) return "bg-primary text-primary-foreground";
    if (percentage >= 50) return "bg-accent text-accent-foreground";
    if (percentage >= 25) return "bg-[hsl(38_92%_50%)] text-white";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); navigate("/onboarding"); }}
          >
            {children}
            {/* Small percentage badge */}
            <span className={`absolute -bottom-0.5 -right-0.5 text-[9px] font-bold rounded-full h-4 min-w-4 px-0.5 flex items-center justify-center border-2 border-background shadow-sm ${getBadgeColor()}`}>
              {roundedPct}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs px-3 py-1.5">
          <p className="font-medium">Setup {roundedPct}% complete</p>
          <p className="text-muted-foreground">Click to continue setup</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
