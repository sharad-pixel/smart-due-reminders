import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Lock, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
import { useApprovalReadiness, useFinalization, useFinalizeInstance } from "@/hooks/useApprovalWorkspace";
import { formatDistanceToNow } from "date-fns";

export const FinalizationPanel = ({ instanceId }: { instanceId: string }) => {
  const { data: readiness } = useApprovalReadiness(instanceId);
  const { data: finalization } = useFinalization(instanceId);
  const finalize = useFinalizeInstance(instanceId);
  const [note, setNote] = useState("");

  const score = readiness?.score ?? 0;
  const ready = score === 100;
  const finalized = !!(finalization as any)?.ready_for_signature;

  if (finalized) {
    const f = finalization as any;
    return (
      <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-emerald-700 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-emerald-900">Final Executable Version Locked</p>
              <Badge className="bg-emerald-600 text-white border-0">Ready for Signature</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Approved by {f.final_approved_by_name ?? "—"}
              {f.final_approved_at && ` · ${formatDistanceToNow(new Date(f.final_approved_at), { addSuffix: true })}`}
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              The approved version is immutable. Any new edits will create a new draft version.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded ${ready ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>
          {ready ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {ready ? "All approvals complete" : "Finalization pending"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ready
              ? "Generate the final executable version to unlock signature send."
              : `Resolve remaining blockers to reach 100% readiness (currently ${score}%).`}
          </p>
        </div>
      </div>

      {ready && (
        <>
          <Textarea
            placeholder="Optional final-approval note (e.g., 'CFO sign-off complete')…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs mb-2"
            rows={2}
          />
          <Button
            className="w-full gap-1.5"
            disabled={finalize.isPending}
            onClick={() => finalize.mutate(note || undefined)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Final Executable Version
          </Button>
        </>
      )}

      {!ready && (readiness?.blockers?.length ?? 0) > 0 && (
        <div className="mt-2 space-y-1">
          {readiness!.blockers.map((b, i) => (
            <p key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> {b.message}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
};
