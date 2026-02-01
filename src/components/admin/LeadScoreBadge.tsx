import { cn } from "@/lib/utils";
import { Zap, TrendingUp, Minus, TrendingDown } from "lucide-react";

interface LeadScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export const LeadScoreBadge = ({
  score,
  size = "md",
  showIcon = true,
}: LeadScoreBadgeProps) => {
  const getScoreConfig = (score: number) => {
    if (score >= 80) {
      return {
        label: "Hot",
        color: "bg-gradient-to-r from-orange-500 to-red-500 text-white",
        icon: Zap,
      };
    }
    if (score >= 50) {
      return {
        label: "Warm",
        color: "bg-gradient-to-r from-yellow-400 to-orange-400 text-white",
        icon: TrendingUp,
      };
    }
    if (score >= 20) {
      return {
        label: "Cool",
        color: "bg-gradient-to-r from-blue-400 to-cyan-400 text-white",
        icon: Minus,
      };
    }
    return {
      label: "Cold",
      color: "bg-gradient-to-r from-slate-400 to-slate-500 text-white",
      icon: TrendingDown,
    };
  };

  const config = getScoreConfig(score);
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.color,
        sizeClasses[size]
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{score}</span>
    </span>
  );
};
