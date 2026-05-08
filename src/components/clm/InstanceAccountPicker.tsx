import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Search, Building2 } from "lucide-react";
import { useAddInstanceDebtor, useRemoveInstanceDebtor } from "@/hooks/useClmInstance";

export const InstanceAccountPicker = ({
  instanceId, linkedDebtors,
}: { instanceId: string; linkedDebtors: any[] }) => {
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
        <CardDescription>Add debtor accounts to collaborate on this contract</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedDebtors.length > 0 && (
          <div className="space-y-2">
            {linkedDebtors.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between rounded border p-2">
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
            ))}
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
