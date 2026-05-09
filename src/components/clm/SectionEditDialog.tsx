import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Save, Loader2, FileDiff, Eye, FilePen, ShieldCheck, GitBranch, Sparkles, Wand2, Info, Replace, PlusCircle, Undo2 } from "lucide-react";
import { useUpdateInstanceSection } from "@/hooks/useClmInstance";
import { InlineDiff } from "./InlineDiff";
import { wordDiff, diffStats } from "@/lib/textDiff";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Approver { value: string; label: string; sub: string }

const QUICK_PROMPTS = [
  "Add a mutual limitation of liability capped at fees paid in the prior 12 months",
  "Add a 30-day termination for convenience clause with pro-rated refund",
  "Tighten the confidentiality clause to include a 3-year survival period",
  "Add a standard mutual indemnification for IP infringement",
  "Insert a SaaS-standard data processing and security commitments clause",
];

export const SectionEditDialog = ({
  instanceId, section, currentVersion, contacts = [], trigger,
}: { instanceId: string; section: any; currentVersion?: number; contacts?: any[]; trigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(section.body ?? "");
  const [summary, setSummary] = useState("");
  const [tab, setTab] = useState("edit");
  const [assignee, setAssignee] = useState<string>("");
  const update = useUpdateInstanceSection(instanceId);

  // AI assist state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState<string>("");
  const [aiMode, setAiMode] = useState<"insert" | "replace" | "revise">("insert");
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: externalAccess = [] } = useQuery({
    queryKey: ["clm-external-access", instanceId],
    enabled: open,
    queryFn: async () => {
      const { data } = await (supabase.from("clm_external_access" as any) as any)
        .select("email, name, role, revoked_at, expires_at")
        .eq("instance_id", instanceId);
      return data ?? [];
    },
  });

  const approvers: Approver[] = useMemo(() => {
    const list: Approver[] = [];
    const seen = new Set<string>();
    contacts.forEach((c: any) => {
      const email = (c.is_internal ? c.email : c.debtor_contacts?.email ?? c.email) || "";
      const name = (c.is_internal ? c.name : c.debtor_contacts?.name ?? c.name) || email;
      if (!email || seen.has(email.toLowerCase())) return;
      seen.add(email.toLowerCase());
      list.push({ value: email, label: name, sub: c.is_internal ? "Internal" : "External · account" });
    });
    (externalAccess as any[]).forEach((a: any) => {
      if (!a.email || a.revoked_at || seen.has(a.email.toLowerCase())) return;
      seen.add(a.email.toLowerCase());
      list.push({ value: a.email, label: a.name || a.email, sub: `Portal · ${a.role}` });
    });
    return list;
  }, [contacts, externalAccess]);

  useEffect(() => {
    if (open && !assignee && approvers.length) setAssignee(approvers[0].value);
  }, [open, approvers, assignee]);

  const dirty = body !== (section.body ?? "");
  const stats = useMemo(() => diffStats(wordDiff(section.body ?? "", body)), [section.body, body]);

  const captureSelection = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (end > start) {
      setSelection({ start, end, text: body.slice(start, end) });
      setAiMode("revise");
    } else {
      setSelection(null);
    }
  };

  const runAi = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Tell the AI what clause or change you need");
      return;
    }
    setAiBusy(true);
    setAiPreview("");
    try {
      const { data, error } = await supabase.functions.invoke("clm-draft-clause", {
        body: {
          mode: aiMode,
          instruction: aiPrompt,
          section_title: section.title,
          current_body: body,
          selection: selection?.text ?? "",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const text = (data as any)?.text?.trim?.() || "";
      if (!text) throw new Error("AI returned empty text");
      setAiPreview(text);
    } catch (e: any) {
      toast.error(e?.message || "AI assist failed");
    } finally {
      setAiBusy(false);
    }
  };

  const applyAi = (mode: "replace-section" | "replace-selection" | "insert-cursor") => {
    if (!aiPreview) return;
    if (mode === "replace-section") {
      setBody(aiPreview);
    } else if (mode === "replace-selection" && selection) {
      setBody(body.slice(0, selection.start) + aiPreview + body.slice(selection.end));
    } else {
      const ta = textareaRef.current;
      const pos = ta ? ta.selectionStart : body.length;
      const sep = body && !body.endsWith("\n") ? "\n\n" : "";
      setBody(body.slice(0, pos) + sep + aiPreview + body.slice(pos));
    }
    setAiPreview("");
    setAiPrompt("");
    setSelection(null);
    toast.success("AI suggestion applied — review the diff before submitting");
  };

  const submit = async (forApproval: boolean) => {
    if (!dirty) { setOpen(false); return; }
    const sel = approvers.find((a) => a.value === assignee);
    await update.mutateAsync({
      id: section.id, body, change_summary: summary || undefined, submitForApproval: forApproval,
      assigned_approver_email: forApproval ? assignee || undefined : undefined,
      assigned_approver_name: forApproval ? sel?.label : undefined,
    });
    setOpen(false);
    setSummary("");
  };

  return (
    <>
      {trigger ? (
        <span onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{trigger}</span>
      ) : (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (v) { setBody(section.body ?? ""); setTab("edit"); setAiOpen(false); setAiPreview(""); setAiPrompt(""); setSelection(null); }
      }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>Edit section: {section.title}</span>
              {currentVersion ? (
                <Badge variant="outline" className="font-mono text-[10px]">Editing from v{currentVersion}</Badge>
              ) : null}
              {dirty && (
                <>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">+{stats.added}</Badge>
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[10px]">−{stats.removed}</Badge>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              <span className="inline-flex items-center gap-1.5 mr-2 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium">
                <GitBranch className="h-3 w-3" /> Suggesting mode
              </span>
              Edits are saved as drafts and versioned. Submit them for approval from the workspace bar when you're done.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="edit"><FilePen className="h-3.5 w-3.5 mr-1.5" />Edit</TabsTrigger>
              <TabsTrigger value="diff" disabled={!dirty}><FileDiff className="h-3.5 w-3.5 mr-1.5" />Diff</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-3 mt-3">
              {/* AI assist toolbar */}
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
                <Button
                  type="button" size="sm" variant={aiOpen ? "default" : "outline"}
                  onClick={() => setAiOpen((o) => !o)}
                  className="h-7"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {aiOpen ? "Close AI assist" : "AI legal assist"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {selection ? `${selection.text.length} chars selected — AI can revise just this passage` : "Select text in the body to revise that passage, or insert a new clause at the cursor"}
                </span>
              </div>

              {aiOpen && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Wand2 className="h-3.5 w-3.5" /> Describe the clause or change you want
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant={aiMode === "insert" ? "default" : "outline"} className="h-6 text-[11px]" onClick={() => setAiMode("insert")}>
                        <PlusCircle className="h-3 w-3 mr-1" /> Insert
                      </Button>
                      <Button type="button" size="sm" variant={aiMode === "replace" ? "default" : "outline"} className="h-6 text-[11px]" onClick={() => setAiMode("replace")}>
                        <Replace className="h-3 w-3 mr-1" /> Rewrite section
                      </Button>
                      <Button
                        type="button" size="sm" variant={aiMode === "revise" ? "default" : "outline"} className="h-6 text-[11px]"
                        disabled={!selection}
                        onClick={() => setAiMode("revise")}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Revise selection
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder='e.g. "Add a mutual non-disclosure clause with 3-year survival" or "Soften the indemnification cap to be mutual"'
                    className="text-sm bg-background"
                  />
                  <div className="flex flex-wrap gap-1">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q} type="button"
                        onClick={() => setAiPrompt(q)}
                        className="text-[10.5px] px-2 py-0.5 rounded-full border bg-background hover:bg-accent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" disabled={aiBusy || !aiPrompt.trim()} onClick={runAi}>
                      {aiBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                      Draft with AI
                    </Button>
                    {aiPreview && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAiPreview("")}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> Discard suggestion
                      </Button>
                    )}
                  </div>

                  {aiPreview && (
                    <div className="rounded border bg-background p-2.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-primary" /> AI suggestion · review before applying
                      </div>
                      <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                        {aiPreview}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selection && (
                          <Button type="button" size="sm" variant="default" onClick={() => applyAi("replace-selection")}>
                            Replace selection
                          </Button>
                        )}
                        <Button type="button" size="sm" variant={selection ? "outline" : "default"} onClick={() => applyAi("insert-cursor")}>
                          Insert at cursor
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyAi("replace-section")}>
                          Replace whole section
                        </Button>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground italic">
                        AI drafts are suggestions only — they do not constitute legal advice. Always review with counsel before signing.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Section body</Label>
                <Textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onSelect={captureSelection}
                  onMouseUp={captureSelection}
                  onKeyUp={captureSelection}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5">
                    Note for reviewers
                    <span className="text-[10px] font-normal text-muted-foreground">(optional)</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px] text-xs">
                          A short note that appears in the audit log and approval request — e.g. "Tightened liability cap" or "Per Legal feedback". This is metadata, not the edit itself.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder='e.g. "Tightened liability cap"'
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Default approver
                  </Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder={approvers.length ? "Select approver…" : "Invite collaborators first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvers.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          <span className="font-medium">{a.label}</span>
                          <span className="text-muted-foreground ml-1.5 text-[11px]">· {a.sub}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Used when this draft is submitted for approval.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="diff" className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Live diff between the current saved version and your edits.</p>
              <InlineDiff before={section.body ?? ""} after={body} />
            </TabsContent>

            <TabsContent value="preview" className="mt-3">
              <div className="rounded border bg-muted/20 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto">
                {body || <em className="text-muted-foreground">Empty</em>}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <p className="text-[11px] text-muted-foreground sm:mr-auto">
              {dirty
                ? "Saving creates a new draft revision (v+1). Submit from the workspace bar when ready."
                : "Edit the section body above to enable saving. The note field alone won't create a revision."}
            </p>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!dirty || update.isPending} onClick={() => submit(false)}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" /> Save draft (v+1)</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
