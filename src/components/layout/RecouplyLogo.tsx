import { cn } from "@/lib/utils";
import brainIcon from "@/assets/brand/recouply-brain-icon.png";

interface RecouplyLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { brain: "h-4 w-4", text: "text-sm", gap: "gap-1" },
  md: { brain: "h-6 w-6", text: "text-lg sm:text-xl", gap: "gap-1.5" },
  lg: { brain: "h-9 w-9", text: "text-2xl", gap: "gap-2" },
  xl: { brain: "h-12 w-12", text: "text-4xl sm:text-5xl", gap: "gap-2" },
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
      <span className="relative inline-flex shrink-0">
        <img
          src={brainIcon}
          alt="Recouply.ai brain logo"
          className={cn(
            config.brain,
            "object-contain",
            animated && "animate-brain-pulse"
          )}
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
