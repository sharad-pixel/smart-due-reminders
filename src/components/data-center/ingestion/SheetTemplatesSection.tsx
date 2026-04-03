import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ExternalLink,
  Loader2,
  CheckCircle2,
  Upload,
  Download,
  Users,
  FileText,
  CreditCard,
  FolderOpen,
  Sparkles,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { GoogleSheetsIcon } from "@/components/icons/GoogleIcons";

const TEMPLATE_TYPES = [
  { key: 'accounts', label: 'Accounts', icon: Users, description: 'Customer accounts with RAID, contacts & balances' },
  { key: 'invoices', label: 'Invoices', icon: FileText, description: 'Open & Paid invoices with auto tab management' },
  { key: 'payments', label: 'Payments', icon: CreditCard, description: 'Payment records with partial payment support' },
] as const;

export function SheetTemplatesSection() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["sheet-templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("google_sheet_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: hasDrive } = useQuery({
    queryKey: ["drive-connection-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("drive_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
  });

  const existingTypes = new Set((templates || []).map((t: any) => t.template_type));
  const allCreated = TEMPLATE_TYPES.every(t => existingTypes.has(t.key));
  const missingTypes = TEMPLATE_TYPES.filter(t => !existingTypes.has(t.key)).map(t => t.key);

  // Batch create all missing templates
  const createAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-sheets-push-template", {
        body: { templateTypes: missingTypes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const count = data.created || data.results?.length || 0;
      toast.success(`${count} template${count !== 1 ? 's' : ''} created & synced!`, {
        description: `Saved to ${data.folderPath || 'recouply.ai data center'} in Google Drive`,
      });
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
    },
    onError: (err: any) => toast.error("Failed to create templates", { description: err.message }),
  });

  // Delete template (soft-delete by setting status to 'deleted')
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("google_sheet_templates")
        .update({ status: "deleted" })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removed", {
        description: "You can re-create it to generate a fresh sheet with current data.",
      });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
    },
    onError: (err: any) => toast.error("Delete failed", { description: err.message }),
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async ({ sheetTemplateId, direction }: { sheetTemplateId: string; direction: 'push' | 'pull' }) => {
      setSyncingId(`${sheetTemplateId}-${direction}`);
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", {
        body: { sheetTemplateId, direction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const dir = data.direction === 'push' ? 'Push' : 'Pull';
      const protectedNote = data.syncProtected ? `, ${data.syncProtected} sync-protected` : '';
      const details = data.direction === 'push'
        ? `${data.pushed || data.openPushed || 0} rows pushed`
        : `Created: ${data.created || 0}, Updated: ${data.updated || 0}, Skipped: ${data.skipped || 0}${data.movedToPaid ? `, Moved to Paid: ${data.movedToPaid}` : ''}${protectedNote}`;
      toast.success(`${dir} complete — ${data.templateType}`, { description: details });
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
    onError: (err: any) => toast.error("Sync failed", { description: err.message }),
    onSettled: () => setSyncingId(null),
  });

  if (!hasDrive) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GoogleSheetsIcon className="h-5 w-5" />
            Google Sheet Templates
          </CardTitle>
          <CardDescription>
            Connect Google Drive first to enable Sheet Templates for bidirectional data sync.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GoogleSheetsIcon className="h-5 w-5" />
                Data Center Templates
                {allCreated && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Google Drive → <span className="font-medium text-foreground/70">recouply.ai data center</span>
                </span>
              </CardDescription>
            </div>
            {!allCreated && (
              <Button
                size="sm"
                onClick={() => createAllMutation.mutate()}
                disabled={createAllMutation.isPending}
                className="shrink-0"
              >
                {createAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                {createAllMutation.isPending
                  ? `Creating ${missingTypes.length}…`
                  : `Create ${missingTypes.length === 3 ? 'All' : missingTypes.length} Template${missingTypes.length !== 1 ? 's' : ''}`
                }
              </Button>
            )}
          </div>
          {createAllMutation.isPending && (
            <Progress value={undefined} className="mt-3 h-1.5 animate-pulse" />
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          {TEMPLATE_TYPES.map(({ key, label, icon: Icon }) => {
            const tmpl = (templates || []).find((t: any) => t.template_type === key);
            const isActive = existingTypes.has(key);

            if (!isActive) {
              return (
                <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-dashed bg-muted/20">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">Pending</Badge>
                </div>
              );
            }

            return (
              <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card hover:bg-muted/30 transition-colors">
                <Icon className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{label}</span>
                  {tmpl?.last_synced_at && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Synced {new Date(tmpl.last_synced_at).toLocaleDateString()} {new Date(tmpl.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Push to Sheet"
                    onClick={() => syncMutation.mutate({ sheetTemplateId: tmpl.id, direction: 'push' })}
                    disabled={syncMutation.isPending}
                  >
                    {syncingId === `${tmpl.id}-push` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Pull from Sheet"
                    onClick={() => syncMutation.mutate({ sheetTemplateId: tmpl.id, direction: 'pull' })}
                    disabled={syncMutation.isPending}
                  >
                    {syncingId === `${tmpl.id}-pull` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Open in Google Sheets"
                    onClick={() => window.open(tmpl.sheet_url, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remove template"
                    onClick={() => setDeleteTarget({ id: tmpl.id, label })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Sync Protection Notice */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-primary/20 bg-primary/5 mt-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">Sync Protection Active</span> — Pull sync never deletes accounts, invoices, or payments. Updates require a valid RAID match. To protect specific accounts from sheet sync, disable sync on the account detail page.
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.label} template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink the Google Sheet from Recouply. The sheet will remain in your Drive but will no longer sync.
              You can re-create it afterwards — a fresh sheet will be generated and populated with your current Recouply data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              Remove Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}