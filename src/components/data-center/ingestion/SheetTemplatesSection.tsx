import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Download,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SheetTemplatesSection() {
  const queryClient = useQueryClient();
  const [selectedDebtor, setSelectedDebtor] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Get debtors for the push dropdown
  const { data: debtors } = useQuery({
    queryKey: ["debtors-for-sheets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("debtors")
        .select("id, company_name, name, reference_id")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("company_name", { ascending: true })
        .limit(500);
      return data || [];
    },
  });

  // Get existing sheet templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["sheet-templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("google_sheet_templates")
        .select("*, debtors(company_name, name, reference_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Push template mutation
  const pushMutation = useMutation({
    mutationFn: async (debtorId: string) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-push-template", {
        body: { debtorId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Sheet template created!", {
        description: `${data.existingInvoices} existing invoices pushed. Sheet: ${data.sheetTitle}`,
      });
      setSelectedDebtor("");
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
    },
    onError: (err: any) => toast.error("Failed to create sheet", { description: err.message }),
  });

  // Ingest (scan all sheets) mutation
  const ingestMutation = useMutation({
    mutationFn: async (sheetTemplateId?: string) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-ingest", {
        body: sheetTemplateId ? { sheetTemplateId } : {},
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.newInvoices > 0) {
        toast.success(`Imported ${data.newInvoices} new invoices`, {
          description: `${data.skipped} already existed, ${data.errors} errors`,
        });
      } else {
        toast.info("No new invoices found", {
          description: `${data.skipped} rows skipped (already imported)`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err: any) => toast.error("Ingestion failed", { description: err.message }),
  });

  const totalPages = Math.max(1, Math.ceil((templates || []).length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedTemplates = (templates || []).slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sheet className="h-5 w-5 text-primary" />
              Google Sheet Templates
            </CardTitle>
            <CardDescription>
              Push invoice templates to Google Sheets for customers to populate, then scan for new entries
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => ingestMutation.mutate()}
            disabled={ingestMutation.isPending || !templates || templates.length === 0}
          >
            {ingestMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Scan All Sheets
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Push Template Form */}
        <div className="p-4 bg-muted/50 rounded-lg border">
          <h4 className="text-sm font-medium mb-2">Push New Template to Google Drive</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Select a customer to create a Google Sheet pre-filled with their existing invoices.
            They can add new invoices directly in the sheet.
          </p>
          <div className="flex gap-2">
            <Select value={selectedDebtor} onValueChange={setSelectedDebtor}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {(debtors || []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.company_name || d.name || d.reference_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => selectedDebtor && pushMutation.mutate(selectedDebtor)}
              disabled={!selectedDebtor || pushMutation.isPending}
            >
              {pushMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sheet className="h-4 w-4 mr-1" />
              )}
              Push Template
            </Button>
          </div>
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sheet className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No sheet templates yet. Select a customer above to push your first template.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedTemplates.map((tmpl: any) => {
                const debtorName = tmpl.debtors?.company_name || tmpl.debtors?.name || 'Unknown';
                return (
                  <div key={tmpl.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Sheet className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tmpl.sheet_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Customer: {debtorName}
                          {tmpl.rows_synced > 0 && ` • ${tmpl.rows_synced} rows synced`}
                          {tmpl.last_synced_at && ` • Last scan: ${new Date(tmpl.last_synced_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={tmpl.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {tmpl.status === 'active' ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                        ) : tmpl.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(tmpl.sheet_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => ingestMutation.mutate(tmpl.id)}
                        disabled={ingestMutation.isPending}
                      >
                        {ingestMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Scan
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, templates.length)} of {templates.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {safeCurrentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
