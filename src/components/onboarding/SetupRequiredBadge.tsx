import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SetupRequiredBadgeProps {
  /** Whether the setup item is still incomplete */
  show: boolean;
  /** Label shown next to the icon */
  label?: string;
  /** Optional className override for the wrapper */
  className?: string;
}

/**
 * Inline badge that highlights a section/field as required for onboarding setup.
 * Only renders when `show` is true (i.e., the item is incomplete).
 */
export const SetupRequiredBadge = ({ show, label = "Required for setup", className }: SetupRequiredBadgeProps) => {
  if (!show) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
        className
      )}
    >
      <AlertTriangle className="h-3 w-3 animate-pulse" />
      {label}
    </span>
  );
};

/**
 * Wraps a Card or section with a highlighted border when setup is incomplete.
 */
export const SetupRequiredWrapper = ({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) => {
  if (!show) return <>{children}</>;

  return (
    <div className={cn("relative ring-2 ring-amber-400/60 dark:ring-amber-600/60 rounded-lg", className)}>
      {children}
    </div>
  );
};
