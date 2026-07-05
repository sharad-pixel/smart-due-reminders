import { BookOpen, ExternalLink } from "lucide-react";

export const ASC606_PWC_GUIDE_URL =
  "https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/revenue_from_contrac/assets/rrguide062026.pdf";

interface Props {
  variant?: "banner" | "inline";
  className?: string;
}

/**
 * Persistent reference to the PwC "Revenue from contracts with customers"
 * accounting guide (June 2026 edition). Displayed on every contract details
 * page and inside ASC 606 assessment surfaces so reviewers can consult the
 * authoritative source alongside our AI-generated compliance output.
 */
export function Asc606ReferenceBanner({ variant = "banner", className = "" }: Props) {
  if (variant === "inline") {
    return (
      <a
        href={ASC606_PWC_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs text-primary hover:underline ${className}`}
      >
        <BookOpen className="h-3.5 w-3.5" />
        PwC ASC 606 Guide (June 2026)
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <div
      className={`rounded-md border border-primary/20 bg-primary/5 px-3 py-2 flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span>
          <span className="font-medium text-foreground">ASC 606 reference:</span>{" "}
          PwC — Revenue from contracts with customers (June 2026 edition). Used for compliance
          methodology and cited by all AI-generated assessments on this contract.
        </span>
      </div>
      <a
        href={ASC606_PWC_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
      >
        Open PDF
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
