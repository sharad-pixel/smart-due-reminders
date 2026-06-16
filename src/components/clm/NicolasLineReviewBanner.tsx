import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NicolasLineReviewDialog } from "./NicolasLineReviewDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  importId: string;
  status: string | null | undefined;
  ackAt: string | null | undefined;
}

const TRIGGER_STATUSES = new Set([
  "completed",
  "extracted",
  "scanned",
  "ai_extracted",
  "ready",
  "published",
]);

export function NicolasLineReviewBanner({ importId, status, ackAt }: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  if (ackAt || dismissed) return null;
  if (status && !TRIGGER_STATUSES.has(status)) return null;

  const dismiss = async () => {
    setDismissed(true);
    await supabase
      .from("live_contract_imports")
      .update({ nicolas_line_review_ack_at: new Date().toISOString() } as any)
      .eq("id", importId);
    qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
  };

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Nicolas suggests reviewing the Order Form lines</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Fixed Fee Professional Services, Implementation, Onboarding, and other one-time charges are often missed inside pricing tables. Run a quick review to verify nothing is missing or miscategorized.
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run Nicolas review
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              I've reviewed — dismiss
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <NicolasLineReviewDialog
        open={open}
        onOpenChange={setOpen}
        importId={importId}
        onApplied={() => qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] })}
      />
    </>
  );
}
