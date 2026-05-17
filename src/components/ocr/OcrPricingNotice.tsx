import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const OCR_PRICE_PER_PAGE_USD = 1.00;
export const OCR_PRICE_LABEL = "1 credit / page";

interface OcrPricingNoticeProps {
  pageCount?: number;
  variant?: "inline" | "block";
  className?: string;
}

/**
 * Standardized callout for any UI that triggers AI Smart Ingestion.
 * Always communicates the 1 credit ($1.00) per page billing rate.
 */
export const OcrPricingNotice = ({
  pageCount,
  variant = "block",
  className,
}: OcrPricingNoticeProps) => {
  const estimated = pageCount && pageCount > 0
    ? `${pageCount} credit${pageCount === 1 ? "" : "s"} for ${pageCount} page${pageCount === 1 ? "" : "s"} (~$${(pageCount * OCR_PRICE_PER_PAGE_USD).toFixed(2)})`
    : null;

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground inline-flex items-center gap-1", className)}>
        <Info className="h-3 w-3" />
        AI Smart Ingestion is billed at 1 credit per page
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
          AI Smart Ingestion is billed at 1 credit per page
        </div>
        <div className="opacity-90">
          {estimated
            ? `Estimated cost: ${estimated}. `
            : "Pages are detected automatically after upload. "}
          Drawn from your Platform Credits balance ($0.80/credit pre-paid) or accrued as overage at $1.00/credit. Manage at{" "}
          <a className="underline" href="/billing?tab=credits">Billing → Credits</a>.
        </div>
      </div>
    </div>
  );
};

export default OcrPricingNotice;
