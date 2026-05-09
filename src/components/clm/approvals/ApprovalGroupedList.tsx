import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, X, Zap, Inbox } from "lucide-react";
import { useInstanceRevisions } from "@/hooks/useClmInstance";
import { useBulkReviewRevisions } from "@/hooks/useApprovalWorkspace";
import { RevisionChangeCard } from "@/components/clm/RevisionChangeCard";

const CATEGORY_LABELS: Record<string, string> = {
  legal: "Legal", pricing: "Pricing", security: "Security",
  compliance: "Compliance", commercial: "Commercial",
  formatting: "Formatting", other: "Other",
};

const RISK_TONE: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  high: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

interface Props {
  instanceId: string;
  myRole?: string | null;
  myUserId?: string | null;
  mentionables: any[];
}

export const ApprovalGroupedList = ({ instanceId, myRole, myUserId, mentionables }: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  const bulk = useBulkReviewRevisions(instanceId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pending = useMemo(
    () => revisions.filter((r: any) => r.approval_status === "pending"),
    [revisions]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of pending) {
      const key = r.change_category ?? "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pending]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const lowRiskIds = pending
    .filter((r: any) => r.risk_level === "low" || r.change_category === "formatting")
    .map((r: any) => r.id);

  if (pending.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">No pending approvals</p>
        <p className="text-xs text-muted-foreground">All suggested changes have been resolved.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <Card className="p-3 flex flex-wrap items-center justify-between gap-2 bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{pending.length}</span>
          <span className="text-muted-foreground">pending</span>
          {selected.size > 0 && (
            <Badge variant="secondary" className="ml-2">{selected.size} selected</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lowRiskIds.length > 0 && selected.size === 0 && (
            <Button
              size="sm" variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate({ revisionIds: lowRiskIds, decision: "approved", note: "Bulk approve low-risk" })}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Approve all low-risk ({lowRiskIds.length})
            </Button>
          )}
          {selected.size > 0 && (
            <>
              <Button
                size="sm" variant="outline"
                disabled={bulk.isPending}
                onClick={() => {
                  bulk.mutate({ revisionIds: Array.from(selected), decision: "rejected" });
                  setSelected(new Set());
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject selected
              </Button>
              <Button
                size="sm" disabled={bulk.isPending}
                onClick={() => {
                  bulk.mutate({ revisionIds: Array.from(selected), decision: "approved" });
                  setSelected(new Set());
                }}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve selected
              </Button>
            </>
          )}
        </div>
      </Card>

      <Accordion type="multiple" defaultValue={grouped.map(([k]) => k)} className="space-y-2">
        {grouped.map(([cat, items]) => (
          <AccordionItem key={cat} value={cat} className="border rounded-md bg-background">
            <AccordionTrigger className="px-3 py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-sm font-medium">
                {CATEGORY_LABELS[cat] ?? cat}
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                {items.some((i: any) => i.risk_level === "high") && (
                  <Badge variant="outline" className={RISK_TONE.high + " text-[10px]"}>high risk</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 space-y-2">
              {items.map((rev: any) => (
                <div key={rev.id} className="flex items-start gap-2">
                  <Checkbox
                    className="mt-3"
                    checked={selected.has(rev.id)}
                    onCheckedChange={() => toggle(rev.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="outline" className={`text-[9px] h-4 ${RISK_TONE[rev.risk_level ?? "low"]}`}>
                        {rev.risk_level ?? "low"} risk
                      </Badge>
                      {rev.suggested_by_external && (
                        <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-700 border-blue-500/30">
                          external
                        </Badge>
                      )}
                    </div>
                    <RevisionChangeCard
                      instanceId={instanceId}
                      revision={rev}
                      myRole={myRole}
                      myUserId={myUserId}
                      mentionables={mentionables}
                    />
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
