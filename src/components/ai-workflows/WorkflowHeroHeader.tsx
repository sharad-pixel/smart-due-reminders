import { Button } from "@/components/ui/button";
import { Sparkles, Workflow, Zap, Loader2, Factory } from "lucide-react";

interface WorkflowHeroHeaderProps {
  onGenerateAllTemplates: () => void;
  onReassignAll: () => void;
  onRunEngine: () => void;
  onIndustryOutreach: () => void;
  generatingAllTemplates: boolean;
  reassigning: boolean;
  isRunningEngine: boolean;
}

export function WorkflowHeroHeader({
  onGenerateAllTemplates,
  onReassignAll,
  onRunEngine,
  onIndustryOutreach,
  generatingAllTemplates,
  reassigning,
  isRunningEngine,
}: WorkflowHeroHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Collection Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Automated outreach powered by AI agents that adapt to invoice aging
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onIndustryOutreach}
            className="gap-1.5"
          >
            <Factory className="h-3.5 w-3.5" />
            Industry Outreach
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReassignAll}
            disabled={reassigning}
            className="gap-1.5"
          >
            {reassigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Workflow className="h-3.5 w-3.5" />}
            {reassigning ? "Reassigning..." : "Reassign Buckets"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateAllTemplates}
            disabled={generatingAllTemplates}
            className="gap-1.5"
          >
            {generatingAllTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generatingAllTemplates ? "Generating..." : "Generate Templates"}
          </Button>
          <Button
            size="sm"
            onClick={onRunEngine}
            disabled={isRunningEngine}
            className="gap-1.5"
          >
            <Zap className={`h-3.5 w-3.5 ${isRunningEngine ? "animate-pulse" : ""}`} />
            {isRunningEngine ? "Running..." : "Run Outreach Engine"}
          </Button>
        </div>
      </div>
    </div>
  );
}
