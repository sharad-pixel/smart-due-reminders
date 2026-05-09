import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentVersions } from "@/hooks/useClmInstance";

const TONE: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  published: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  sealed: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  superseded: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

export const VersionPill = ({ instanceId }: { instanceId: string }) => {
  const { data: versions = [] } = useDocumentVersions(instanceId);
  if (!versions.length) return null;
  // Active = draft or pending (the "live" one), else the highest-number version
  const active =
    versions.find((v: any) => v.status === "draft" || v.status === "pending") ?? versions[0];
  const lastPublished = versions.find((v: any) => v.status === "published" || v.status === "sealed");
  const tone = TONE[active.status] ?? TONE.draft;
  const label =
    active.status === "draft" ? "Draft" :
    active.status === "pending" ? "Pending Review" :
    active.status === "published" ? "Published" :
    active.status === "sealed" ? "Sealed" : "Superseded";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${tone} text-[11px] cursor-help`}>
            v{active.version_number} · {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">
          <p className="text-xs">
            Active version: <strong>v{active.version_number}</strong> ({label}).
            {lastPublished && lastPublished.id !== active.id && (
              <> Last published: v{lastPublished.version_number}.</>
            )}
            {" "}See the Document Versions panel below to manage approvals and reverts.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
