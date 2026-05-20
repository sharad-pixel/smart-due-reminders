import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Eye, FileSearch, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Phase = "scanned" | "under_review" | "extracted";

const SCANNING = new Set(["found", "queued", "scanning", "ocr_processing", "ai_extracting", "processing", "extracting"]);
const REVIEW = new Set(["needs_review"]);
const EXTRACTED = new Set(["imported", "approved"]);

export const phaseFromStatus = (status?: string | null): Phase => {
  const s = String(status || "").toLowerCase();
  if (EXTRACTED.has(s)) return "extracted";
  if (REVIEW.has(s)) return "under_review";
  if (SCANNING.has(s)) return "scanned";
  // Treat anything else (failed, archived, duplicate, etc.) as review-stage by default
  return "under_review";
};

interface Props {
  importId: string;
  status: string | null | undefined;
}

/**
 * Visual stepper for the contract lifecycle:
 *   Scanned  →  Under Review  →  Extracted
 *
 * Provides a "Mark review complete" action that flips status to `imported`.
 */
export const ContractStatusStepper = ({ importId, status }: Props) => {
  const qc = useQueryClient();
  const phase = phaseFromStatus(status);
  const [busy, setBusy] = useState(false);

  const completeReview = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "complete_review" },
      });
      if (error) throw new Error(error.message || "Failed");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onMutate: () => setBusy(true),
    onSuccess: () => {
      toast.success("Review completed — contract marked as Extracted.");
      qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not complete review"),
    onSettled: () => setBusy(false),
  });

  const steps: { key: Phase; label: string; icon: any; hint: string }[] = [
    { key: "scanned", label: "Scanned", icon: FileSearch, hint: "AI extracting terms" },
    { key: "under_review", label: "Under Review", icon: Eye, hint: "Validate against the document" },
    { key: "extracted", label: "Extracted", icon: CheckCircle2, hint: "Validated & ready" },
  ];

  const reached = (key: Phase) => {
    const order = { scanned: 0, under_review: 1, extracted: 2 } as const;
    return order[key] <= order[phase];
  };
  const isCurrent = (key: Phase) => key === phase;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const done = reached(s.key) && !isCurrent(s.key);
              const current = isCurrent(s.key);
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                        current
                          ? "border-primary bg-primary/10 text-primary"
                          : done
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-muted bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-xs sm:text-sm">
                      <div className={`font-medium ${current ? "text-foreground" : done ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground hidden sm:block">{s.hint}</div>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>

          {phase === "under_review" && (
            <Button
              size="sm"
              onClick={() => completeReview.mutate()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Mark review complete
            </Button>
          )}
          {phase === "scanned" && (
            <span className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI is extracting — this page will refresh automatically.
            </span>
          )}
          {phase === "extracted" && (
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Validated
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContractStatusStepper;
