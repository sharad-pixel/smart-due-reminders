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
  size = 48,
  strokeWidth = 3.5,
  children,
}: OnboardingProgressRingProps) => {
  const navigate = useNavigate();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const isComplete = percentage >= 100;

  if (isComplete) return <>{children}</>;

  // Color based on progress
  const getProgressColor = () => {
    if (percentage >= 75) return "hsl(var(--primary))";
    if (percentage >= 50) return "hsl(142 76% 36%)"; // green-600
    if (percentage >= 25) return "hsl(38 92% 50%)"; // amber-500
    return "hsl(0 84% 60%)"; // red-500
  };

  const progressColor = getProgressColor();
  const roundedPct = Math.round(percentage);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative cursor-pointer group"
            style={{ width: size, height: size }}
            onClick={(e) => {
              e.stopPropagation();
              navigate("/onboarding");
            }}
          >
            {/* Track circle */}
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
              {/* Progress arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={progressColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out drop-shadow-sm"
              />
            </svg>
            {/* Avatar */}
            <div className="absolute inset-0 flex items-center justify-center">
              {children}
            </div>
            {/* Percentage badge */}
            <div
              className="absolute -bottom-1 -right-1 text-[10px] font-bold rounded-full h-[18px] min-w-[18px] px-0.5 flex items-center justify-center shadow-md border-2 border-background"
              style={{ backgroundColor: progressColor, color: "white" }}
            >
              {roundedPct}
            </div>
            {/* Pulse on hover */}
            <div className="absolute inset-0 rounded-full ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-200" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>Setup {roundedPct}% complete — click to continue</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
