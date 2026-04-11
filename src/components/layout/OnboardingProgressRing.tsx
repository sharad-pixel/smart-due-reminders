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
  size = 44,
  strokeWidth = 3,
  children,
}: OnboardingProgressRingProps) => {
  const navigate = useNavigate();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const isComplete = percentage >= 100;

  if (isComplete) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative cursor-pointer"
            style={{ width: size, height: size }}
            onClick={(e) => {
              e.stopPropagation();
              navigate("/onboarding");
            }}
          >
            <svg
              width={size}
              height={size}
              className="absolute inset-0 -rotate-90"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {children}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-sm border border-background">
              {Math.round(percentage)}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Setup {Math.round(percentage)}% complete — click to continue</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
