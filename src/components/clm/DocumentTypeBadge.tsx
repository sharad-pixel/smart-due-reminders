import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ScrollText,
  FilePlus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Receipt,
  Undo2,
  Gauge,
  Wrench,
  Briefcase,
  ShieldCheck,
  Lock,
  FileQuestion,
  DollarSign,
  FileSignature,
} from "lucide-react";

/**
 * Canonical, machine-friendly document types used by the classifier.
 * Mirrors the CHECK constraint on live_contract_imports.document_type.
 */
export type DocumentType =
  | "msa"
  | "order_form"
  | "amendment"
  | "renewal_order"
  | "expansion_order"
  | "reduction_order"
  | "sow"
  | "pricing_exhibit"
  | "purchase_order"
  | "invoice"
  | "credit_memo"
  | "usage_report"
  | "change_order"
  | "professional_services_agreement"
  | "baa"
  | "dpa"
  | "other";

interface Meta {
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Semantic tone — mapped to tailwind classes below. */
  tone:
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "neutral";
}

export const DOCUMENT_TYPE_META: Record<DocumentType, Meta> = {
  msa:                              { label: "Master Service Agreement", short: "MSA",        icon: ScrollText,    tone: "primary" },
  order_form:                       { label: "Order Form",               short: "Order",      icon: FileSignature, tone: "info"    },
  amendment:                        { label: "Amendment",                short: "Amend.",     icon: FilePlus,      tone: "warning" },
  renewal_order:                    { label: "Renewal Order",            short: "Renewal",    icon: RefreshCw,     tone: "success" },
  expansion_order:                  { label: "Expansion Order",          short: "Expansion",  icon: TrendingUp,    tone: "success" },
  reduction_order:                  { label: "Reduction Order",          short: "Reduction",  icon: TrendingDown,  tone: "danger"  },
  sow:                              { label: "Statement of Work",        short: "SOW",        icon: ClipboardList, tone: "info"    },
  pricing_exhibit:                  { label: "Pricing Exhibit",          short: "Pricing",    icon: DollarSign,    tone: "info"    },
  purchase_order:                   { label: "Purchase Order",           short: "PO",         icon: Receipt,       tone: "primary" },
  invoice:                          { label: "Invoice",                  short: "Invoice",    icon: Receipt,       tone: "neutral" },
  credit_memo:                      { label: "Credit Memo",              short: "Credit",     icon: Undo2,         tone: "warning" },
  usage_report:                     { label: "Usage Report",             short: "Usage",      icon: Gauge,         tone: "info"    },
  change_order:                     { label: "Change Order",             short: "Change",     icon: Wrench,        tone: "warning" },
  professional_services_agreement:  { label: "Professional Services Agreement", short: "PSA", icon: Briefcase,     tone: "primary" },
  baa:                              { label: "Business Associate Agreement",    short: "BAA", icon: ShieldCheck,   tone: "primary" },
  dpa:                              { label: "Data Processing Addendum",        short: "DPA", icon: Lock,          tone: "primary" },
  other:                            { label: "Other",                    short: "Other",      icon: FileQuestion,  tone: "neutral" },
};

const TONE_CLASS: Record<Meta["tone"], string> = {
  primary: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  danger:  "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  info:    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  neutral: "bg-muted text-muted-foreground border-border",
};

interface Props {
  type?: string | null;
  confidence?: number | null;
  /** Show full label instead of short. */
  full?: boolean;
  /** Hide the leading icon. */
  hideIcon?: boolean;
  className?: string;
}

/**
 * Display badge for a classified contract document. Falls back to a neutral
 * "Unclassified" chip when the AI hasn't tagged the document yet.
 */
export const DocumentTypeBadge = ({
  type,
  confidence,
  full = false,
  hideIcon = false,
  className = "",
}: Props) => {
  const key = (type || "").toLowerCase() as DocumentType;
  const meta = DOCUMENT_TYPE_META[key];

  if (!meta) {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-normal gap-1 ${TONE_CLASS.neutral} ${className}`}
      >
        {!hideIcon && <FileText className="h-3 w-3" />}
        Unclassified
      </Badge>
    );
  }

  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium gap-1 ${TONE_CLASS[meta.tone]} ${className}`}
      title={confidence != null ? `${meta.label} · ${Math.round(confidence)}% confidence` : meta.label}
    >
      {!hideIcon && <Icon className="h-3 w-3" />}
      {full ? meta.label : meta.short}
      {confidence != null && confidence < 70 && (
        <span className="opacity-70 ml-0.5">?</span>
      )}
    </Badge>
  );
};

export default DocumentTypeBadge;
