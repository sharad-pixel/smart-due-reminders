import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Building2, FileText, Check, ArrowRight } from "lucide-react";
import { useClmTemplates } from "@/hooks/useClmTemplates";
import { useCreateClmInstance } from "@/hooks/useClmInstance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "account" | "templates";

export const NewWorkspaceDialog = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("account");
  const [debtorSearch, setDebtorSearch] = useState("");
  const [debtorId, setDebtorId] = useState<string | null>(null);
  const [debtorLabel, setDebtorLabel] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [name, setName] = useState("");

  const create = useCreateClmInstance();
  const { data: templates = [] } = useClmTemplates();
  const readyTemplates = templates.filter((t) => t.status === "ready");

  const { data: debtors = [] } = useQuery({
    queryKey: ["new-workspace-debtor-search", debtorSearch],
    enabled: open && step === "account",
    queryFn: async () => {
      let q = supabase.from("debtors").select("id, company_name, name, email").eq("is_archived", false).limit(20);
      if (debtorSearch.trim())
        q = q.or(`company_name.ilike.%${debtorSearch}%,name.ilike.%${debtorSearch}%,email.ilike.%${debtorSearch}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const reset = () => {
    setStep("account");
    setDebtorSearch("");
    setDebtorId(null);
    setDebtorLabel("");
    setSelectedTemplateIds([]);
    setName("");
  };

  const close = () => { reset(); onOpenChange(false); };

  const goNext = () => {
    if (!debtorId) return;
    if (!name.trim()) setName(`${debtorLabel} — Negotiation`);
    setStep("templates");
  };

  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleCreate = async () => {
    if (!debtorId || selectedTemplateIds.length === 0 || !name.trim()) return;
    const [primary, ...extras] = selectedTemplateIds;
    const inst = await create.mutateAsync({
      template_id: primary,
      name: name.trim(),
      debtor_id: debtorId,
      extra_template_ids: extras,
    });
    close();
    navigate(`/contracts/instances/${inst.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Collaboration Workspace</DialogTitle>
          <DialogDescription>
            Step {step === "account" ? "1" : "2"} of 2 —{" "}
            {step === "account" ? "Pick the counterparty account" : "Select the contracts to negotiate"}
          </DialogDescription>
        </DialogHeader>

        {step === "account" ? (
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Counterparty account</Label>
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
                  <div className="mt-2 max-h-56 overflow-y-auto rounded border divide-y">
                    {debtors.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No accounts found</p>}
                    {debtors.map((d: any) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setDebtorId(d.id); setDebtorLabel(d.company_name ?? d.name ?? d.email ?? "Account"); }}
                        className="w-full text-left p-2 hover:bg-muted/50"
                      >
                        <p className="text-sm font-medium truncate">{d.company_name ?? d.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.email ?? ""}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <Label>Workspace name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={debtorLabel ? `${debtorLabel} — Negotiation` : "e.g. Acme — MSA + Order Form"}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded border bg-muted/40 p-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{debtorLabel}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setStep("account")}>Change</Button>
            </div>

            <div>
              <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Templates to include</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Select one or more contracts. The first selected acts as the primary template; the rest are bundled.
              </p>
              <div className="mt-2 max-h-72 overflow-y-auto rounded border divide-y">
                {readyTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No templates ready yet. Upload one from the Templates tab first.
                  </p>
                ) : readyTemplates.map((t, idx) => {
                  const checked = selectedTemplateIds.includes(t.id);
                  const order = checked ? selectedTemplateIds.indexOf(t.id) + 1 : null;
                  return (
                    <label key={t.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggleTemplate(t.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                      </div>
                      {order === 1 && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                      {order && order > 1 && <Badge variant="outline" className="text-[10px]">#{order}</Badge>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          {step === "account" ? (
            <Button onClick={goNext} disabled={!debtorId}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("account")}>Back</Button>
              <Button
                onClick={handleCreate}
                disabled={selectedTemplateIds.length === 0 || !name.trim() || create.isPending}
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create workspace (${selectedTemplateIds.length})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
