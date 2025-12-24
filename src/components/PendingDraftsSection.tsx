import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileText, 
  Check, 
  Trash2, 
  Search, 
  RefreshCw, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Mail
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const PendingDraftsSection = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [draftFilter, setDraftFilter] = useState<string>("pending");
  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set());

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (draftIds: string[]) => {
      const { error } = await supabase
        .from("ai_drafts")
        .update({ status: "approved" })
        .in("id", draftIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedDraftIds.size} draft(s) approved`);
      setSelectedDraftIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pending-drafts"] });
    },
    onError: () => toast.error("Failed to approve drafts"),
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (draftIds: string[]) => {
      const { error } = await supabase
        .from("ai_drafts")
        .delete()
        .in("id", draftIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedDraftIds.size} draft(s) deleted`);
      setSelectedDraftIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pending-drafts"] });
    },
    onError: () => toast.error("Failed to delete drafts"),
  });

  // Fetch drafts
  const { data: draftsData, isLoading, refetch } = useQuery({
    queryKey: ["pending-drafts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id, subject, message_body, status, step_number,
          recommended_send_date, created_at, sent_at,
          days_past_due,
          invoices (
            id, invoice_number, amount, due_date,
            debtors (id, company_name, name)
          )
        `)
        .in("status", ["pending_approval", "approved"])
        .is("sent_at", null)
        .order("recommended_send_date", { ascending: true })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  // Draft counts
  const draftCounts = useMemo(() => {
    if (!draftsData) return { pending: 0, approved: 0 };
    return {
      pending: draftsData.filter((d: any) => d.status === "pending_approval").length,
      approved: draftsData.filter((d: any) => d.status === "approved").length,
    };
  }, [draftsData]);

  // Filter drafts
  const filteredDrafts = useMemo(() => {
    if (!draftsData) return [];
    
    let filtered = draftsData.filter((draft: any) => {
      if (draftFilter === "pending") return draft.status === "pending_approval";
      if (draftFilter === "approved") return draft.status === "approved";
      return true;
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((draft: any) => {
        const invoice = draft.invoices as any;
        const companyName = invoice?.debtors?.company_name?.toLowerCase() || "";
        const debtorName = invoice?.debtors?.name?.toLowerCase() || "";
        const invoiceNumber = invoice?.invoice_number?.toLowerCase() || "";
        const subject = draft.subject?.toLowerCase() || "";
        
        return companyName.includes(query) || 
               debtorName.includes(query) || 
               invoiceNumber.includes(query) ||
               subject.includes(query);
      });
    }

    return filtered;
  }, [draftsData, draftFilter, searchQuery]);

  const toggleDraftSelection = (draftId: string) => {
    const newSelected = new Set(selectedDraftIds);
    if (newSelected.has(draftId)) {
      newSelected.delete(draftId);
    } else {
      newSelected.add(draftId);
    }
    setSelectedDraftIds(newSelected);
  };

  const selectAllDrafts = () => {
    if (selectedDraftIds.size === filteredDrafts.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(filteredDrafts.map((d: any) => d.id)));
    }
  };

  const toggleDraftExpand = (draftId: string) => {
    const newExpanded = new Set(expandedDrafts);
    if (newExpanded.has(draftId)) {
      newExpanded.delete(draftId);
    } else {
      newExpanded.add(draftId);
    }
    setExpandedDrafts(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (draftCounts.pending === 0 && draftCounts.approved === 0 && !isLoading) {
    return null; // Don't show section if no drafts
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pending Drafts
              {draftCounts.pending > 0 && (
                <Badge variant="secondary">{draftCounts.pending} pending</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review and approve AI-generated collection emails before sending.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="ml-2 hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh draft list</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Select value={draftFilter} onValueChange={setDraftFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">
                Pending ({draftCounts.pending})
              </SelectItem>
              <SelectItem value="approved">
                Approved ({draftCounts.approved})
              </SelectItem>
              <SelectItem value="all">All Drafts</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, invoice, or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedDraftIds.size > 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">
              {selectedDraftIds.size} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkApproveMutation.mutate(Array.from(selectedDraftIds))}
                    disabled={bulkApproveMutation.isPending}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Approve Selected
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approve all selected drafts</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkDeleteMutation.mutate(Array.from(selectedDraftIds))}
                    disabled={bulkDeleteMutation.isPending}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete all selected drafts</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Drafts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No drafts found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select All */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Checkbox
                checked={selectedDraftIds.size === filteredDrafts.length && filteredDrafts.length > 0}
                onCheckedChange={selectAllDrafts}
              />
              <span className="text-sm text-muted-foreground">
                Select all ({filteredDrafts.length})
              </span>
            </div>

            {filteredDrafts.slice(0, 15).map((draft: any) => {
              const invoice = draft.invoices as any;
              const isExpanded = expandedDrafts.has(draft.id);

              return (
                <Collapsible key={draft.id} open={isExpanded} onOpenChange={() => toggleDraftExpand(draft.id)}>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 p-3 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedDraftIds.has(draft.id)}
                        onCheckedChange={() => toggleDraftSelection(draft.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <CollapsibleTrigger asChild>
                        <div className="flex-1 cursor-pointer min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {invoice?.debtors?.company_name || 'Unknown'}
                            </span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              #{invoice?.invoice_number}
                            </Badge>
                            <Badge 
                              variant={draft.status === 'approved' ? 'default' : 'secondary'}
                              className="text-xs shrink-0"
                            >
                              {draft.status === 'approved' ? 'Approved' : 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {draft.subject || 'No subject'}
                          </p>
                        </div>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          Step {draft.step_number}
                        </span>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="p-4 pt-0 border-t bg-muted/30">
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div><strong>Amount:</strong> {formatCurrency(invoice?.amount || 0)}</div>
                          <div><strong>Due:</strong> {invoice?.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '-'}</div>
                        </div>
                        
                        <div className="bg-background rounded border p-3 mb-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                          <p className="text-sm mb-2">{draft.subject || 'No subject'}</p>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Body:</p>
                          <p className="text-sm whitespace-pre-wrap line-clamp-4">
                            {draft.message_body || 'No content'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/invoices/${invoice?.id}`)}
                              >
                                View Invoice
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open invoice details</TooltipContent>
                          </Tooltip>
                          
                          {draft.status === 'pending_approval' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => bulkApproveMutation.mutate([draft.id])}
                                  disabled={bulkApproveMutation.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Approve this draft</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {filteredDrafts.length > 15 && (
              <p className="text-center text-sm text-muted-foreground py-2">
                Showing 15 of {filteredDrafts.length} drafts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingDraftsSection;
