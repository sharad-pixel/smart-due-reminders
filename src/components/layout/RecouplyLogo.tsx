import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecouplyLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "auto" | "light" | "dark";
  className?: string;
  /** @deprecated retained for backward compatibility */
  animated?: boolean;
}

const sizeConfig = {
  sm: { frame: 22, icon: 12, text: "text-sm", suffix: "text-[10px]", gap: "gap-2", radius: "rounded-md" },
  md: { frame: 28, icon: 15, text: "text-base sm:text-lg", suffix: "text-[10px]", gap: "gap-2.5", radius: "rounded-lg" },
  lg: { frame: 32, icon: 17, text: "text-xl", suffix: "text-[11px]", gap: "gap-2.5", radius: "rounded-lg" },
  xl: { frame: 48, icon: 26, text: "text-3xl sm:text-4xl", suffix: "text-xs", gap: "gap-3", radius: "rounded-xl" },
};

/**
 * Recouply mark — the Brain glyph seated inside a refined "seal" frame.
 * Monochrome via currentColor with the brain in the brand primary,
 * so the lockup reads confidently on both light and dark surfaces.
 */
const RecouplyMark = ({ frame, icon, radius }: { frame: number; icon: number; radius: string }) => (
  <span
    className={cn(
      "relative inline-flex items-center justify-center shrink-0 border border-current/15 bg-current/[0.04]",
      radius
    )}
    style={{ width: frame, height: frame }}
    aria-hidden="true"
  >
    <Brain
      className="text-primary"
      style={{ width: icon, height: icon }}
      strokeWidth={1.75}
    />
  </span>
);

export const RecouplyLogo = ({
  size = "md",
  showText = true,
  variant = "auto",
  className,
}: RecouplyLogoProps) => {
  const config = sizeConfig[size];

  const colorClass =
    variant === "light"
      ? "text-white"
      : variant === "dark"
      ? "text-neutral-900"
      : "text-foreground";

  return (
    <div className={cn("inline-flex items-center", config.gap, colorClass, className)}>
      <RecouplyMark frame={config.frame} icon={config.icon} radius={config.radius} />
      {showText && (
        <span className="inline-flex items-baseline">
          <span
            className={cn("font-semibold tracking-tight leading-none", config.text)}
            style={{ letterSpacing: "-0.015em" }}
          >
            Recouply
          </span>
          <span
            className={cn("ml-0.5 font-medium leading-none text-primary", config.suffix)}
            style={{ letterSpacing: "0.02em" }}
          >
            .ai
          </span>
        </span>
      )}
    </div>
  );
};

export default RecouplyLogo;
