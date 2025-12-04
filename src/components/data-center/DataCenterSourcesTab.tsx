import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Settings, 
  Download, 
  Upload, 
  MoreVertical,
  Trash2,
  FileSpreadsheet,
  Loader2,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EditSourceMappingsModal } from "./EditSourceMappingsModal";

interface DataCenterSourcesTabProps {
  onCreateSource: () => void;
}

const SYSTEM_TYPES: Record<string, { label: string; color: string }> = {
  quickbooks: { label: "QuickBooks", color: "bg-green-100 text-green-800" },
  netsuite: { label: "NetSuite", color: "bg-blue-100 text-blue-800" },
  sap: { label: "SAP", color: "bg-yellow-100 text-yellow-800" },
  xero: { label: "Xero", color: "bg-cyan-100 text-cyan-800" },
  custom: { label: "Custom", color: "bg-gray-100 text-gray-800" },
};

export const DataCenterSourcesTab = ({ onCreateSource }: DataCenterSourcesTabProps) => {
  const [editingSource, setEditingSource] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sources, isLoading } = useQuery({
    queryKey: ["data-center-sources"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_center_sources")
        .select(`
          *,
          mappings:data_center_source_field_mappings(count),
          uploads:data_center_uploads(count),
          custom_fields:data_center_custom_fields(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: fieldDefinitions } = useQuery({
    queryKey: ["field-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_center_field_definitions")
        .select("*")
        .order("grouping", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("data_center_sources")
        .delete()
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-center-sources"] });
      queryClient.invalidateQueries({ queryKey: ["data-center-stats"] });
      toast({ title: "Source deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const downloadSourceTemplate = async (sourceId: string, sourceName: string, fileType: "invoice_aging" | "payments") => {
    // Fetch source mappings
    let { data: mappings } = await supabase
      .from("data_center_source_field_mappings")
      .select("file_column_name, confirmed_field_key, inferred_field_key")
      .eq("source_id", sourceId);

    // Auto-create default mappings if none exist
    if (!mappings || mappings.length === 0) {
      if (!fieldDefinitions || fieldDefinitions.length === 0) {
        toast({ 
          title: "Error", 
          description: "Field definitions not loaded.",
          variant: "destructive" 
        });
        return;
      }

      // Create default mappings using field labels as column names
      const defaultMappings = fieldDefinitions.map(field => ({
        source_id: sourceId,
        file_column_name: field.label,
        inferred_field_key: field.key,
        confirmed_field_key: field.key,
        confidence_score: 1.0,
      }));

      const { error } = await supabase
        .from("data_center_source_field_mappings")
        .insert(defaultMappings);

      if (error) {
        toast({ 
          title: "Error creating mappings", 
          description: error.message,
          variant: "destructive" 
        });
        return;
      }

      // Refresh mappings after insert
      const { data: newMappings } = await supabase
        .from("data_center_source_field_mappings")
        .select("file_column_name, confirmed_field_key, inferred_field_key")
        .eq("source_id", sourceId);
      
      mappings = newMappings;
      queryClient.invalidateQueries({ queryKey: ["data-center-sources"] });
    }

    // Filter mappings by file type (invoice vs payment)
    const relevantGroupings = fileType === "invoice_aging" ? ["customer", "invoice"] : ["customer", "payment"];
    const relevantFieldKeys = fieldDefinitions
      ?.filter(f => relevantGroupings.includes(f.grouping))
      .map(f => f.key) || [];

    const filteredMappings = (mappings || []).filter(m => {
      const fieldKey = m.confirmed_field_key || m.inferred_field_key;
      return relevantFieldKeys.includes(fieldKey);
    });

    if (filteredMappings.length === 0) {
      toast({ 
        title: "No relevant mappings", 
        description: `No ${fileType === "invoice_aging" ? "invoice" : "payment"} field mappings found for this source.`,
        variant: "destructive" 
      });
      return;
    }

    // Use file_column_name as headers (this is what the user's system uses)
    const headers = filteredMappings.map(m => m.file_column_name);
    const csvContent = [headers.join(","), ""].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeSourceName = sourceName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeSourceName}_${fileType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Template downloaded", description: `Template using ${sourceName} column mappings.` });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account ID Requirement Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            Recouply Account ID Required
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            To map invoices to accounts, only the <strong className="text-foreground">Recouply Account ID</strong> (format: RCPLY-XXXXX) 
            is required. No other customer fields are needed—just include the Account ID to link each invoice or payment to its account.
          </p>
          <p>
            Export your accounts from the <strong className="text-foreground">Accounts</strong> page to get the Account IDs needed for your import files.
          </p>
        </CardContent>
      </Card>

      {/* Sources List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Data Sources</CardTitle>
            <CardDescription>
              Configure mapping profiles for different systems
            </CardDescription>
          </div>
          <Button onClick={onCreateSource}>
            <Plus className="h-4 w-4 mr-2" />
            New Source
          </Button>
        </CardHeader>
        <CardContent>
          {sources && sources.length > 0 ? (
            <div className="space-y-3">
              {sources.map((source: any) => {
                const systemType = SYSTEM_TYPES[source.system_type] || SYSTEM_TYPES.custom;
                return (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Settings className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{source.source_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="secondary" className={systemType.color}>
                            {systemType.label}
                          </Badge>
                          {source.description && (
                            <span className="truncate max-w-[200px]">{source.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {source.mappings?.[0]?.count || 0} mappings
                      </Badge>
                      <Badge variant="outline">
                        {source.uploads?.[0]?.count || 0} uploads
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => downloadSourceTemplate(source.id, source.source_name, "invoice_aging")}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Download Invoice Template
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadSourceTemplate(source.id, source.source_name, "payments")}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Payment Template
                          </DropdownMenuItem>
                          <div className="border-t my-1" />
                          <DropdownMenuItem>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload File
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingSource(source)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Mappings
                          </DropdownMenuItem>
                          <div className="border-t my-1" />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteSource.mutate(source.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No data sources configured yet.</p>
              <p className="text-sm">Create a source profile to save your column mappings.</p>
              <Button className="mt-4" onClick={onCreateSource}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Source
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fields Reference per Source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fields Reference</CardTitle>
          <CardDescription>
            Available fields for each data source (including custom fields)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sources && sources.length > 0 ? (
            <div className="space-y-6">
              {sources.map((source: any) => {
                const customFields = source.custom_fields || [];
                const allSourceFields = [
                  ...(fieldDefinitions?.filter(f => ["customer", "invoice", "payment", "meta"].includes(f.grouping)) || []),
                  ...customFields.map((cf: any) => ({ ...cf, isCustom: true })),
                ];
                
                return (
                  <div key={source.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium">{source.source_name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {customFields.length} custom field{customFields.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Customer</p>
                        <div className="flex flex-wrap gap-1">
                          {fieldDefinitions?.filter(f => f.grouping === "customer").map(f => (
                            <Badge key={f.key} variant="outline" className="text-xs">
                              {f.label}{f.required_for_recouply && <span className="text-destructive ml-1">*</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Invoice / Payment</p>
                        <div className="flex flex-wrap gap-1">
                          {fieldDefinitions?.filter(f => ["invoice", "payment"].includes(f.grouping)).map(f => (
                            <Badge key={f.key} variant="outline" className="text-xs">
                              {f.label}{f.required_for_recouply && <span className="text-destructive ml-1">*</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Custom Fields</p>
                        {customFields.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {customFields.map((cf: any) => (
                              <Badge key={cf.id} variant="default" className="text-xs">
                                {cf.label}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No custom fields</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <p>Create a data source to see available fields</p>
            </div>
          )}
          
          {/* Required fields legend */}
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <span className="text-destructive">*</span> = Required for import
          </div>
        </CardContent>
      </Card>
      {/* Edit Mappings Modal */}
      <EditSourceMappingsModal
        open={!!editingSource}
        onClose={() => setEditingSource(null)}
        source={editingSource}
      />
    </div>
  );
};
