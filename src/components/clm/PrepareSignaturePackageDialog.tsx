import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, FileText, Loader2, PenLine, Send } from "lucide-react";
import { useInstanceRevisions } from "@/hooks/useClmInstance";
import { useCreateSignaturePackage } from "@/hooks/useClmSignaturePackages";

interface TemplateMeta {
  template_id: string;
  template_name: string;
  is_primary: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  instanceId: string;
  templates: TemplateMeta[];
  sections: any[];
  contacts: any[]; // for signer suggestions
  externalAccess?: any[];
}

export const PrepareSignaturePackageDialog = ({
  open, onOpenChange, instanceId, templates, sections, contacts, externalAccess = [],
}: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  const create = useCreateSignaturePackage(instanceId);

  // Per-template stats
  const tplStats = useMemo(() => {
    const m = new Map<string, { pending: number; version: number; sectionCount: number }>();
    templates.forEach((t) => {
      const tplSections = sections.filter((s: any) =>
        s.source_template_id === t.template_id || (t.is_primary && !s.source_template_id)
      );
      const ids = new Set(tplSections.map((s: any) => s.id));
      const tplRevs = (revisions as any[]).filter((r) => ids.has(r.section_id));
      m.set(t.template_id, {
        pending: tplRevs.filter((r) => r.approval_status === "pending").length,
        version: tplRevs.filter((r) => r.approval_status === "approved").length + 1,
        sectionCount: tplSections.length,
      });
    });
    return m;
  }, [templates, sections, revisions]);

  // Suggest signers from contacts whose role is 'signer' or 'owner'
  const suggestedSigners = useMemo(() => {
    const list: { email: string; name: string; role?: string }[] = [];
    const seen = new Set<string>();
    [...contacts, ...externalAccess.filter((a: any) => !a.revoked_at)].forEach((c: any) => {
      const email = (c.is_internal ? c.email : c.debtor_contacts?.email ?? c.email) || "";
      const name = (c.is_internal ? c.name : c.debtor_contacts?.name ?? c.name) || email;
      const role = (c.role ?? "").toLowerCase();
      if (!email || seen.has(email.toLowerCase())) return;
      if (!["signer", "owner"].includes(role)) return;
      seen.add(email.toLowerCase());
      list.push({ email, name, role });
    });
    return list;
  }, [contacts, externalAccess]);

  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [signers, setSigners] = useState<{ email: string; name: string }[]>([]);
  const [newSignerEmail, setNewSignerEmail] = useState("");
  const [newSignerName, setNewSignerName] = useState("");
  const [provider, setProvider] = useState<"manual" | "docusign" | "adobe" | "google_docs">("manual");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      const eligible = templates
        .filter((t) => (tplStats.get(t.template_id)?.pending ?? 0) === 0)
        .map((t) => t.template_id);
      setSelectedTemplates(new Set(eligible));
      setSigners(suggestedSigners.map((s) => ({ email: s.email, name: s.name })));
      setProvider("manual");
      setNotes("");
      setNewSignerEmail(""); setNewSignerName("");
    }
  }, [open, templates, tplStats, suggestedSigners]);

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addSigner = () => {
    const e = newSignerEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (signers.find((s) => s.email.toLowerCase() === e)) return;
    setSigners((cur) => [...cur, { email: e, name: newSignerName.trim() || e.split("@")[0] }]);
    setNewSignerEmail(""); setNewSignerName("");
  };

  const handleSend = async () => {
    const included = templates
      .filter((t) => selectedTemplates.has(t.template_id))
      .map((t) => ({
        template_id: t.template_id,
        name: t.template_name,
        version: tplStats.get(t.template_id)?.version ?? 1,
      }));
    if (included.length === 0) return;
    if (signers.length === 0) return;
    await create.mutateAsync({ provider, included_templates: included, signers, notes });
    onOpenChange(false);
  };

  const blockingCount = templates.filter((t) => (tplStats.get(t.template_id)?.pending ?? 0) > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-4 w-4" />Prepare for signature</DialogTitle>
          <DialogDescription>
            Bundle the selected template versions into a signature-ready package.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Step 1: Templates */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">1. Select template versions</Label>
            <div className="rounded border divide-y">
              {templates.map((t) => {
                const stats = tplStats.get(t.template_id);
                const blocked = (stats?.pending ?? 0) > 0;
                const checked = selectedTemplates.has(t.template_id);
                return (
                  <div key={t.template_id} className={`flex items-center gap-3 p-3 ${blocked ? "opacity-60" : ""}`}>
                    <Checkbox checked={checked} disabled={blocked} onCheckedChange={() => toggleTemplate(t.template_id)} />
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.template_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        v{stats?.version ?? 1} · {stats?.sectionCount ?? 0} sections
                      </p>
                    </div>
                    {blocked ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]">
                        <AlertCircle className="h-3 w-3 mr-1" />{stats?.pending} open
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Ready</Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {blockingCount > 0 && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Resolve open suggestions before including those templates.
              </p>
            )}
          </section>

          {/* Step 2: Signers */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">2. Signers</Label>
            <div className="rounded border divide-y">
              {signers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-3 py-3">No signers yet — add at least one.</p>
              ) : signers.map((s, i) => (
                <div key={s.email} className="flex items-center gap-2 p-2.5">
                  <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => setSigners((cur) => cur.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="signer@company.com" value={newSignerEmail}
                onChange={(e) => setNewSignerEmail(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Name (optional)" value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" variant="outline" onClick={addSigner}>Add</Button>
            </div>
          </section>

          {/* Step 3: Provider */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">3. Send via</Label>
            <RadioGroup value={provider} onValueChange={(v: any) => setProvider(v)} className="grid grid-cols-2 gap-2">
              <ProviderOption value="manual" label="Manual download" desc="Combined PDF, send yourself" current={provider} />
              <ProviderOption value="google_docs" label="Google Docs" desc="Export to Google Doc" current={provider} />
              <ProviderOption value="docusign" label="DocuSign" desc="Provider key required" current={provider} />
              <ProviderOption value="adobe" label="Adobe Sign" desc="Provider key required" current={provider} />
            </RadioGroup>
          </section>

          <Textarea placeholder="Optional internal notes" value={notes}
            onChange={(e) => setNotes(e.target.value)} className="text-sm" rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={create.isPending || selectedTemplates.size === 0 || signers.length === 0}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {provider === "manual" ? "Save package" : "Send for signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ProviderOption = ({ value, label, desc, current }: { value: string; label: string; desc: string; current: string }) => (
  <label className={`flex items-start gap-2 rounded border p-2.5 cursor-pointer transition-colors ${
    current === value ? "border-primary bg-primary/5" : "hover:bg-muted/30"
  }`}>
    <RadioGroupItem value={value} className="mt-0.5" />
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
    </div>
  </label>
);
