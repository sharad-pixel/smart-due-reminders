import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Plus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";

interface Field {
  field_key: string;
  field_value: string | null;
}

interface Trigger {
  id: string;
  name: string;
  trigger_type: "date_offset" | "amount_threshold" | "field_change";
  source_field: string;
  offset_days: number | null;
  comparator: string | null;
  threshold_value: number | null;
  channel: "in_app" | "email" | "both";
  notify_emails: string[];
  message: string | null;
  is_active: boolean;
  last_fired_at: string | null;
}

interface Props {
  importId: string;
  accountId: string;
  fields: Field[];
}

const looksLikeDate = (v?: string | null) =>
  !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
const looksLikeNumber = (v?: string | null) =>
  !!v && !isNaN(Number(String(v).replace(/[$,]/g, "")));

export const ContractCustomTriggersPanel = ({ importId, accountId, fields }: Props) => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [type, setType] = useState<Trigger["trigger_type"]>("date_offset");
  const [sourceField, setSourceField] = useState("");
  const [offsetDays, setOffsetDays] = useState(30);
  const [comparator, setComparator] = useState("gt");
  const [threshold, setThreshold] = useState("");
  const [channel, setChannel] = useState<"in_app" | "email" | "both">("in_app");
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("contract_custom_triggers")
      .select("*")
      .eq("import_id", importId)
      .order("created_at", { ascending: false });
    setTriggers((data as any) || []);
  };

  useEffect(() => {
    if (importId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  const dateFields = fields.filter((f) => looksLikeDate(f.field_value));
  const numericFields = fields.filter((f) => looksLikeNumber(f.field_value));
  const sourceOptions = type === "date_offset" ? dateFields : type === "amount_threshold" ? numericFields : fields;

  const resetForm = () => {
    setName("");
    setType("date_offset");
    setSourceField("");
    setOffsetDays(30);
    setComparator("gt");
    setThreshold("");
    setChannel("in_app");
    setEmails("");
    setMessage("");
  };

  const save = async () => {
    if (!name.trim() || !sourceField) {
      toast.error("Name and source field are required");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("contract_custom_triggers").insert({
        account_id: accountId,
        import_id: importId,
        created_by: u.user?.id || null,
        name: name.trim(),
        trigger_type: type,
        source_field: sourceField,
        offset_days: type === "date_offset" ? offsetDays : null,
        comparator: type === "amount_threshold" ? comparator : type === "field_change" ? "changed" : null,
        threshold_value: type === "amount_threshold" ? Number(threshold) || 0 : null,
        channel,
        notify_emails: emails
          .split(/[,;\s]+/)
          .map((e) => e.trim())
          .filter(Boolean),
        message: message.trim() || null,
        is_active: true,
      } as any);
      if (error) throw error;
      toast.success("Trigger created");
      resetForm();
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create trigger");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: Trigger) => {
    const { error } = await supabase
      .from("contract_custom_triggers")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (t: Trigger) => {
    if (!confirm(`Delete trigger "${t.name}"?`)) return;
    const { error } = await supabase.from("contract_custom_triggers").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const describe = (t: Trigger) => {
    if (t.trigger_type === "date_offset") {
      return `${t.offset_days} day${t.offset_days === 1 ? "" : "s"} before ${t.source_field.replace(/_/g, " ")}`;
    }
    if (t.trigger_type === "amount_threshold") {
      return `When ${t.source_field.replace(/_/g, " ")} ${t.comparator} ${t.threshold_value}`;
    }
    return `When ${t.source_field.replace(/_/g, " ")} changes`;
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Custom Triggers
          <Badge variant="outline" className="ml-2 text-[10px]">
            {triggers.filter((t) => t.is_active).length} active
          </Badge>
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> New trigger
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create custom trigger</DialogTitle>
              <DialogDescription>
                Be proactive — get notified when a date approaches, an amount crosses a threshold, or
                a contract value changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 90-day renewal warning" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Trigger type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_offset">Days before date</SelectItem>
                      <SelectItem value="amount_threshold">Amount threshold</SelectItem>
                      <SelectItem value="field_change">Field change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Source field</Label>
                  <Select value={sourceField} onValueChange={setSourceField}>
                    <SelectTrigger><SelectValue placeholder="Pick from contract" /></SelectTrigger>
                    <SelectContent>
                      {sourceOptions.length === 0 ? (
                        <SelectItem value="__none__" disabled>No compatible fields</SelectItem>
                      ) : (
                        sourceOptions.map((f) => (
                          <SelectItem key={f.field_key} value={f.field_key}>
                            {f.field_key.replace(/_/g, " ")}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {type === "date_offset" && (
                <div>
                  <Label className="text-xs">Days before</Label>
                  <Input
                    type="number"
                    min={0}
                    value={offsetDays}
                    onChange={(e) => setOffsetDays(parseInt(e.target.value) || 0)}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              )}

              {type === "amount_threshold" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Condition</Label>
                    <Select value={comparator} onValueChange={setComparator}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gt">Greater than</SelectItem>
                        <SelectItem value="gte">≥</SelectItem>
                        <SelectItem value="lt">Less than</SelectItem>
                        <SelectItem value="lte">≤</SelectItem>
                        <SelectItem value="eq">Equal to</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Value</Label>
                    <Input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Notify via</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">In-app alert</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="both">In-app + Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(channel === "email" || channel === "both") && (
                <div>
                  <Label className="text-xs">Recipient emails (comma separated)</Label>
                  <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="finance@company.com" />
                </div>
              )}

              <div>
                <Label className="text-xs">Message (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="What action should be taken?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create trigger"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {triggers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No custom triggers yet. Create one to be proactive about dates, thresholds, or value changes.
          </p>
        ) : (
          <div className="space-y-2">
            {triggers.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-md border p-3 bg-card">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{t.trigger_type.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      <Bell className="h-2.5 w-2.5 mr-1" />{t.channel.replace(/_/g, " ")}
                    </Badge>
                    {t.last_fired_at && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        fired {new Date(t.last_fired_at).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{describe(t)}</div>
                  {t.message && <div className="text-xs mt-1">{t.message}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractCustomTriggersPanel;
