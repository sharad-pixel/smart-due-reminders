import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface WorkflowStep {
  id: string;
  label: string;
  body_template: string;
  subject_template?: string;
  channel: "email" | "sms";
  is_active: boolean;
}

interface IncompleteWorkflowAlertProps {
  steps: WorkflowStep[];
  stepDraftCounts: Record<string, number>;
  workflowName: string;
}

export function IncompleteWorkflowAlert({ steps, stepDraftCounts, workflowName }: IncompleteWorkflowAlertProps) {
  const issues: { step: WorkflowStep; reason: string }[] = [];

  for (const step of steps) {
    if (!step.is_active) continue;

    const hasEmptyBody = !step.body_template || step.body_template.trim().length < 20;
    const hasMissingSubject = step.channel === "email" && (!step.subject_template || step.subject_template.trim().length < 3);
    const hasDrafts = (stepDraftCounts[step.id] || 0) > 0;

    if (hasEmptyBody) {
      issues.push({ step, reason: "Missing or incomplete email body" });
    } else if (hasMissingSubject) {
      issues.push({ step, reason: "Missing email subject line" });
    }

    if (!hasDrafts && !hasEmptyBody) {
      issues.push({ step, reason: "No AI template generated yet" });
    }
  }

  if (issues.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 dark:text-amber-400">
        Incomplete Workflow: {workflowName}
      </AlertTitle>
      <AlertDescription>
        <p className="text-sm text-muted-foreground mb-2">
          {issues.length} step{issues.length !== 1 ? "s" : ""} need attention before outreach can run properly.
        </p>
        <ul className="space-y-1">
          {issues.map(({ step, reason }) => (
            <li key={`${step.id}-${reason}`} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs shrink-0">{step.label}</Badge>
              <span className="text-muted-foreground">{reason}</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
