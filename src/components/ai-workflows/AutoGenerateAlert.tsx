import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DisabledWorkflow {
  id: string;
  name: string;
  aging_bucket: string;
  invoiceCount: number;
}

interface AutoGenerateAlertProps {
  workflows: {
    id: string;
    name: string;
    aging_bucket: string;
    is_active: boolean;
    auto_generate_drafts?: boolean;
  }[];
  bucketCounts: Record<string, number>;
  onWorkflowsUpdated: () => void;
}

const BUCKET_LABELS: Record<string, string> = {
  dpd_1_30: "1-30 Days",
  dpd_31_60: "31-60 Days",
  dpd_61_90: "61-90 Days",
  dpd_91_120: "91-120 Days",
  dpd_121_150: "121-150 Days",
  dpd_150_plus: "150+ Days",
};

// Map aging_bucket to personaConfig keys for bucket counts
const BUCKET_TO_PERSONA: Record<string, string> = {
  dpd_1_30: "sam",
  dpd_31_60: "james",
  dpd_61_90: "katy",
  dpd_91_120: "troy",
  dpd_121_150: "jimmy",
  dpd_150_plus: "rocco",
};

export function AutoGenerateAlert({ workflows, bucketCounts, onWorkflowsUpdated }: AutoGenerateAlertProps) {
  const [enabling, setEnabling] = useState<Record<string, boolean>>({});
  const [enablingAll, setEnablingAll] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Find active workflows with auto_generate_drafts off that have invoices
  const disabledWorkflows: DisabledWorkflow[] = workflows
    .filter(w => w.is_active && !w.auto_generate_drafts)
    .map(w => {
      const personaKey = BUCKET_TO_PERSONA[w.aging_bucket];
      const invoiceCount = personaKey ? (bucketCounts[personaKey] || 0) : 0;
      return {
        id: w.id,
        name: w.name,
        aging_bucket: w.aging_bucket,
        invoiceCount,
      };
    })
    .filter(w => w.invoiceCount > 0);

  if (disabledWorkflows.length === 0 || dismissed) return null;

  const totalInvoicesAffected = disabledWorkflows.reduce((sum, w) => sum + w.invoiceCount, 0);

  const handleEnableOne = async (workflowId: string) => {
    setEnabling(prev => ({ ...prev, [workflowId]: true }));
    try {
      const { error } = await supabase
        .from("collection_workflows")
        .update({ auto_generate_drafts: true })
        .eq("id", workflowId);
      if (error) throw error;
      toast.success("Auto-generate enabled for workflow");
      onWorkflowsUpdated();
    } catch {
      toast.error("Failed to enable auto-generate");
    } finally {
      setEnabling(prev => ({ ...prev, [workflowId]: false }));
    }
  };

  const handleEnableAll = async () => {
    setEnablingAll(true);
    try {
      const ids = disabledWorkflows.map(w => w.id);
      const { error } = await supabase
        .from("collection_workflows")
        .update({ auto_generate_drafts: true })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Auto-generate enabled for ${ids.length} workflow(s)`);
      onWorkflowsUpdated();
    } catch {
      toast.error("Failed to enable auto-generate");
    } finally {
      setEnablingAll(false);
    }
  };

  return (
    <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-2">
        Outreach Paused for {totalInvoicesAffected} Invoice{totalInvoicesAffected !== 1 ? "s" : ""}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Auto-generate is turned off for {disabledWorkflows.length} active workflow{disabledWorkflows.length !== 1 ? "s" : ""} that have past-due invoices. No outreach drafts will be created until enabled.
        </p>

        <div className="space-y-2">
          {disabledWorkflows.map(w => (
            <div
              key={w.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/60 dark:bg-white/5 border border-amber-200/60 dark:border-amber-800/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="shrink-0 text-xs border-amber-400/50 text-amber-700 dark:text-amber-300">
                  {BUCKET_LABELS[w.aging_bucket] || w.aging_bucket}
                </Badge>
                <span className="text-sm font-medium truncate">{w.invoiceCount} invoice{w.invoiceCount !== 1 ? "s" : ""}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={() => handleEnableOne(w.id)}
                disabled={enabling[w.id]}
              >
                {enabling[w.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Enable
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleEnableAll}
            disabled={enablingAll}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {enablingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Enable All ({disabledWorkflows.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-600 dark:text-amber-400"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
