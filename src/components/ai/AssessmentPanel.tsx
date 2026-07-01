import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Pin, MessageSquarePlus, Loader2, Bot, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type AssessmentScope = "asc606" | "contract_intelligence" | "collectability" | "revenue_risk" | "other";

export interface AssessmentInput {
  scope: AssessmentScope;
  subjectType: string;
  subjectId: string;
  title: string;
  summary?: string;
  findings?: Record<string, unknown>;
  model?: string;
  accountId?: string | null;
}

interface Assessment {
  id: string;
  scope: AssessmentScope;
  subject_type: string;
  subject_id: string;
  title: string;
  summary: string | null;
  findings: Record<string, unknown> | null;
  model: string | null;
  pinned: boolean;
  created_at: string;
}

interface SupplementalPrompt {
  id: string;
  prompt: string;
  response: string | null;
  status: "pending" | "complete" | "error";
  error: string | null;
  created_at: string;
}

interface Props {
  scope: AssessmentScope;
  subjectType: string;
  subjectId: string;
  /** Called on-demand when the panel wants to persist a fresh AI finding. */
  buildAssessment?: () => Promise<AssessmentInput | null>;
  /** When true, hides the "Run assessment" button (parent controls creation). */
  hideRunButton?: boolean;
  className?: string;
}

/**
 * Reusable panel that shows the latest AI assessment attached to a section,
 * and tracks supplemental follow-up prompts separately in the database.
 */
export function AssessmentPanel({ scope, subjectType, subjectId, buildAssessment, hideRunButton, className }: Props) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [prompts, setPrompts] = useState<SupplementalPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [asking, setAsking] = useState(false);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: a } = await supabase
      .from("ai_assessments")
      .select("*")
      .eq("scope", scope)
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAssessment((a as any) ?? null);
    if (a) {
      const { data: p } = await supabase
        .from("ai_assessment_prompts")
        .select("*")
        .eq("assessment_id", a.id)
        .order("created_at", { ascending: true });
      setPrompts((p as any[]) ?? []);
    } else {
      setPrompts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [scope, subjectType, subjectId]);

  const runAssessment = async () => {
    if (!buildAssessment) return;
    setRunning(true);
    try {
      const draft = await buildAssessment();
      if (!draft) return;
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        toast.error("Please sign in");
        return;
      }
      const { data, error } = await supabase
        .from("ai_assessments")
        .insert({
          user_id: user.id,
          account_id: draft.accountId ?? null,
          scope: draft.scope,
          subject_type: draft.subjectType,
          subject_id: draft.subjectId,
          title: draft.title,
          summary: draft.summary ?? null,
          findings: draft.findings ?? {},
          model: draft.model ?? null,
          pinned: true,
        })
        .select()
        .single();
      if (error) throw error;
      setAssessment(data as any);
      setPrompts([]);
      toast.success("Assessment attached");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save assessment");
    } finally {
      setRunning(false);
    }
  };

  const askSupplement = async () => {
    if (!assessment || !input.trim()) return;
    setAsking(true);
    const prompt = input.trim();
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-assessment-supplement", {
        body: { assessmentId: assessment.id, prompt },
      });
      if (error) throw error;
      if (data?.prompt) setPrompts((prev) => [...prev, data.prompt]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to get response");
      setInput(prompt);
    } finally {
      setAsking(false);
    }
  };

  const scopeLabel = ({
    asc606: "ASC 606",
    contract_intelligence: "Contract Intelligence",
    collectability: "Collectability",
    revenue_risk: "Revenue Risk",
    other: "AI",
  } as const)[scope];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {scopeLabel} Assessment
                {assessment?.pinned && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Pin className="h-3 w-3" /> Attached
                  </Badge>
                )}
              </CardTitle>
              {assessment && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Attached {formatDistanceToNow(new Date(assessment.created_at), { addSuffix: true })}
                  {assessment.model ? ` · ${assessment.model}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!hideRunButton && buildAssessment && (
              <Button size="sm" variant="outline" onClick={runAssessment} disabled={running}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                {assessment ? "Re-run" : "Run"} assessment
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !assessment ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No AI assessment attached yet. {buildAssessment ? "Run one to pin findings to this section." : "Assessments will appear here once available."}
            </div>
          ) : (
            <>
              {/* Pinned findings */}
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Findings
                </div>
                <p className="text-sm font-medium">{assessment.title}</p>
                {assessment.summary && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{assessment.summary}</p>
                )}
                {assessment.findings && Object.keys(assessment.findings).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-primary cursor-pointer">View structured findings</summary>
                    <pre className="mt-2 text-[11px] bg-background border rounded p-2 overflow-auto max-h-64">
                      {JSON.stringify(assessment.findings, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              {/* Supplemental thread — tracked separately */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Supplemental prompts
                  </div>
                  <Badge variant="outline" className="text-[10px]">{prompts.length} tracked</Badge>
                </div>

                {prompts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No follow-ups yet. Ask a supplemental question below — each Q&A is stored separately from the pinned findings for audit.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-auto pr-1">
                    {prompts.map((p) => (
                      <div key={p.id} className="rounded-md border p-2.5 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <UserIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <p className="flex-1 whitespace-pre-wrap">{p.prompt}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 pl-1">
                          <Bot className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                          <div className="flex-1 text-muted-foreground whitespace-pre-wrap">
                            {p.status === "pending" ? "Thinking…" : p.status === "error" ? <span className="text-destructive">{p.error ?? "Error"}</span> : p.response}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a supplemental question about this assessment…"
                    className="min-h-[60px] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        askSupplement();
                      }
                    }}
                  />
                  <Button onClick={askSupplement} disabled={asking || !input.trim()} className="self-end">
                    {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send. Supplemental prompts are tracked separately from the pinned finding.</p>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default AssessmentPanel;
