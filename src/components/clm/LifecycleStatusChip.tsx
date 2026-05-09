import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PencilLine,
  ShieldCheck,
  Send,
  MessageSquareReply,
  RefreshCw,
  FileSignature,
  Lock,
  type LucideIcon,
} from "lucide-react";

export type LifecycleLabel =
  | "internal_draft"
  | "internal_reviewed"
  | "shared_externally"
  | "external_feedback"
  | "revised_draft"
  | "approved_for_signature"
  | "signed_sealed";

interface Meta {
  label: string;
  short: string;
  icon: LucideIcon;
  className: string;
  versionPrefix: string;
}

const META: Record<LifecycleLabel, Meta> = {
  internal_draft: {
    label: "Internal Draft",
    short: "Draft",
    icon: PencilLine,
    versionPrefix: "v1",
    className: "bg-muted text-foreground border-border",
  },
  internal_reviewed: {
    label: "Internal Reviewed",
    short: "Reviewed",
    icon: ShieldCheck,
    versionPrefix: "v2",
    className: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  },
  shared_externally: {
    label: "Shared Externally",
    short: "Shared",
    icon: Send,
    versionPrefix: "v3",
    className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
  },
  external_feedback: {
    label: "External Feedback Received",
    short: "Feedback",
    icon: MessageSquareReply,
    versionPrefix: "v4",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  },
  revised_draft: {
    label: "Revised Draft",
    short: "Revised",
    icon: RefreshCw,
    versionPrefix: "v5",
    className: "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300",
  },
  approved_for_signature: {
    label: "Approved for Signature",
    short: "Approved",
    icon: FileSignature,
    versionPrefix: "v6",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  },
  signed_sealed: {
    label: "Signed / Sealed",
    short: "Sealed",
    icon: Lock,
    versionPrefix: "v7",
    className: "bg-emerald-600 text-white border-emerald-600",
  },
};

export const LIFECYCLE_LABELS: { value: LifecycleLabel; label: string }[] =
  (Object.keys(META) as LifecycleLabel[]).map((k) => ({ value: k, label: META[k].label }));

interface Props {
  status: LifecycleLabel | string | null | undefined;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const LifecycleStatusChip = ({ status, showIcon = true, size = "md", className }: Props) => {
  const key = ((status as string) ?? "internal_draft") as LifecycleLabel;
  const meta = META[key] ?? META.internal_draft;
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium border",
        meta.className,
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-[11px]",
        className,
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {meta.label}
    </Badge>
  );
};

export const lifecycleVersionPrefix = (status: string | null | undefined): string => {
  const key = ((status as string) ?? "internal_draft") as LifecycleLabel;
  return (META[key] ?? META.internal_draft).versionPrefix;
};
