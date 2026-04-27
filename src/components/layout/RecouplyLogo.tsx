import { cn } from "@/lib/utils";
import recouplyMark from "@/assets/recouply-logo.png";

interface RecouplyLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  /** Adds a subtle pulse + glow animation around the brand mark */
  animated?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { mark: "h-5 w-5", text: "text-sm", gap: "gap-1.5" },
  md: { mark: "h-7 w-7", text: "text-lg sm:text-xl", gap: "gap-2" },
  lg: { mark: "h-10 w-10", text: "text-2xl", gap: "gap-2.5" },
  xl: { mark: "h-14 w-14", text: "text-4xl sm:text-5xl", gap: "gap-3" },
};

/**
 * Official Recouply.ai brand mark.
 *
 * Renders the stylized "R" arrow logo (src/assets/recouply-logo.png)
 * alongside the wordmark. This component is the single source of truth
 * for Recouply branding — update the asset or this component to roll
 * a brand refresh across the entire site.
 */
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
          src={recouplyMark}
          alt="Recouply.ai"
          width={56}
          height={56}
          loading="eager"
          decoding="async"
          className={cn(
            config.mark,
            "object-contain",
            animated && "animate-brain-pulse"
          )}
          // The source PNG includes the "recouply.ai" wordmark beneath
          // the icon; crop tightly to just the "R" mark so it pairs
          // cleanly with our gradient wordmark next to it.
          style={{ objectPosition: "top center", clipPath: "inset(0 0 32% 0)" }}
        />
        {animated && (
          <span className="absolute inset-0 bg-primary/20 blur-lg rounded-full pointer-events-none" />
        )}
      </span>
      {showText && (
        <span
          className={cn(
            "font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent leading-none",
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
