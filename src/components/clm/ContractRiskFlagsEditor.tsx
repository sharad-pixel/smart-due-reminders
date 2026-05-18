import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Trash2, Save, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface RiskFlag {
  id: string;
  flag_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string | null;
  source_field: string | null;
  resolved: boolean;
}

interface Props {
  importId: string;
  accountId: string;
}

const severityTone: Record<string, string> = {
  low: "bg-blue-50 text-blue-700 border-blue-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

export const ContractRiskFlagsEditor = ({ importId, accountId }: Props) => {
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [newFlag, setNewFlag] = useState({ flag_type: "", severity: "medium" as RiskFlag["severity"], description: "" });
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("contract_risk_flags")
      .select("*")
      .eq("import_id", importId)
      .order("resolved", { ascending: true })
      .order("severity", { ascending: false });
    setFlags((data as any) || []);
  };

  useEffect(() => {
    if (importId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  const updateSeverity = async (id: string, severity: RiskFlag["severity"]) => {
    const { error } = await supabase.from("contract_risk_flags").update({ severity }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Severity updated");
      load();
    }
  };

  const toggleResolved = async (f: RiskFlag) => {
    const { error } = await supabase.from("contract_risk_flags").update({ resolved: !f.resolved }).eq("id", f.id);
    if (error) toast.error(error.message);
    else {
      toast.success(f.resolved ? "Re-opened" : "Dismissed");
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this flag permanently?")) return;
    const { error } = await supabase.from("contract_risk_flags").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const add = async () => {
    if (!newFlag.flag_type.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("contract_risk_flags").insert({
        account_id: accountId,
        import_id: importId,
        flag_type: newFlag.flag_type.trim(),
        severity: newFlag.severity,
        description: newFlag.description.trim() || null,
        source_field: "manual",
      } as any);
      if (error) throw error;
      toast.success("Risk flag added");
      setNewFlag({ flag_type: "", severity: "medium", description: "" });
      setShowAdd(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Add failed");
    } finally {
      setAdding(false);
    }
  };

  const active = flags.filter((f) => !f.resolved);
  const dismissed = flags.filter((f) => f.resolved);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Risk Flags
          <Badge variant="outline" className="text-[10px]">{active.length} active</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="h-3 w-3 mr-1" /> Add flag
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <Input
              placeholder="Flag type (e.g. uncapped_liability)"
              value={newFlag.flag_type}
              onChange={(e) => setNewFlag({ ...newFlag, flag_type: e.target.value })}
            />
            <div className="flex gap-2">
              <Select value={newFlag.severity} onValueChange={(v) => setNewFlag({ ...newFlag, severity: v as any })}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Description"
                rows={2}
                value={newFlag.description}
                onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}><X className="h-3 w-3 mr-1" />Cancel</Button>
              <Button size="sm" onClick={add} disabled={adding || !newFlag.flag_type.trim()}>
                <Save className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </div>
        )}

        {flags.length === 0 && <p className="text-sm text-muted-foreground italic py-2">No risk flags.</p>}

        {active.map((f) => (
          <div key={f.id} className="rounded-md border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{f.flag_type.replace(/_/g, " ")}</span>
                <Select value={f.severity} onValueChange={(v) => updateSeverity(f.id, v as any)}>
                  <SelectTrigger className={`h-6 w-[110px] text-[10px] ${severityTone[f.severity]}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleResolved(f)}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Dismiss
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(f.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
          </div>
        ))}

        {dismissed.length > 0 && (
          <details className="pt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              {dismissed.length} dismissed
            </summary>
            <div className="space-y-2 mt-2">
              {dismissed.map((f) => (
                <div key={f.id} className="rounded-md border p-2 opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm line-through">{f.flag_type.replace(/_/g, " ")}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => toggleResolved(f)}>
                      Re-open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractRiskFlagsEditor;
