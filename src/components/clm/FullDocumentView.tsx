import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2 } from "lucide-react";
import { InlineDiff } from "./InlineDiff";
import { useInstanceRevisions } from "@/hooks/useClmInstance";
import { SectionEditDialog } from "./SectionEditDialog";

interface Props {
  instanceId?: string;
  sections: any[];
  title?: string;
  description?: string;
  contacts?: any[];
  canEdit?: boolean;
}

/**
 * Full document view: renders all sections in document order as one
 * continuous read-only contract, with pending track-changes shown inline
 * (red strike-through → green insertion) per section.
 */
export const FullDocumentView = ({ instanceId, sections, title, description, contacts = [], canEdit = false }: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId ?? "");

  const pendingBySection = useMemo(() => {
    const m = new Map<string, any[]>();
    if (!instanceId) return m;
    (revisions as any[])
      .filter((r) => r.approval_status === "pending")
      .forEach((r) => {
        const arr = m.get(r.section_id) ?? [];
        arr.push(r);
        m.set(r.section_id, arr);
      });
    // newest pending first per section
    m.forEach((arr) => arr.sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)));
    return m;
  }, [revisions, instanceId]);

  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No sections to display.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title ?? "Full document"}</CardTitle>
        <CardDescription>
          {description ?? "All sections rendered in document order. Pending track-changes appear inline."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded border bg-background">
          <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-8 max-h-[75vh] overflow-y-auto">
            {sections.map((s: any, idx: number) => {
              const pending = pendingBySection.get(s.id) ?? [];
              const latestPending = pending[0];
              return (
                <section key={s.id} className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                    <h3 className="text-sm font-semibold uppercase tracking-wide">{s.title}</h3>
                    {pending.length > 0 ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5">
                        <Clock className="h-2.5 w-2.5 mr-1" />
                        {pending.length} pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] h-5">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                        Clean
                      </Badge>
                    )}
                  </div>

                  {latestPending ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground italic">
                        Proposed by {latestPending.edited_by_name || "collaborator"} ·
                        {" "}awaiting approval
                      </p>
                      <InlineDiff
                        before={latestPending.previous_body ?? s.body ?? ""}
                        after={latestPending.new_body ?? ""}
                        showStats={false}
                        className=""
                      />
                      {pending.length > 1 && (
                        <p className="text-[11px] text-muted-foreground">
                          + {pending.length - 1} earlier pending revision{pending.length - 1 === 1 ? "" : "s"} on this section.
                        </p>
                      )}
                    </div>
                  ) : s.body ? (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{s.body}</p>
                  ) : (
                    <p className="text-[12px] text-muted-foreground italic">[empty section]</p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
