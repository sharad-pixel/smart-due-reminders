import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecouplyLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { brain: "h-6 w-6", text: "text-sm", gap: "gap-1.5" },
  md: { brain: "h-8 w-8", text: "text-lg sm:text-xl", gap: "gap-2" },
  lg: { brain: "h-11 w-11", text: "text-2xl", gap: "gap-2.5" },
  xl: { brain: "h-14 w-14", text: "text-4xl sm:text-5xl", gap: "gap-3" },
};

export const RecouplyLogo = ({
  size = "md",
  showText = true,
  animated = false,
  className,
}: RecouplyLogoProps) => {
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center", config.gap, className)}>
      <span className="relative">
        <Brain
          className={cn(
            config.brain,
            "text-primary",
            animated && "animate-brain-pulse"
          )}
          strokeWidth={1.75}
        />
        {animated && (
          <span className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
        )}
      </span>
      {showText && (
        <span
          className={cn(
            "font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent",
            config.text
          )}
        >
          Recouply.ai
        </span>
      )}
    </div>
  );
};

export default RecouplyLogo;
