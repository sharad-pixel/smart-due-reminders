import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Building2, FileText, Check } from "lucide-react";
import { useClmTemplates } from "@/hooks/useClmTemplates";
import { useCreateClmInstance } from "@/hooks/useClmInstance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryTemplateId: string;
  primaryTemplateName: string;
  onCreated: (instanceId: string) => void;
}

export const UseTemplateDialog = ({ open, onOpenChange, primaryTemplateId, primaryTemplateName, onCreated }: Props) => {
  const [name, setName] = useState(`${primaryTemplateName} — Negotiation`);
  const [debtorSearch, setDebtorSearch] = useState("");
  const [debtorId, setDebtorId] = useState<string | null>(null);
  const [debtorLabel, setDebtorLabel] = useState<string>("");
  const [extraIds, setExtraIds] = useState<string[]>([]);

  const create = useCreateClmInstance();
  const { data: templates = [] } = useClmTemplates();

  const { data: debtors = [] } = useQuery({
    queryKey: ["clm-use-debtor-search", debtorSearch],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("debtors").select("id, company_name, name, email").eq("is_archived", false).limit(15);
      if (debtorSearch.trim())
        q = q.or(`company_name.ilike.%${debtorSearch}%,name.ilike.%${debtorSearch}%,email.ilike.%${debtorSearch}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const otherTemplates = templates.filter((t) => t.id !== primaryTemplateId && t.status === "ready");

  const toggleExtra = (id: string) =>
    setExtraIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleCreate = async () => {
    if (!name.trim()) return;
    const inst = await create.mutateAsync({
      template_id: primaryTemplateId,
      name: name.trim(),
      debtor_id: debtorId,
      extra_template_ids: extraIds,
    });
    onOpenChange(false);
    setExtraIds([]);
    setDebtorId(null);
    setDebtorLabel("");
    onCreated(inst.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Collaboration Workspace</DialogTitle>
          <DialogDescription>
            Spin up a workspace to negotiate this contract. Optionally link a debtor account and bundle additional templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Workspace name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MSA — Acme negotiation" />
          </div>

          <div>
            <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Link debtor account (optional)</Label>
            {debtorId ? (
              <div className="mt-2 flex items-center justify-between rounded border bg-muted/40 p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{debtorLabel}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setDebtorId(null); setDebtorLabel(""); }}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search debtor accounts…" value={debtorSearch} onChange={(e) => setDebtorSearch(e.target.value)} />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto rounded border divide-y">
                  {debtors.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No accounts found</p>
                  )}
                  {debtors.map((d: any) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { setDebtorId(d.id); setDebtorLabel(d.company_name ?? d.name ?? d.email ?? "Account"); }}
                      className="w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.company_name ?? d.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.email ?? ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Add additional templates (optional)</Label>
            <p className="text-xs text-muted-foreground mt-1">Bundle related contracts (e.g. NDA, SOW) into the same workspace.</p>
            <div className="mt-2 max-h-44 overflow-y-auto rounded border divide-y">
              {otherTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No other ready templates</p>
              ) : otherTemplates.map((t) => (
                <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={extraIds.includes(t.id)} onCheckedChange={() => toggleExtra(t.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs">{t.status}</Badge>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
