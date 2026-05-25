import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check, Loader2, Plus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAccountId } from "@/hooks/useAccountId";

interface Props {
  importId: string;
  currentDebtorId: string | null;
  currentDebtorName?: string | null;
}

export function AssignContractDebtor({ importId, currentDebtorId, currentDebtorName }: Props) {
  const qc = useQueryClient();
  const { accountId } = useAccountId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
  });

  const { data: debtors = [], isLoading } = useQuery({
    queryKey: ["assign-debtor-list", search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("debtors")
        .select("id, company_name, name, email")
        .order("company_name", { ascending: true })
        .limit(50);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`company_name.ilike.${s},name.ilike.${s},email.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const label = useMemo(() => {
    if (currentDebtorId) return currentDebtorName || "Linked customer";
    return "Assign to customer";
  }, [currentDebtorId, currentDebtorName]);

  const assign = async (debtorId: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("live_contract_imports")
        .update({ debtor_id: debtorId })
        .eq("id", importId);
      if (error) throw error;
      toast.success(debtorId ? "Contract linked to customer" : "Customer link removed");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      await qc.invalidateQueries({ queryKey: ["lc-imports"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setNewCustomer({
      company_name: search.trim(),
      contact_name: "",
      email: "",
      phone: "",
    });
    setOpen(false);
    setCreateOpen(true);
  };

  const createAndAssign = async () => {
    if (!newCustomer.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!accountId) {
      toast.error("Account not ready, please retry");
      return;
    }
    setCreating(true);
    try {
      const referenceId = `RCPLY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const { data: debtor, error } = await supabase
        .from("debtors")
        .insert([{
          company_name: newCustomer.company_name.trim(),
          name: newCustomer.company_name.trim(),
          reference_id: referenceId,
          type: "B2B" as const,
          email: newCustomer.email.trim() || null,
          phone: newCustomer.phone.trim() || null,
          user_id: accountId,
        }])
        .select("id")
        .single();
      if (error) throw error;

      if (newCustomer.contact_name.trim() || newCustomer.email.trim()) {
        await supabase.from("debtor_contacts").insert([{
          debtor_id: debtor.id,
          user_id: accountId,
          name: newCustomer.contact_name.trim() || newCustomer.company_name.trim(),
          email: newCustomer.email.trim() || null,
          phone: newCustomer.phone.trim() || null,
          is_primary: true,
          outreach_enabled: true,
        }]);
      }

      const { error: updErr } = await supabase
        .from("live_contract_imports")
        .update({ debtor_id: debtor.id })
        .eq("id", importId);
      if (updErr) throw updErr;

      toast.success("Customer created and linked to contract");
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
      await qc.invalidateQueries({ queryKey: ["lc-imports"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create customer");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={currentDebtorId ? "ghost" : "outline"} size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : currentDebtorId ? <Building2 className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            {currentDebtorId ? "Change customer" : label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search customers…" value={search} onValueChange={setSearch} />
            <CommandList>
              {isLoading && <div className="p-3 text-xs text-muted-foreground">Loading…</div>}
              {!isLoading && debtors.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No customers found
                </div>
              )}
              {debtors.length > 0 && (
                <CommandGroup>
                  {debtors.map((d: any) => {
                    const isCurrent = d.id === currentDebtorId;
                    return (
                      <CommandItem key={d.id} onSelect={() => assign(d.id)} className="cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.company_name || d.name}</div>
                          {d.email && <div className="text-xs text-muted-foreground truncate">{d.email}</div>}
                        </div>
                        {isCurrent && <Check className="h-4 w-4 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
            <div className="border-t p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {search.trim()
                  ? `Create "${search.trim()}" as new customer`
                  : "Create new customer"}
              </Button>
              {currentDebtorId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive mt-1"
                  onClick={() => assign(null)}
                >
                  Remove customer link
                </Button>
              )}
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new customer</DialogTitle>
            <DialogDescription>
              This customer will be created and immediately linked to the contract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-co">Company name *</Label>
              <Input
                id="new-cust-co"
                value={newCustomer.company_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                placeholder="Acme Corp"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-contact">Primary contact name</Label>
              <Input
                id="new-cust-contact"
                value={newCustomer.contact_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, contact_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-email">Email</Label>
              <Input
                id="new-cust-email"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="ar@acme.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-phone">Phone</Label>
              <Input
                id="new-cust-phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="+1-555-0100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createAndAssign} disabled={creating || !newCustomer.company_name.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create &amp; link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AssignContractDebtor;
