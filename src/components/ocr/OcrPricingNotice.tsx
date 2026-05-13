import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const OCR_PRICE_PER_PAGE_USD = 0.75;

interface OcrPricingNoticeProps {
  pageCount?: number;
  variant?: "inline" | "block";
  className?: string;
}

/**
 * Standardized callout for any UI that triggers AI Smart Ingestion.
 * Always communicates the $0.75 / page billing rate.
 */
export const OcrPricingNotice = ({
  pageCount,
  variant = "block",
  className,
}: OcrPricingNoticeProps) => {
  const estimated = pageCount && pageCount > 0
    ? `~$${(pageCount * OCR_PRICE_PER_PAGE_USD).toFixed(2)} for ${pageCount} page${pageCount === 1 ? "" : "s"}`
    : null;

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground inline-flex items-center gap-1", className)}>
        <Info className="h-3 w-3" />
        AI Smart Ingestion is billed at ${OCR_PRICE_PER_PAGE_USD.toFixed(2)} per page
        {estimated ? ` (${estimated})` : ""}.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2",
        className,
      )}
    >
      <Info className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <div className="font-medium">
          AI Smart Ingestion is billed at ${OCR_PRICE_PER_PAGE_USD.toFixed(2)} per page
        </div>
        <div className="opacity-90">
          {estimated
            ? `Estimated cost: ${estimated}. Track totals in Settings → Billing.`
            : "Pages are detected automatically after upload. Track totals in Settings → Billing."}
        </div>
      </div>
    </div>
  );
};

export default OcrPricingNotice;
