import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle2, FileWarning,
  Scale, DollarSign, Lock, Sparkles, Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApprovalReadiness } from "@/hooks/useApprovalWorkspace";

const CATEGORY_META: Record<string, { label: string; icon: any; tone: string }> = {
  legal:       { label: "Legal",        icon: Scale,     tone: "text-indigo-600 bg-indigo-500/10" },
  pricing:     { label: "Pricing",      icon: DollarSign,tone: "text-amber-600 bg-amber-500/10" },
  security:    { label: "Security",     icon: Lock,      tone: "text-rose-600 bg-rose-500/10" },
  compliance:  { label: "Compliance",   icon: ShieldCheck, tone: "text-emerald-600 bg-emerald-500/10" },
  commercial:  { label: "Commercial",   icon: Briefcase, tone: "text-sky-600 bg-sky-500/10" },
  formatting:  { label: "Formatting",   icon: Sparkles,  tone: "text-slate-600 bg-slate-500/10" },
  other:       { label: "Other",        icon: FileWarning,tone: "text-slate-600 bg-slate-500/10" },
};

export const ApprovalSidebar = ({ instanceId }: { instanceId: string }) => {
  const { data, isLoading } = useApprovalReadiness(instanceId);
  const score = data?.score ?? 0;
  const ringTone = score >= 90 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-rose-600";

  return (
    <Card className="p-4 space-y-4 sticky top-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Signature Readiness
          </p>
          <span className={cn("text-2xl font-bold", ringTone)}>{score}%</span>
        </div>
        <Progress value={score} className="h-2" />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {isLoading ? "Calculating…" : score === 100 ? "Ready for signature" : `${data?.pending_approvals ?? 0} approvals · ${data?.open_suggestions ?? 0} open suggestions`}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Approvals by Area
        </p>
        <div className="space-y-1.5">
          {Object.keys(CATEGORY_META).map((key) => {
            const meta = CATEGORY_META[key];
            const stats = data?.by_category?.[key];
            if (!stats || stats.total === 0) return null;
            const Icon = meta.icon;
            const allDone = stats.pending === 0 && stats.rejected === 0;
            return (
              <div key={key} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn("p-1 rounded", meta.tone)}><Icon className="h-3 w-3" /></span>
                  <span className="truncate">{meta.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {allDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {stats.approved}/{stats.total}
                  </span>
                </div>
              </div>
            );
          })}
          {(!data || Object.keys(data?.by_category ?? {}).length === 0) && (
            <p className="text-[11px] text-muted-foreground italic">No approvals routed yet.</p>
          )}
        </div>
      </div>

      {(data?.blockers?.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Blockers
          </p>
          <div className="space-y-1.5">
            {data!.blockers.map((b, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{b.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {score === 100 && (
        <Badge className="w-full justify-center bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Cleared for finalization
        </Badge>
      )}
    </Card>
  );
};
