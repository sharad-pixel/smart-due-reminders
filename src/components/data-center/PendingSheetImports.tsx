import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Trash2, Building2, Loader2, CheckCircle2, XCircle, Sparkles, ArrowRight, Undo2 } from "lucide-react";

interface AiSuggestion {
  id: string;
  company_name: string;
  contact_name: string;
  company_changed: boolean;
  contact_changed: boolean;
}

export function PendingSheetImports() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingResults, setProcessingResults] = useState<Map<string, { status: "success" | "error"; message: string }>>(new Map());
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, AiSuggestion>>(new Map());
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());

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

  const cleanWithAi = useMutation({
    mutationFn: async () => {
      if (!pendingImports || pendingImports.length === 0) return;

      const records = pendingImports.map(p => ({
        id: p.id,
        company_name: p.company_name,
        contact_name: p.contact_name,
      }));

      const { data, error } = await supabase.functions.invoke("ai-clean-import-names", {
        body: { records },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.cleaned as AiSuggestion[];
    },
    onSuccess: (cleaned) => {
      if (!cleaned) return;
      const map = new Map<string, AiSuggestion>();
      const accepted = new Set<string>();
      let changesCount = 0;

      for (const item of cleaned) {
        map.set(item.id, item);
        if (item.company_changed || item.contact_changed) {
          accepted.add(item.id); // auto-accept suggestions
          changesCount++;
        }
      }
      setAiSuggestions(map);
      setAcceptedSuggestions(accepted);

      if (changesCount > 0) {
        toast.success(`AI found ${changesCount} name correction(s)`, {
          description: "Review suggestions below. Accepted changes will apply on approval.",
        });
      } else {
        toast.info("Names look clean — no corrections needed.");
      }
    },
    onError: (err: any) => {
      toast.error("AI cleaning failed", { description: err.message });
    },
  });

  const approveImports = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      let approved = 0;
      const results = new Map<string, { status: "success" | "error"; message: string }>();

      for (const id of ids) {
        const item = pendingImports?.find(p => p.id === id);
        if (!item) continue;

        const rawJson = (item.raw_json || {}) as Record<string, any>;

        // Use AI-cleaned names if suggestion was accepted
        const suggestion = acceptedSuggestions.has(id) ? aiSuggestions.get(id) : null;
        const companyName = suggestion?.company_name || item.company_name || rawJson.company_name || "Unknown";
        const contactName = suggestion?.contact_name || item.contact_name || rawJson.name || companyName;
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

        const { error: updateErr } = await supabase
          .from("pending_sheet_imports")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .eq("id", id);

        if (updateErr) {
          results.set(id, { status: "error", message: "Account created but status update failed" });
        } else {
          results.set(id, { status: "success", message: `Created ${newDebtor.reference_id}` });
          approved++;
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
      setAiSuggestions(new Map());
      setAcceptedSuggestions(new Set());
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

  const toggleSuggestion = (id: string) => {
    setAcceptedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasAnySuggestions = aiSuggestions.size > 0;

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
                  {hasAnySuggestions
                    ? "Review AI suggestions below, then approve to create accounts."
                    : "Use AI to clean names before approving, or approve directly."}
                </p>
              </div>
              {count > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cleanWithAi.isPending || count === 0}
                    onClick={() => cleanWithAi.mutate()}
                    className="border-primary/30 text-primary hover:bg-primary/5"
                  >
                    {cleanWithAi.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    {cleanWithAi.isPending ? "Cleaning…" : "Clean with AI"}
                  </Button>
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
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {pendingImports?.map((item) => {
                    const result = processingResults.get(item.id);
                    const suggestion = aiSuggestions.get(item.id);
                    const isAccepted = acceptedSuggestions.has(item.id);
                    const hasChange = suggestion && (suggestion.company_changed || suggestion.contact_changed);

                    return (
                      <div key={item.id}>
                        <div
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
                            <span className={`font-medium truncate ${hasChange && isAccepted && suggestion?.company_changed ? "line-through text-muted-foreground" : ""}`}>
                              {item.company_name || "—"}
                            </span>
                          </div>
                          <span className={`w-40 truncate text-muted-foreground ${hasChange && isAccepted && suggestion?.contact_changed ? "line-through" : ""}`}>
                            {item.contact_name || "—"}
                          </span>
                          <span className="w-48 truncate text-muted-foreground">{item.email || "—"}</span>
                          <span className="w-32 truncate text-muted-foreground">
                            {[item.city, item.state].filter(Boolean).join(", ") || "—"}
                          </span>
                          <div className="w-20 flex justify-center">
                            {result?.status === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : result?.status === "error" ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>{result.message}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                pending
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* AI suggestion row */}
                        {hasChange && !result && (
                          <div className="px-3 py-2 bg-primary/5 border-t border-dashed border-primary/20 flex items-center gap-3 text-sm">
                            <div className="w-4" /> {/* checkbox spacer */}
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="text-xs text-primary font-medium shrink-0">AI:</span>
                              {suggestion.company_changed && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="text-muted-foreground text-xs truncate">{item.company_name}</span>
                                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                                  <span className="font-medium text-primary truncate">{suggestion.company_name}</span>
                                </span>
                              )}
                              {suggestion.company_changed && suggestion.contact_changed && (
                                <span className="text-muted-foreground/40 mx-1">·</span>
                              )}
                              {suggestion.contact_changed && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="text-muted-foreground text-xs truncate">{item.contact_name}</span>
                                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                                  <span className="font-medium text-primary truncate">{suggestion.contact_name}</span>
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 px-2 text-xs shrink-0 ${isAccepted ? "text-primary" : "text-muted-foreground"}`}
                              onClick={() => toggleSuggestion(item.id)}
                            >
                              {isAccepted ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Accepted
                                </>
                              ) : (
                                <>
                                  <Undo2 className="h-3 w-3 mr-1" />
                                  Dismissed
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {hasAnySuggestions && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Accepted AI corrections will be applied when you approve records.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
