import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText, MessageSquare, Users, CheckCircle2, ShieldCheck,
  Lock, Send, PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApprovalReadiness, useFinalization } from "@/hooks/useApprovalWorkspace";

interface Stage {
  key: string; label: string; icon: any;
  isDone: (ctx: Ctx) => boolean;
  isActive?: (ctx: Ctx) => boolean;
}

type Ctx = {
  status: string;
  score: number;
  pending: number;
  open: number;
  finalized: boolean;
  signedSealed: boolean;
};

const STAGES: Stage[] = [
  { key: "draft", label: "Draft Created", icon: FileText, isDone: () => true },
  { key: "internal", label: "Internal Review", icon: Users, isDone: (c) => ["in_review","approved","executed","archived"].includes(c.status) || c.open > 0 || c.pending > 0 },
  { key: "external", label: "External Review", icon: MessageSquare, isDone: (c) => c.open === 0 && c.pending >= 0 && c.score > 20 },
  { key: "resolved", label: "Suggestions Resolved", icon: CheckCircle2, isDone: (c) => c.open === 0 },
  { key: "approvals", label: "Approvals Complete", icon: ShieldCheck, isDone: (c) => c.pending === 0 && c.score >= 100 },
  { key: "final", label: "Final Version Generated", icon: Lock, isDone: (c) => c.finalized },
  { key: "sent", label: "Sent for Signature", icon: Send, isDone: (c) => c.status === "executed" || c.signedSealed },
  { key: "signed", label: "Signed / Closed", icon: PenLine, isDone: (c) => c.status === "executed" || c.status === "archived" },
];

export const ApprovalTimeline = ({ instanceId, instanceStatus }: { instanceId: string; instanceStatus: string }) => {
  const { data: readiness } = useApprovalReadiness(instanceId);
  const { data: finalization } = useFinalization(instanceId);

  const ctx: Ctx = {
    status: instanceStatus,
    score: readiness?.score ?? 0,
    pending: readiness?.pending_approvals ?? 0,
    open: readiness?.open_suggestions ?? 0,
    finalized: !!(finalization as any)?.ready_for_signature,
    signedSealed: false,
  };

  const stages = STAGES.map((s) => ({ ...s, done: s.isDone(ctx) }));
  const lastDoneIdx = stages.reduce((acc, s, i) => (s.done ? i : acc), -1);

  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
        Approval Timeline
      </p>
      <ol className="relative border-l border-border ml-3 space-y-4">
        {stages.map((s, i) => {
          const Icon = s.icon;
          const active = i === lastDoneIdx + 1;
          return (
            <li key={s.key} className="ml-4">
              <span className={cn(
                "absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full border",
                s.done ? "bg-emerald-500 text-white border-emerald-600" :
                active ? "bg-amber-500 text-white border-amber-600" :
                "bg-background text-muted-foreground"
              )}>
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex items-center gap-2">
                <p className={cn("text-sm", s.done ? "font-medium" : "text-muted-foreground")}>{s.label}</p>
                {s.done && <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">done</Badge>}
                {active && <Badge variant="outline" className="text-[9px] h-4 bg-amber-500/10 text-amber-700 border-amber-500/30">in progress</Badge>}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};
