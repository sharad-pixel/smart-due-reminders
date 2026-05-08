import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Search, Building2, User, Mail, ChevronDown, ChevronRight } from "lucide-react";
import {
  useAddInstanceDebtor,
  useRemoveInstanceDebtor,
  useAddInstanceContact,
  useRemoveInstanceContact,
} from "@/hooks/useClmInstance";

const DebtorContactsRow = ({
  debtorId, instanceId, linkedContacts,
}: { debtorId: string; instanceId: string; linkedContacts: any[] }) => {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("reviewer");
  const addContact = useAddInstanceContact(instanceId);
  const removeContact = useRemoveInstanceContact(instanceId);

  const { data: contacts = [] } = useQuery({
    queryKey: ["clm-debtor-contacts", debtorId],
    enabled: open,
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

  return (
    <div className="border-t pt-2 mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Contact collaborators ({linkedContacts.length})
      </button>

      {linkedContacts.length > 0 && (
        <div className="mt-2 space-y-1">
          {linkedContacts.map((lc: any) => (
            <div key={lc.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium truncate">{lc.debtor_contacts?.name ?? "—"}</span>
                {lc.debtor_contacts?.email && (
                  <span className="text-xs text-muted-foreground truncate">· {lc.debtor_contacts.email}</span>
                )}
                <Badge variant="outline" className="text-[10px] px-1">{lc.role}</Badge>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeContact.mutate(lc.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Add as:</span>
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
          {contacts.filter((c) => !linkedIds.has(c.id)).length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              {contacts.length === 0 ? "No contacts on this account yet." : "All contacts already added."}
            </p>
          ) : (
            contacts.filter((c) => !linkedIds.has(c.id)).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded p-1.5 hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{c.name} {c.is_primary && <Badge variant="secondary" className="text-[10px] ml-1">Primary</Badge>}</p>
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
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const InstanceAccountPicker = ({
  instanceId, linkedDebtors, linkedContacts = [],
}: { instanceId: string; linkedDebtors: any[]; linkedContacts?: any[] }) => {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("counterparty");
  const add = useAddInstanceDebtor(instanceId);
  const remove = useRemoveInstanceDebtor(instanceId);

  const { data: results = [] } = useQuery({
    queryKey: ["clm-debtor-search", search],
    queryFn: async () => {
      let q = supabase.from("debtors").select("id, company_name, name, email").eq("is_archived", false).limit(20);
      if (search.trim()) q = q.or(`company_name.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const linkedIds = new Set(linkedDebtors.map((d) => d.debtor_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Collaborating Accounts</CardTitle>
        <CardDescription>Add debtor accounts and pick contacts as collaborators</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedDebtors.length > 0 && (
          <div className="space-y-3">
            {linkedDebtors.map((l: any) => {
              const debtorContacts = linkedContacts.filter((c: any) => c.debtor_id === l.debtor_id);
              return (
                <div key={l.id} className="rounded border p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{l.debtors?.company_name ?? l.debtors?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{l.debtors?.email ?? ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{l.role}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(l.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <DebtorContactsRow
                    debtorId={l.debtor_id}
                    instanceId={instanceId}
                    linkedContacts={debtorContacts}
                  />
                </div>
              );
            })}
          </div>
        )}

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
          {results.filter((r: any) => !linkedIds.has(r.id)).map((d: any) => (
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
