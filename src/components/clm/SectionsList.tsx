import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { History, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useInstanceRevisions } from "@/hooks/useClmInstance";
import { SectionEditDialog } from "./SectionEditDialog";
import { SectionVersionHistoryDialog } from "./SectionVersionHistoryDialog";
import { SectionCommentsPanel } from "./SectionCommentsPanel";

interface Props {
  instanceId: string;
  sections: any[];
  comments: any[];
  contacts: any[];
  emptyText?: string;
}

export const SectionsList = ({ instanceId, sections, comments, contacts, emptyText }: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  const revsBySection = (revisions as any[]).reduce((m, r) => {
    const arr = m.get(r.section_id) ?? [];
    arr.push(r);
    m.set(r.section_id, arr);
    return m;
  }, new Map<string, any[]>());

  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {emptyText ?? "No sections yet."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sections</CardTitle>
        <CardDescription>Discuss each clause, track every change, and route revisions for approval.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {sections.map((s: any) => {
            const sectionRevs = (revsBySection.get(s.id) ?? [])
              .sort((a: any, b: any) => (b.version_number ?? 0) - (a.version_number ?? 0));
            const latest = sectionRevs[0];
            const currentVersion = latest?.version_number ?? 1;
            const pendingCount = sectionRevs.filter((r: any) => r.approval_status === "pending").length;
            const commentCount = comments.filter((c: any) => c.section_key === s.section_key).length;

            return (
              <AccordionItem key={s.id} value={s.id}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2 flex-wrap text-left">
                    <span className="font-medium">{s.title}</span>
                    <Badge variant="outline" className="font-mono text-[10px] h-5">v{currentVersion}</Badge>
                    {pendingCount > 0 ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5">
                        <Clock className="h-2.5 w-2.5 mr-1" />{pendingCount} pending
                      </Badge>
                    ) : latest?.approval_status === "approved" ? (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] h-5">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Approved
                      </Badge>
                    ) : null}
                    {commentCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        <MessageSquare className="h-2.5 w-2.5 mr-1" />{commentCount}
                      </Badge>
                    )}
                    {latest && (
                      <span className="text-[11px] text-muted-foreground ml-1">
                        · {latest.edited_by_name || "Edited"} {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {s.ai_summary && (
                    <div className="rounded bg-primary/5 border border-primary/20 p-3 mb-3">
                      <p className="text-sm">{s.ai_summary}</p>
                    </div>
                  )}
                  {s.body && (
                    <div className="rounded border p-3 bg-muted/30 mb-3">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.body}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="text-[11px] text-muted-foreground">
                      {sectionRevs.length} version{sectionRevs.length === 1 ? "" : "s"} on record
                    </div>
                    <div className="flex gap-1">
                      <SectionVersionHistoryDialog
                        instanceId={instanceId}
                        section={s}
                        trigger={
                          <Button size="sm" variant="ghost">
                            <History className="h-3.5 w-3.5 mr-1" /> History
                          </Button>
                        }
                      />
                      <SectionEditDialog instanceId={instanceId} section={s} currentVersion={currentVersion} contacts={contacts} />
                    </div>
                  </div>
                  <SectionCommentsPanel instanceId={instanceId} sectionKey={s.section_key} comments={comments} contacts={contacts} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};
