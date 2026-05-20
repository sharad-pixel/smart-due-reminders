import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Building2, Check, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  importId: string;
  currentDebtorId: string | null;
  currentDebtorName?: string | null;
}

/**
 * Inline picker to associate (or reassign) a contract to a customer/debtor.
 * Shows on the contract detail page header when no debtor is linked, and as a
 * subtle "Change" affordance when one already is.
 */
export function AssignContractDebtor({ importId, currentDebtorId, currentDebtorName }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
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
              <CommandEmpty>No customers found</CommandEmpty>
            )}
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
            {currentDebtorId && (
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" onClick={() => assign(null)}>
                  Remove customer link
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default AssignContractDebtor;
