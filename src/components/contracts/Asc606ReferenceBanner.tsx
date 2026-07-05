import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react";

export const ASC606_PWC_GUIDE_URL =
  "https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/revenue_from_contrac/assets/rrguide062026.pdf";

export const ASC606_PWC_GUIDE_TITLE = "Revenue from contracts with customers";
export const ASC606_PWC_GUIDE_EDITION = "PwC Guide · June 2026 edition";

/**
 * Small stylized "pwc" wordmark tile. This is a text mark rendered in
 * PwC's recognizable orange accent — not the trademarked logotype — used
 * as a compliance citation next to the linked PwC accounting guide.
 */
export function PwcMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "sm"
      ? "h-6 w-10 text-[10px]"
      : size === "lg"
      ? "h-10 w-16 text-base"
      : "h-8 w-12 text-xs";
  return (
    <div
      aria-label="PwC"
      className={`inline-flex items-center justify-center rounded-sm bg-[#2d2d2d] text-white font-bold tracking-tight relative overflow-hidden shrink-0 ${dims}`}
    >
      <span className="relative z-10">pwc</span>
      <span
        aria-hidden
        className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm bg-[#e0301e]"
      />
      <span
        aria-hidden
        className="absolute -bottom-1 right-2 h-2 w-2 rounded-sm bg-[#eb8c00]"
      />
      <span
        aria-hidden
        className="absolute -bottom-1 right-4 h-1.5 w-1.5 rounded-sm bg-[#ffb600]"
      />
    </div>
  );
}

interface Props {
  variant?: "banner" | "inline" | "compact";
  className?: string;
}

/**
 * Persistent reference to the PwC "Revenue from contracts with customers"
 * accounting guide (June 2026 edition). Shown on every contract details
 * page, in the Revenue Library, and inside ASC 606 assessment surfaces so
 * reviewers and end users can consult the authoritative source alongside
 * AI-generated compliance output.
 */
export function Asc606ReferenceBanner({ variant = "banner", className = "" }: Props) {
  if (variant === "inline") {
    return (
      <a
        href={ASC606_PWC_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-xs text-primary hover:underline ${className}`}
      >
        <PwcMark size="sm" />
        <span>{ASC606_PWC_GUIDE_EDITION}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 ${className}`}
      >
        <PwcMark size="sm" />
        <div className="text-[11px] leading-tight">
          <div className="font-medium text-foreground">Compliance reference</div>
          <a
            href={ASC606_PWC_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            {ASC606_PWC_GUIDE_EDITION}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <PwcMark size="md" />
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            ASC 606 compliance reference
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            <span className="font-medium text-foreground">{ASC606_PWC_GUIDE_TITLE}</span>{" "}
            — {ASC606_PWC_GUIDE_EDITION}. Used by every AI assessment on this contract.
          </div>
        </div>
      </div>
      <a
        href={ASC606_PWC_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Open PDF
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
