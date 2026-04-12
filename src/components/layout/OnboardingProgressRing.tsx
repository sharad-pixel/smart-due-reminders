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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate("/onboarding"); }}>
            {children}
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
