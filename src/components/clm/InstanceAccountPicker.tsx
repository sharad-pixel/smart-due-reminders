import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Search, Building2, User, Mail, UserPlus, Lock } from "lucide-react";
import {
  useAddInstanceDebtor,
  useAddInstanceContact,
  useRemoveInstanceContact,
} from "@/hooks/useClmInstance";

const ExternalCollaboratorsCard = ({
  instanceId, linkedDebtor, linkedContacts,
}: { instanceId: string; linkedDebtor: any; linkedContacts: any[] }) => {
  const debtorId = linkedDebtor.debtor_id;
  const debtor = linkedDebtor.debtors;
  const [role, setRole] = useState("reviewer");
  const addContact = useAddInstanceContact(instanceId);
  const removeContact = useRemoveInstanceContact(instanceId);

  const { data: contacts = [], isLoading } = useQuery({
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

  const linkedIds = new Set(linkedContacts.map((c: any) => c.contact_id));
  const available = contacts.filter((c) => !linkedIds.has(c.id));

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> External Collaborators
            </CardTitle>
            <CardDescription>Counterparty contacts added to this workspace</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1 text-[11px] shrink-0">
            <Lock className="h-3 w-3" /> Account locked
          </Badge>
        </div>
        <div className="flex items-center gap-2 rounded border bg-muted/40 p-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {debtor?.company_name ?? debtor?.name ?? "—"}
            </p>
            {debtor?.email && (
              <p className="text-xs text-muted-foreground truncate">{debtor.email}</p>
            )}
          </div>
          <Badge variant="outline" className="ml-auto text-xs capitalize">{linkedDebtor.role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Linked collaborators */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Active collaborators ({linkedContacts.length})
          </p>
          {linkedContacts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-1">
              None yet — add contacts from the list below.
            </p>
          ) : (
            <div className="space-y-1">
              {linkedContacts.map((lc: any) => (
                <div key={lc.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {lc.debtor_contacts?.name ?? "—"}
                      </p>
                      {lc.debtor_contacts?.email && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {lc.debtor_contacts.email}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1 ml-1 capitalize">{lc.role}</Badge>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeContact.mutate(lc.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add available contacts */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Available account contacts
            </p>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="signer">Signer</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="cc">CC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground italic">Loading contacts…</p>
          ) : available.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              {contacts.length === 0
                ? "No contacts on this account yet — add one from the debtor's profile."
                : "All account contacts have been added."}
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {available.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded p-1.5 hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate flex items-center gap-1">
                        {c.name}
                        {c.is_primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                      </p>
                      {c.email && (
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />{c.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => addContact.mutate({ contact_id: c.id, debtor_id: debtorId, role })}
                  >
                    <Plus className="h-3 w-3 mr-0.5" />Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const InstanceAccountPicker = ({
  instanceId, linkedDebtors, linkedContacts = [],
}: { instanceId: string; linkedDebtors: any[]; linkedContacts?: any[] }) => {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("counterparty");
  const add = useAddInstanceDebtor(instanceId);

  const { data: results = [] } = useQuery({
    queryKey: ["clm-debtor-search", search],
    queryFn: async () => {
      let q = supabase.from("debtors").select("id, company_name, name, email").eq("is_archived", false).limit(20);
      if (search.trim()) q = q.or(`company_name.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Once an account is assigned, swap the entire card to External Collaborators
  if (linkedDebtors.length >= 1) {
    const linked = linkedDebtors[0];
    const debtorContacts = linkedContacts.filter((c: any) => c.debtor_id === linked.debtor_id);
    return (
      <ExternalCollaboratorsCard
        instanceId={instanceId}
        linkedDebtor={linked}
        linkedContacts={debtorContacts}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Collaborating Account
        </CardTitle>
        <CardDescription>Pick the debtor account this contract is being negotiated with</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search debtor accounts…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="counterparty">Counterparty</SelectItem>
              <SelectItem value="reviewer">Reviewer</SelectItem>
              <SelectItem value="cc">CC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {results.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded p-2 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{d.company_name ?? d.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{d.email ?? ""}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => add.mutate({ debtor_id: d.id, role })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          ))}
          {results.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No accounts found</p>}
        </div>
      </CardContent>
    </Card>
  );
};
