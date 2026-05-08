import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X, User, Mail, Loader2, UserPlus, Users } from "lucide-react";
import { useAddInstanceContact, useRemoveInstanceContact } from "@/hooks/useClmInstance";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  templateId: string;
  templateName: string;
  debtorId: string | null;
  /** All workspace contacts already linked (any template) */
  allLinkedContacts: any[];
}

const ROLE_OPTIONS = [
  { v: "signer", l: "Signer" },
  { v: "reviewer", l: "Reviewer" },
  { v: "legal", l: "Legal" },
  { v: "approver", l: "Approver" },
  { v: "cc", l: "CC" },
];

export const TemplateCollaboratorsDialog = ({
  open, onOpenChange, instanceId, templateId, templateName, debtorId, allLinkedContacts,
}: Props) => {
  const qc = useQueryClient();
  const add = useAddInstanceContact(instanceId);
  const remove = useRemoveInstanceContact(instanceId);

  const [role, setRole] = useState("reviewer");

  // New contact form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTitle, setNewTitle] = useState("");

  // Existing account contacts (only when a debtor is linked)
  const { data: accountContacts = [] } = useQuery({
    queryKey: ["clm-debtor-contacts", debtorId],
    enabled: open && !!debtorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("debtor_contacts")
        .select("id, name, email, title, is_primary")
        .eq("debtor_id", debtorId!)
        .order("is_primary", { ascending: false });
      return data ?? [];
    },
  });

  // Collaborators currently scoped to THIS template
  const linkedToTemplate = allLinkedContacts.filter((c: any) => c.template_id === templateId);
  const linkedIds = new Set(linkedToTemplate.map((c: any) => c.contact_id).filter(Boolean));

  const createNewContact = useMutation({
    mutationFn: async () => {
      if (!debtorId) throw new Error("Workspace must be linked to an account first");
      if (!newName.trim() || !newEmail.trim()) throw new Error("Name and email are required");
      // 1. Create the debtor_contact
      const { data: created, error: cErr } = await supabase
        .from("debtor_contacts")
        .insert({
          debtor_id: debtorId,
          name: newName.trim(),
          email: newEmail.trim(),
          title: newTitle.trim() || null,
        } as any)
        .select("id")
        .single();
      if (cErr) throw cErr;
      // 2. Link them as a collaborator scoped to this template
      await add.mutateAsync({
        contact_id: created.id, debtor_id: debtorId, role,
        template_id: templateId, is_internal: false,
      });
    },
    onSuccess: () => {
      setNewName(""); setNewEmail(""); setNewTitle("");
      qc.invalidateQueries({ queryKey: ["clm-debtor-contacts", debtorId] });
      qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      toast.success("Contact created and added");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add contact"),
  });

  const addExisting = (contactId: string) =>
    add.mutate({
      contact_id: contactId, debtor_id: debtorId, role,
      template_id: templateId, is_internal: false,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Collaborators · {templateName}
          </DialogTitle>
          <DialogDescription>
            Invite reviewers, signers, and approvers for this specific contract.
          </DialogDescription>
        </DialogHeader>

        {/* Already invited */}
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Invited ({linkedToTemplate.length})
          </Label>
          {linkedToTemplate.length === 0 ? (
            <p className="text-xs text-muted-foreground italic mt-2">No collaborators yet for this template.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {linkedToTemplate.map((lc: any) => (
                <div key={lc.id} className="flex items-center justify-between rounded border bg-muted/40 px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {lc.debtor_contacts?.name ?? lc.name ?? "—"}
                    </span>
                    {(lc.debtor_contacts?.email ?? lc.email) && (
                      <span className="text-xs text-muted-foreground truncate">
                        · {lc.debtor_contacts?.email ?? lc.email}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">{lc.role}</Badge>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove.mutate(lc.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs">Add as</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="existing">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="existing">From account contacts</TabsTrigger>
            <TabsTrigger value="new">Add new contact</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-3">
            {!debtorId ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                Link a counterparty account to this workspace first.
              </p>
            ) : accountContacts.filter((c: any) => !linkedIds.has(c.id)).length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                {accountContacts.length === 0 ? "No contacts on this account yet." : "All contacts already added."}
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded border divide-y">
                {accountContacts.filter((c: any) => !linkedIds.has(c.id)).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-2 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {c.name} {c.is_primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                      </p>
                      {c.email && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />{c.email}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addExisting(c.id)} disabled={add.isPending}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="mt-3 space-y-3">
            {!debtorId ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                Link a counterparty account to this workspace first.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Name *</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jane@acme.com" type="email" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="General Counsel" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This will also be saved on the account so you can re-use them later.
                </p>
                <Button
                  className="w-full"
                  onClick={() => createNewContact.mutate()}
                  disabled={!newName.trim() || !newEmail.trim() || createNewContact.isPending}
                >
                  {createNewContact.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><UserPlus className="h-4 w-4 mr-1" />Create & invite</>}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
