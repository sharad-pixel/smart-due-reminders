import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Save, X, FileText, Plus, Trash2, UserCheck, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AssignContractDebtor } from "@/components/contracts/AssignContractDebtor";

interface FieldRow {
  id: string;
  field_group: string;
  field_key: string;
  field_value: string | null;
  field_value_json: any;
  edited_by_user: string | null;
  approved: boolean;
  confidence: number | null;
}

interface Props {
  importId: string;
  accountId: string;
  extractionId?: string | null;
  debtorId?: string | null;
  debtorName?: string | null;
}

const GROUPS: { id: string; label: string }[] = [
  { id: "contract", label: "Contract" },
  { id: "customer", label: "Customer & Parties" },
  { id: "commercial", label: "Commercial" },
  { id: "dates", label: "Critical Dates" },
  { id: "legal", label: "Legal Clauses" },
  { id: "poc", label: "POC / Pilot" },
  { id: "custom", label: "Custom" },
];

const isLongText = (key: string) =>
  /clause|language|obligation|terms|description|criteria|protection|liability|indemnif|sla|notes/i.test(key);

const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const ContractExtractedFieldsEditor = ({ importId, accountId, extractionId, debtorId, debtorName }: Props) => {
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState("contract");
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("live_contract_extracted_fields")
      .select("id, field_group, field_key, field_value, field_value_json, edited_by_user, approved, confidence")
      .eq("import_id", importId)
      .order("field_group", { ascending: true })
      .order("field_key", { ascending: true });
    setRows((data as any) || []);
  };

  useEffect(() => {
    if (importId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  const grouped = useMemo(() => {
    const map: Record<string, FieldRow[]> = {};
    for (const r of rows) (map[r.field_group] = map[r.field_group] || []).push(r);
    return map;
  }, [rows]);

  const startEdit = (r: FieldRow) => {
    setEditing((s) => ({ ...s, [r.id]: r.field_value ?? (r.field_value_json ? JSON.stringify(r.field_value_json, null, 2) : "") }));
  };
  const cancelEdit = (id: string) => {
    setEditing((s) => {
      const { [id]: _, ...rest } = s;
      return rest;
    });
  };

  const save = async (r: FieldRow) => {
    const next = editing[r.id] ?? "";
    setSavingId(r.id);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id || null;
      const { error } = await supabase
        .from("live_contract_extracted_fields")
        .update({
          field_value: next || null,
          field_value_json: null,
          edited_by_user: uid,
          approved: true,
        })
        .eq("id", r.id);
      if (error) throw error;
      toast.success(`${humanize(r.field_key)} updated`);
      cancelEdit(r.id);
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (r: FieldRow) => {
    if (!confirm(`Remove "${humanize(r.field_key)}"?`)) return;
    const { error } = await supabase.from("live_contract_extracted_fields").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      load();
    }
  };

  const addField = async () => {
    if (!newKey.trim() || !extractionId) return;
    setAdding(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id || null;
      const { error } = await supabase.from("live_contract_extracted_fields").insert({
        account_id: accountId,
        import_id: importId,
        extraction_id: extractionId,
        field_group: activeGroup,
        field_key: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
        field_value: newValue.trim() || null,
        edited_by_user: uid,
        approved: true,
      } as any);
      if (error) throw error;
      toast.success("Field added");
      setNewKey("");
      setNewValue("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Add failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Extracted Terms
          <Badge variant="outline" className="text-[10px] ml-2">{rows.length} fields</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Edit any extracted term. Your edits are preserved when the contract is re-scanned.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList className="flex flex-wrap h-auto">
            {GROUPS.map((g) => (
              <TabsTrigger key={g.id} value={g.id} className="text-xs">
                {g.label}
                {grouped[g.id]?.length ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                    {grouped[g.id].length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {GROUPS.map((g) => (
            <TabsContent key={g.id} value={g.id} className="space-y-2 mt-4">
              {(grouped[g.id] || []).length === 0 && (
                <p className="text-sm text-muted-foreground italic py-4">No {g.label.toLowerCase()} fields extracted.</p>
              )}
              {(grouped[g.id] || []).map((r) => {
                const isEditing = r.id in editing;
                const displayValue = r.field_value ?? (r.field_value_json ? JSON.stringify(r.field_value_json) : "");
                return (
                  <div key={r.id} className="rounded-md border p-3 space-y-1.5 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {humanize(r.field_key)}
                        </span>
                        {r.edited_by_user && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            <UserCheck className="h-2.5 w-2.5 mr-0.5" /> Edited
                          </Badge>
                        )}
                        {r.confidence != null && !r.edited_by_user && (
                          <Badge variant="outline" className="text-[10px]">
                            {Math.round(Number(r.confidence))}% conf.
                          </Badge>
                        )}
                      </div>
                      {!isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(r)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(r)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => cancelEdit(r.id)} disabled={savingId === r.id}>
                            <X className="h-3 w-3" />
                          </Button>
                          <Button size="sm" className="h-7 px-2" onClick={() => save(r)} disabled={savingId === r.id}>
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {!isEditing ? (
                      <div className="text-sm whitespace-pre-line">
                        {displayValue || <span className="text-muted-foreground italic">—</span>}
                      </div>
                    ) : isLongText(r.field_key) ? (
                      <Textarea
                        rows={4}
                        value={editing[r.id]}
                        onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        value={editing[r.id]}
                        onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}

              {extractionId && (
                <div className="rounded-md border border-dashed p-3 space-y-2 mt-4">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add custom {g.label.toLowerCase()} field
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="field name (e.g. data_residency)"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="h-8"
                    />
                    <Input
                      placeholder="value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="h-8 sm:col-span-2"
                    />
                  </div>
                  <Button size="sm" onClick={addField} disabled={!newKey.trim() || adding}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ContractExtractedFieldsEditor;
