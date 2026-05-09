import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PenLine, Lock } from "lucide-react";
import { useApprovalReadiness, useFinalization } from "@/hooks/useApprovalWorkspace";

export const SignatureReadyButton = ({ instanceId, onClick }: { instanceId: string; onClick: () => void }) => {
  const { data: readiness } = useApprovalReadiness(instanceId);
  const { data: finalization } = useFinalization(instanceId);
  const ready = !!(finalization as any)?.ready_for_signature || (readiness?.score ?? 0) === 100;

  const btn = (
    <Button size="sm" onClick={onClick} className="gap-1" disabled={!ready}>
      {ready ? <PenLine className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      Prepare for signature
    </Button>
  );

  if (ready) return btn;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
        <TooltipContent>
          Complete all approvals (currently {readiness?.score ?? 0}% ready) to unlock signature.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
