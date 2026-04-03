import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Check, Trash2, Building2, Loader2 } from "lucide-react";

export function PendingSheetImports() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: pendingImports, isLoading } = useQuery({
    queryKey: ["pending-sheet-imports"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pending_sheet_imports")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approveImports = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let approved = 0;
      for (const id of ids) {
        const item = pendingImports?.find(p => p.id === id);
        if (!item) continue;

        const rawJson = (item.raw_json || {}) as Record<string, any>;
        const { data: newDebtor, error: insertErr } = await supabase
          .from("debtors")
          .insert([{
            user_id: user.id,
            reference_id: "",
            company_name: item.company_name || rawJson.company_name || "Unknown",
            name: item.contact_name || rawJson.name || null,
            email: item.email || rawJson.email || null,
            phone: item.phone || rawJson.phone || null,
            address_line1: item.address_line1 || null,
            address_line2: item.address_line2 || null,
            city: item.city || null,
            state: item.state || null,
            postal_code: item.postal_code || null,
            country: item.country || null,
            industry: item.industry || null,
            type: (item.type === "B2C" ? "B2C" : "B2B") as "B2B" | "B2C",
            external_customer_id: item.external_customer_id || null,
            crm_account_id_external: item.crm_account_id_external || null,
            payment_terms_default: item.payment_terms_default || null,
            notes: item.notes || null,
            source_system: "google_sheets",
          }])
          .select("reference_id")
          .single();

        if (!insertErr && newDebtor) {
          // Mark as approved
          await supabase
            .from("pending_sheet_imports")
            .update({ status: "approved", reviewed_at: new Date().toISOString() })
            .eq("id", id);
          approved++;
        }
      }
      return approved;
    },
    onSuccess: (count) => {
      toast.success(`${count} account(s) created successfully`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pending-sheet-imports"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
    onError: (err: any) => toast.error("Failed to approve imports", { description: err.message }),
  });

  const rejectImports = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("pending_sheet_imports")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Imports rejected and removed from queue");
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pending-sheet-imports"] });
    },
    onError: (err: any) => toast.error("Failed to reject", { description: err.message }),
  });

  const count = pendingImports?.length || 0;
  if (count === 0 && !isLoading) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === count) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingImports?.map(p => p.id) || []));
  };

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                New Accounts from Sheets
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : count} pending
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                These new accounts were found in your Google Sheet. Review and approve to add them, or reject to discard.
              </CardDescription>
            </div>
          </div>
          {count > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0 || rejectImports.isPending}
                onClick={() => rejectImports.mutate(Array.from(selectedIds))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Reject ({selectedIds.size})
              </Button>
              {selectedIds.size > 0 ? (
                <Button
                  size="sm"
                  disabled={approveImports.isPending}
                  onClick={() => approveImports.mutate(Array.from(selectedIds))}
                >
                  {approveImports.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Approve ({selectedIds.size})
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="default"
                disabled={approveImports.isPending || count === 0}
                onClick={() => approveImports.mutate(pendingImports?.map(p => p.id) || [])}
              >
                {approveImports.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Approve All ({count})
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      {count > 0 && (
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 flex items-center gap-3 text-xs font-medium text-muted-foreground border-b">
              <Checkbox
                checked={selectedIds.size === count}
                onCheckedChange={toggleAll}
              />
              <span className="w-48">Company Name</span>
              <span className="w-40">Contact</span>
              <span className="w-48">Email</span>
              <span className="w-32">Location</span>
              <span className="w-20">Source</span>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {pendingImports?.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2.5 flex items-center gap-3 text-sm hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                  />
                  <div className="w-48 flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{item.company_name || "—"}</span>
                  </div>
                  <span className="w-40 truncate text-muted-foreground">{item.contact_name || "—"}</span>
                  <span className="w-48 truncate text-muted-foreground">{item.email || "—"}</span>
                  <span className="w-32 truncate text-muted-foreground">
                    {[item.city, item.state].filter(Boolean).join(", ") || "—"}
                  </span>
                  <Badge variant="outline" className="w-20 justify-center text-xs">
                    {item.source || "sheet"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
