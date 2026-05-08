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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Search, Building2, FileText, Check, ArrowRight, UserPlus, Briefcase, Plus, X, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useClmTemplates } from "@/hooks/useClmTemplates";
import { useCreateClmInstance } from "@/hooks/useClmInstance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "account" | "templates" | "collaborators";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewExternal {
  name: string;
  email: string;
  title: string;
  role: string;
}
interface NewInternal {
  name: string;
  email: string;
  title: string;
  role: string;
}

export const NewWorkspaceDialog = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("account");
  const [debtorSearch, setDebtorSearch] = useState("");
  const [debtorId, setDebtorId] = useState<string | null>(null);
  const [debtorLabel, setDebtorLabel] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [name, setName] = useState("");

  // Collaborators state
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [externals, setExternals] = useState<NewExternal[]>([]);
  const [internals, setInternals] = useState<NewInternal[]>([]);

  // Inline new-row drafts
  const [extDraft, setExtDraft] = useState<NewExternal>({ name: "", email: "", title: "", role: "reviewer" });
  const [intDraft, setIntDraft] = useState<NewInternal>({ name: "", email: "", title: "", role: "approver" });

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

  // Existing contacts on chosen account, shown as suggestions on step 3
  const { data: accountContacts = [] } = useQuery({
    queryKey: ["new-workspace-account-contacts", debtorId],
    enabled: !!debtorId && step === "collaborators",
    queryFn: async () => {
      const { data } = await supabase
        .from("debtor_contacts")
        .select("id, name, email, title, is_primary")
        .eq("debtor_id", debtorId!)
        .order("is_primary", { ascending: false });
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
    setSelectedContactIds([]);
    setExternals([]);
    setInternals([]);
    setExtDraft({ name: "", email: "", title: "", role: "reviewer" });
    setIntDraft({ name: "", email: "", title: "", role: "approver" });
  };

  const close = () => { reset(); onOpenChange(false); };

  const goFromAccount = () => {
    if (!debtorId) return;
    if (!name.trim()) setName(`${debtorLabel} — Negotiation`);
    setStep("templates");
  };

  const goFromTemplates = () => {
    if (selectedTemplateIds.length === 0 || !name.trim()) return;
    setStep("collaborators");
  };

  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleAccountContact = (id: string) =>
    setSelectedContactIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addExternal = () => {
    const n = extDraft.name.trim();
    const e = extDraft.email.trim();
    if (!n) return toast.error("Collaborator name is required");
    if (!e || !EMAIL_RE.test(e)) return toast.error("A valid email is required for collaborators");
    setExternals((p) => [...p, { ...extDraft, name: n, email: e, title: extDraft.title.trim() }]);
    setExtDraft({ name: "", email: "", title: "", role: "reviewer" });
  };

  const addInternal = () => {
    const n = intDraft.name.trim();
    const e = intDraft.email.trim();
    if (!n) return toast.error("Approver name is required");
    if (!e || !EMAIL_RE.test(e)) return toast.error("A valid email is required for approvers");
    setInternals((p) => [...p, { ...intDraft, name: n, email: e, title: intDraft.title.trim() }]);
    setIntDraft({ name: "", email: "", title: "", role: "approver" });
  };

  const handleCreate = async () => {
    if (!debtorId || selectedTemplateIds.length === 0 || !name.trim()) return;
    const [primary, ...extras] = selectedTemplateIds;
    const inst = await create.mutateAsync({
      template_id: primary,
      name: name.trim(),
      debtor_id: debtorId,
      extra_template_ids: extras,
    });

    // Link collaborators / approvers (best-effort)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: debtorRow } = await supabase
        .from("debtors").select("user_id").eq("id", debtorId).maybeSingle();
      const ownerUserId = debtorRow?.user_id ?? user?.id;
      const rows: any[] = [];

      // Selected existing account contacts
      for (const cid of selectedContactIds) {
        rows.push({
          instance_id: inst.id, added_by: user?.id, contact_id: cid,
          debtor_id: debtorId, role: "reviewer", is_internal: false,
        });
      }

      // Newly entered externals — create debtor_contacts then link
      for (const ext of externals) {
        const { data: created, error } = await supabase
          .from("debtor_contacts")
          .insert({
            debtor_id: debtorId, user_id: ownerUserId,
            name: ext.name, email: ext.email,
            title: ext.title || null, outreach_enabled: false, source: "clm_legal",
          } as any)
          .select("id").single();
        if (error || !created) continue;
        rows.push({
          instance_id: inst.id, added_by: user?.id, contact_id: created.id,
          debtor_id: debtorId, role: ext.role, is_internal: false,
        });
      }

      // Internal approvers
      for (const intl of internals) {
        rows.push({
          instance_id: inst.id, added_by: user?.id,
          name: intl.name, email: intl.email, title: intl.title || null,
          role: intl.role, is_internal: true,
        });
      }

      if (rows.length > 0) {
        await (supabase.from("clm_instance_contacts" as any) as any).insert(rows);
      }
    } catch (e: any) {
      console.error("[NewWorkspaceDialog] failed adding collaborators", e);
      toast.error("Workspace created, but some collaborators could not be added");
    }

    close();
    navigate(`/contracts/instances/${inst.id}`);
  };

  const stepNum = step === "account" ? 1 : step === "templates" ? 2 : 3;
  const stepLabel =
    step === "account" ? "Pick the counterparty account"
    : step === "templates" ? "Select the contracts to negotiate"
    : "Add collaborators & approvers";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Collaboration Workspace</DialogTitle>
          <DialogDescription>Step {stepNum} of 3 — {stepLabel}</DialogDescription>
        </DialogHeader>

        {step === "account" && (
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Counterparty account</Label>
              {debtorId ? (
                <div className="mt-2 flex items-center justify-between rounded border bg-muted/40 p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{debtorLabel}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setDebtorId(null); setDebtorLabel(""); setSelectedContactIds([]); }}>
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
        )}

        {step === "templates" && (
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
                ) : readyTemplates.map((t) => {
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

        {step === "collaborators" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded border bg-muted/40 p-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{debtorLabel}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">{selectedTemplateIds.length} template(s)</Badge>
            </div>

            {/* Account contacts */}
            <div>
              <Label className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Existing contacts on this account
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pick which existing account contacts to invite as external collaborators.
              </p>
              <div className="mt-2 max-h-40 overflow-y-auto rounded border divide-y">
                {accountContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No contacts on this account yet — add new collaborators below.
                  </p>
                ) : accountContacts.map((c: any) => {
                  const checked = selectedContactIds.includes(c.id);
                  const hasEmail = !!c.email;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-2 ${hasEmail ? "hover:bg-muted/50 cursor-pointer" : "opacity-60"}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!hasEmail}
                        onCheckedChange={() => hasEmail && toggleAccountContact(c.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.name ?? "—"} {c.title && <span className="text-xs text-muted-foreground">· {c.title}</span>}
                          {c.is_primary && <Badge variant="outline" className="ml-1 text-[10px]">Primary</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {c.email ?? <span className="italic">no email — cannot be added</span>}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* New external */}
            <div className="rounded border p-3 space-y-2 bg-muted/20">
              <p className="text-xs font-semibold flex items-center gap-1">
                <UserPlus className="h-3 w-3" /> Add new external collaborator
              </p>
              {externals.length > 0 && (
                <div className="space-y-1">
                  {externals.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 bg-background">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.name} {e.title && <span className="text-xs text-muted-foreground">· {e.title}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{e.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{e.role}</Badge>
                        <Button size="icon" variant="ghost" onClick={() => setExternals((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={extDraft.name} onChange={(e) => setExtDraft({ ...extDraft, name: e.target.value })} />
                <Input placeholder="Title (optional)" value={extDraft.title} onChange={(e) => setExtDraft({ ...extDraft, title: e.target.value })} />
              </div>
              <Input
                placeholder="Email (required)"
                type="email"
                value={extDraft.email}
                onChange={(e) => setExtDraft({ ...extDraft, email: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Select value={extDraft.role} onValueChange={(v) => setExtDraft({ ...extDraft, role: v })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="signer">Signer</SelectItem>
                    <SelectItem value="cc">CC</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addExternal} className="ml-auto">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Internal approvers */}
            <div className="rounded border p-3 space-y-2 bg-muted/20">
              <p className="text-xs font-semibold flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Add internal approver / reviewer
              </p>
              {internals.length > 0 && (
                <div className="space-y-1">
                  {internals.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 bg-background">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.name} {e.title && <span className="text-xs text-muted-foreground">· {e.title}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{e.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{e.role}</Badge>
                        <Button size="icon" variant="ghost" onClick={() => setInternals((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={intDraft.name} onChange={(e) => setIntDraft({ ...intDraft, name: e.target.value })} />
                <Input placeholder="Title (e.g. General Counsel)" value={intDraft.title} onChange={(e) => setIntDraft({ ...intDraft, title: e.target.value })} />
              </div>
              <Input
                placeholder="Email (required)"
                type="email"
                value={intDraft.email}
                onChange={(e) => setIntDraft({ ...intDraft, email: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Select value={intDraft.role} onValueChange={(v) => setIntDraft({ ...intDraft, role: v })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="signer">Signer</SelectItem>
                    <SelectItem value="cc">CC</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addInternal} className="ml-auto">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Collaborators and approvers are optional. You can always add more after the workspace is created.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          {step === "account" && (
            <Button onClick={goFromAccount} disabled={!debtorId}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "templates" && (
            <>
              <Button variant="outline" onClick={() => setStep("account")}>Back</Button>
              <Button onClick={goFromTemplates} disabled={selectedTemplateIds.length === 0 || !name.trim()}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === "collaborators" && (
            <>
              <Button variant="outline" onClick={() => setStep("templates")}>Back</Button>
              <Button onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create workspace`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
