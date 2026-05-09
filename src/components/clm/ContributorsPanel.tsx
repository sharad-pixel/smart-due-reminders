import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, User, Building2, Briefcase, UserPlus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useAddInstanceContact,
  useAddInternalCollaborator,
  useRemoveInstanceContact,
} from "@/hooks/useClmInstance";

interface Props {
  instanceId: string;
  contacts: any[];
  debtors: any[];
}

export const ContributorsPanel = ({ instanceId, contacts, debtors }: Props) => {
  const externals = contacts.filter((c) => !c.is_internal);
  const internals = contacts.filter((c) => c.is_internal);
  const linkedDebtor = debtors[0];
  const debtorId = linkedDebtor?.debtor_id ?? null;

  const remove = useRemoveInstanceContact(instanceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Contributors
        </CardTitle>
        <CardDescription>
          All internal and external collaborators with access to this workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* External contributors */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> External ({externals.length})
            </p>
          </div>
          {externals.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No external contributors yet.</p>
          ) : (
            <div className="space-y-1">
              {externals.map((c) => (
                <ContributorRow key={c.id} contact={c} onRemove={() => remove.mutate(c.id)} />
              ))}
            </div>
          )}
          {debtorId ? (
            <AddExternalForm instanceId={instanceId} debtorId={debtorId} existing={externals} />
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Assign an account to add external contributors.
            </p>
          )}
        </section>

        {/* Internal contributors */}
        <section className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> Internal ({internals.length})
          </p>
          {internals.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No internal contributors yet.</p>
          ) : (
            <div className="space-y-1">
              {internals.map((c) => (
                <ContributorRow key={c.id} contact={c} onRemove={() => remove.mutate(c.id)} internal />
              ))}
            </div>
          )}
          <AddInternalForm instanceId={instanceId} />
        </section>
      </CardContent>
    </Card>
  );
};

const ContributorRow = ({
  contact, onRemove, internal,
}: { contact: any; onRemove: () => void; internal?: boolean }) => {
  const name = internal
    ? contact.name
    : contact.debtor_contacts?.name ?? contact.name ?? "—";
  const email = internal
    ? contact.email
    : contact.debtor_contacts?.email ?? contact.email;
  const title = internal
    ? contact.title
    : contact.debtor_contacts?.title ?? contact.title;

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <div className="flex items-center gap-2 min-w-0">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {name}
            {title && <span className="text-xs text-muted-foreground"> · {title}</span>}
          </p>
          {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="outline" className="text-[10px] capitalize">{contact.role}</Badge>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

const AddExternalForm = ({
  instanceId, debtorId, existing,
}: { instanceId: string; debtorId: string; existing: any[] }) => {
  const qc = useQueryClient();
  const addContact = useAddInstanceContact(instanceId);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [role, setRole] = useState("reviewer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: accountContacts = [] } = useQuery({
    queryKey: ["clm-debtor-contacts", debtorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("debtor_contacts")
        .select("id, name, email, title, is_primary")
        .eq("debtor_id", debtorId)
        .order("is_primary", { ascending: false });
      return data ?? [];
    },
  });
  const linkedIds = new Set(existing.map((c: any) => c.contact_id));
  const available = accountContacts.filter((c) => !linkedIds.has(c.id));

  const reset = () => { setName(""); setEmail(""); setTitle(""); };

  const submitNew = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return toast.error("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return toast.error("Enter a valid email");
    setSaving(true);
    const { data: debtorRow, error: dErr } = await supabase
      .from("debtors").select("user_id").eq("id", debtorId).maybeSingle();
    if (dErr || !debtorRow?.user_id) {
      setSaving(false);
      return toast.error("Could not resolve account owner");
    }
    const { data, error } = await supabase
      .from("debtor_contacts")
      .insert({
        debtor_id: debtorId,
        user_id: debtorRow.user_id,
        name: name.trim() || trimmedEmail.split("@")[0],
        email: trimmedEmail,
        title: title.trim() || null,
        is_primary: false,
        outreach_enabled: false,
        source: "clm_legal",
      } as any)
      .select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["clm-debtor-contacts", debtorId] });
    addContact.mutate({ contact_id: data.id, debtor_id: debtorId, role });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <UserPlus className="h-3.5 w-3.5 mr-1" /> Add external contributor
      </Button>
    );
  }

  return (
    <div className="rounded border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
          From account
        </Button>
        <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
          New contact
        </Button>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 w-[120px] text-xs ml-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor (can edit)</SelectItem>
            <SelectItem value="signer">Signer</SelectItem>
            <SelectItem value="reviewer">Reviewer</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="cc">CC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "existing" ? (
        available.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">All account contacts are already added.</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {available.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded p-1.5 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.name}</p>
                  {c.email && <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>}
                </div>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                  onClick={() => addContact.mutate({ contact_id: c.id, debtor_id: debtorId, role })}>
                  <Plus className="h-3 w-3 mr-0.5" /> Add
                </Button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Legal counsel" className="h-8 text-sm" />
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }} disabled={saving}>Cancel</Button>
        {mode === "new" && (
          <Button size="sm" onClick={submitNew} disabled={saving || !email.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
          </Button>
        )}
      </div>
    </div>
  );
};

const AddInternalForm = ({ instanceId }: { instanceId: string }) => {
  const add = useAddInternalCollaborator(instanceId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("reviewer");

  const reset = () => { setName(""); setEmail(""); setTitle(""); };

  const submit = async () => {
    const trimmedEmail = email.trim();
    if (!name.trim()) return toast.error("Name is required");
    if (!trimmedEmail) return toast.error("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return toast.error("Enter a valid email");
    await add.mutateAsync({ name: name.trim(), email: trimmedEmail, title: title.trim() || undefined, role });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <UserPlus className="h-3.5 w-3.5 mr-1" /> Add internal contributor
      </Button>
    );
  }

  return (
    <div className="rounded border p-3 space-y-2 bg-muted/20">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Title (optional)</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="General Counsel" className="h-8 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor (can edit)</SelectItem>
            <SelectItem value="approver">Approver</SelectItem>
            <SelectItem value="reviewer">Reviewer</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="signer">Signer</SelectItem>
            <SelectItem value="cc">CC</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { reset(); setOpen(false); }} disabled={add.isPending}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
          </Button>
        </div>
      </div>
    </div>
  );
};
