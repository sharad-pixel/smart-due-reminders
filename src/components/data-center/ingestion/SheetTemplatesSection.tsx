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
  Upload,
  Download,
  Users,
  FileText,
  CreditCard,
} from "lucide-react";

const TEMPLATE_TYPES = [
  { key: 'accounts', label: 'Accounts', icon: Users, description: 'All customer accounts with RAID, contacts, and balances' },
  { key: 'invoices', label: 'Invoices', icon: FileText, description: 'Open invoices with auto Paid-tab management' },
  { key: 'payments', label: 'Payments', icon: CreditCard, description: 'Payment records with partial payment support' },
] as const;

export function SheetTemplatesSection() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Get existing sheet templates
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

  // Check drive connection
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

  // Push template creation
  const pushTemplateMutation = useMutation({
    mutationFn: async (templateType: string) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-push-template", {
        body: { templateType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.templateType} template created!`, {
        description: `${data.rowCount} rows pushed to ${data.folderPath}`,
      });
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
    },
    onError: (err: any) => toast.error("Failed to create template", { description: err.message }),
  });

  // Sync mutation (push or pull)
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
      const details = data.direction === 'push'
        ? `${data.pushed || data.openPushed || 0} rows pushed`
        : `Created: ${data.created || 0}, Updated: ${data.updated || 0}, Skipped: ${data.skipped || 0}${data.movedToPaid ? `, Moved to Paid: ${data.movedToPaid}` : ''}`;
      toast.success(`${dir} complete for ${data.templateType}`, { description: details });
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
    onError: (err: any) => toast.error("Sync failed", { description: err.message }),
    onSettled: () => setSyncingId(null),
  });

  if (!hasDrive) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sheet className="h-5 w-5 text-primary" />
            Google Sheet Templates
          </CardTitle>
          <CardDescription>
            Connect Google Drive first to use Sheet Templates for data synchronization.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sheet className="h-5 w-5 text-primary" />
            Google Sheet Templates
          </CardTitle>
          <CardDescription>
            Master templates for Accounts, Invoices, and Payments synced to Google Drive → Recouply/Templates
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Templates */}
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATE_TYPES.map(({ key, label, icon: Icon, description }) => {
            const exists = existingTypes.has(key);
            const tmpl = (templates || []).find((t: any) => t.template_type === key);
            return (
              <div key={key} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm">{label}</span>
                  {exists && (
                    <Badge variant="default" className="text-xs ml-auto">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>

                {!exists ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => pushTemplateMutation.mutate(key)}
                    disabled={pushTemplateMutation.isPending}
                  >
                    {pushTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sheet className="h-4 w-4 mr-1" />
                    )}
                    Create Template
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => syncMutation.mutate({ sheetTemplateId: tmpl.id, direction: 'push' })}
                        disabled={syncMutation.isPending}
                      >
                        {syncingId === `${tmpl.id}-push` ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3 mr-1" />
                        )}
                        Push
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => syncMutation.mutate({ sheetTemplateId: tmpl.id, direction: 'pull' })}
                        disabled={syncMutation.isPending}
                      >
                        {syncingId === `${tmpl.id}-pull` ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3 mr-1" />
                        )}
                        Pull
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => window.open(tmpl.sheet_url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open in Sheets
                    </Button>
                    {tmpl.last_synced_at && (
                      <p className="text-[11px] text-muted-foreground text-center">
                        Last synced: {new Date(tmpl.last_synced_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
