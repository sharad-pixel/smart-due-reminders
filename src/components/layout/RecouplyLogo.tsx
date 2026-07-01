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
  sm: { mark: 20, text: "text-sm", suffix: "text-[10px]", gap: "gap-2" },
  md: { mark: 26, text: "text-base sm:text-lg", suffix: "text-[10px]", gap: "gap-2.5" },
  lg: { mark: 30, text: "text-xl", suffix: "text-[11px]", gap: "gap-2.5" },
  xl: { mark: 44, text: "text-3xl sm:text-4xl", suffix: "text-xs", gap: "gap-3" },
};

/**
 * Recouply monogram — a stacked "R + coupling loop" motif.
 * The mark reads as an R whose bowl seamlessly loops back through
 * a second arc, evoking the contract → cash → contract loop.
 * Rendered monochrome via currentColor with a single accent stroke.
 */
const RecouplyMark = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="shrink-0"
  >
    {/* outer rounded frame — the "seal" */}
    <rect
      x="1.5"
      y="1.5"
      width="37"
      height="37"
      rx="9"
      stroke="currentColor"
      strokeOpacity="0.18"
      strokeWidth="1"
    />
    {/* R stem */}
    <path
      d="M11.5 10 V30"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
    />
    {/* R bowl */}
    <path
      d="M11.5 10 H21 a5.5 5.5 0 0 1 0 11 H11.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
    {/* R leg */}
    <path
      d="M18.5 21 L28.5 30"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
    />
    {/* coupling loop — the accent, closes contract→cash */}
    <path
      d="M25 10 a5 5 0 1 1 -0.01 0"
      stroke="hsl(var(--primary))"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
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
    <div
      className={cn("inline-flex items-center", config.gap, colorClass, className)}
    >
      <RecouplyMark size={config.mark} />
      {showText && (
        <span className="inline-flex items-baseline">
          <span
            className={cn(
              "font-semibold tracking-tight leading-none",
              config.text
            )}
            style={{ letterSpacing: "-0.015em" }}
          >
            Recouply
          </span>
          <span
            className={cn(
              "ml-0.5 font-medium leading-none text-primary",
              config.suffix
            )}
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
