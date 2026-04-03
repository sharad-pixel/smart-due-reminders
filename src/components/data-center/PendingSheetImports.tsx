import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Trash2, Building2, Loader2, CheckCircle2, XCircle } from "lucide-react";

export function PendingSheetImports() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingResults, setProcessingResults] = useState<Map<string, { status: "success" | "error"; message: string }>>(new Map());

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

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      let approved = 0;
      const results = new Map<string, { status: "success" | "error"; message: string }>();

      for (const id of ids) {
        const item = pendingImports?.find(p => p.id === id);
        if (!item) continue;

        const rawJson = (item.raw_json || {}) as Record<string, any>;
        const companyName = item.company_name || rawJson.company_name || "Unknown";
        const contactName = item.contact_name || rawJson.name || companyName;
        const contactEmail = item.email || rawJson.email || "";

        const insertPayload = {
            user_id: accountId,
            company_name: companyName,
            name: contactName,
            email: contactEmail || "noemail@placeholder.local",
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
        };
        console.log(`[PendingImports] Inserting debtor for "${companyName}":`, insertPayload);

        const { data: newDebtor, error: insertErr } = await supabase
          .from("debtors")
          .insert([insertPayload as any])
          .select("id, reference_id")
          .single();

        if (insertErr) {
          console.error(`Failed to create account for "${companyName}":`, insertErr);
          results.set(id, { status: "error", message: insertErr.message });
          continue;
        }

        // Create primary contact
        if (contactEmail || contactName) {
          await supabase.from("debtor_contacts").insert({
            debtor_id: newDebtor.id,
            user_id: accountId,
            name: contactName,
            email: contactEmail || null,
            phone: item.phone || rawJson.phone || null,
            is_primary: true,
            source: "google_sheets",
          });
        }

        // Mark as approved - use the effective account ID for the update
        const { error: updateErr } = await supabase
            .from("pending_sheet_imports")
            .update({ status: "approved", reviewed_at: new Date().toISOString() })
            .eq("id", id);

        if (updateErr) {
          console.error(`Account created but failed to mark import as approved:`, updateErr);
          results.set(id, { status: "error", message: "Account created but status update failed" });
        } else {
          results.set(id, { status: "success", message: `Created ${newDebtor.reference_id}` });
          approved++;
          // Immediately remove from local list so UI updates instantly
          queryClient.setQueryData(["pending-sheet-imports"], (old: any[] | undefined) =>
            old ? old.filter((p: any) => p.id !== id) : []
          );
        }
      }

      setProcessingResults(results);
      return approved;
    },
    onSuccess: (count) => {
      if (count > 0) {
        toast.success(`${count} account(s) created successfully`);
      }
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pending-sheet-imports"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["pending-sheet-imports-count"] });
    },
    onError: (err: any) => {
      toast.error("Failed to approve imports", { description: err.message });
    },
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
      queryClient.invalidateQueries({ queryKey: ["pending-sheet-imports-count"] });
    },
    onError: (err: any) => toast.error("Failed to reject", { description: err.message }),
  });

  const count = pendingImports?.length || 0;

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
    <div className="space-y-4">
      {count === 0 && !isLoading ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No pending account imports</p>
            <p className="text-xs text-muted-foreground mt-1">
              New accounts from Google Sheets will appear here for review when you pull data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Pending Account Imports
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : count}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Approve to create accounts, or reject to discard.
                </p>
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
                  {selectedIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
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
                  )}
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
                  <span className="w-20">Status</span>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {pendingImports?.map((item) => {
                    const result = processingResults.get(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`px-3 py-2.5 flex items-center gap-3 text-sm hover:bg-muted/30 transition-colors ${
                          result?.status === "success" ? "bg-green-50/50 dark:bg-green-950/20" :
                          result?.status === "error" ? "bg-red-50/50 dark:bg-red-950/20" : ""
                        }`}
                      >
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          disabled={!!result}
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
                        <div className="w-20 flex justify-center">
                          {result?.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : result?.status === "error" ? (
                            <span title={result.message}>
                              <XCircle className="h-4 w-4 text-red-500" />
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
