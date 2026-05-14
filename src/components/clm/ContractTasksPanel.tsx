import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ListChecks, Plus, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatters";

interface Props {
  debtorId: string | null;
  contractName?: string | null;
}

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/**
 * Contract-scoped task list. Mirrors InboundAI's task model: rows live in
 * `collection_tasks` filtered by debtor_id. Users can add tasks inline that
 * become visible everywhere a debtor's tasks appear (Tasks page, debtor
 * detail, dashboard).
 */
export function ContractTasksPanel({ debtorId, contractName }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("normal");
  const [dueDate, setDueDate] = useState<string>("");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["contract-tasks", debtorId],
    enabled: !!debtorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select("id, summary, details, priority, status, due_date, created_at, task_type, assigned_persona")
        .eq("debtor_id", debtorId!)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!debtorId) throw new Error("Link this contract to an account first.");
      if (!summary.trim()) throw new Error("Summary is required");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("collection_tasks").insert({
        user_id: u.user.id,
        debtor_id: debtorId,
        task_type: "contract_followup",
        summary: summary.trim(),
        details: details.trim() || null,
        priority,
        status: "open",
        level: "debtor",
        source: "user_created",
        due_date: dueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      setSummary(""); setDetails(""); setPriority("normal"); setDueDate("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["contract-tasks", debtorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("collection_tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task completed");
      qc.invalidateQueries({ queryKey: ["contract-tasks", debtorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const priorityClass = (p: string) =>
    p === "urgent" ? "bg-red-50 text-red-700 border-red-200"
      : p === "high" ? "bg-amber-50 text-amber-700 border-amber-200"
      : p === "low" ? "bg-muted text-muted-foreground"
      : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" /> Contract Tasks
          {tasks && tasks.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {debtorId && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/tasks">
                Open Tasks <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={!debtorId}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!debtorId && (
          <p className="text-xs text-muted-foreground">
            Link this contract to an account to create and track tasks.
          </p>
        )}

        {showForm && debtorId && (
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <Input
              placeholder={`Task summary${contractName ? ` for ${contractName}` : ""}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <Textarea
              placeholder="Details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !summary.trim()}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                Create Task
              </Button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-xs text-muted-foreground">Loading tasks…</p>}

        {!isLoading && tasks && tasks.length === 0 && debtorId && (
          <p className="text-xs text-muted-foreground">No open tasks for this account yet.</p>
        )}

        <div className="space-y-2">
          {tasks?.map((t: any) => (
            <div key={t.id} className="border rounded-md p-2.5 text-sm flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{t.summary}</span>
                  <Badge variant="outline" className={`text-[10px] capitalize ${priorityClass(t.priority)}`}>
                    {t.priority}
                  </Badge>
                  {t.status !== "open" && (
                    <Badge variant="outline" className="text-[10px] capitalize">{t.status}</Badge>
                  )}
                  {t.due_date && (
                    <span className="text-[11px] text-muted-foreground">Due {formatDateShort(t.due_date)}</span>
                  )}
                </div>
                {t.details && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.details}</p>
                )}
              </div>
              {t.status === "open" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => complete.mutate(t.id)}
                  disabled={complete.isPending}
                  title="Mark done"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ContractTasksPanel;
