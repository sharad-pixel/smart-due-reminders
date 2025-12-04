import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditSourceMappingsModalProps {
  open: boolean;
  onClose: () => void;
  source: {
    id: string;
    source_name: string;
    system_type: string;
  } | null;
}

interface CustomField {
  id?: string;
  key: string;
  label: string;
  data_type: string;
  grouping: string;
  isNew?: boolean;
}

interface Mapping {
  id?: string;
  file_column_name: string;
  confirmed_field_key: string | null;
  inferred_field_key: string | null;
  confidence_score: number | null;
}

const DATA_TYPES = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Currency" },
  { value: "boolean", label: "Yes/No" },
];

const GROUPINGS = [
  { value: "customer", label: "Customer" },
  { value: "invoice", label: "Invoice" },
  { value: "payment", label: "Payment" },
  { value: "meta", label: "Metadata" },
  { value: "custom", label: "Custom" },
];

export const EditSourceMappingsModal = ({
  open,
  onClose,
  source,
}: EditSourceMappingsModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newField, setNewField] = useState<CustomField>({
    key: "",
    label: "",
    data_type: "string",
    grouping: "custom",
    isNew: true,
  });
  const [showNewFieldForm, setShowNewFieldForm] = useState(false);

  // Fetch system field definitions
  const { data: systemFields } = useQuery({
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

  // Fetch custom fields for this source
  const { data: sourceCustomFields, isLoading: loadingCustomFields } = useQuery({
    queryKey: ["source-custom-fields", source?.id],
    queryFn: async () => {
      if (!source?.id) return [];
      const { data, error } = await supabase
        .from("data_center_custom_fields")
        .select("*")
        .eq("source_id", source.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!source?.id && open,
  });

  // Fetch existing mappings for this source
  const { data: existingMappings, isLoading: loadingMappings } = useQuery({
    queryKey: ["source-mappings", source?.id],
    queryFn: async () => {
      if (!source?.id) return [];
      const { data, error } = await supabase
        .from("data_center_source_field_mappings")
        .select("*")
        .eq("source_id", source.id)
        .order("file_column_name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!source?.id && open,
  });

  // Save custom field mutation
  const saveCustomField = useMutation({
    mutationFn: async (field: CustomField) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_center_custom_fields")
        .insert({
          user_id: user.id,
          source_id: source?.id,
          key: field.key,
          label: field.label,
          data_type: field.data_type,
          grouping: field.grouping,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-custom-fields", source?.id] });
      toast({ title: "Custom field created" });
      setShowNewFieldForm(false);
      setNewField({ key: "", label: "", data_type: "string", grouping: "custom", isNew: true });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete custom field mutation
  const deleteCustomField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase
        .from("data_center_custom_fields")
        .delete()
        .eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-custom-fields", source?.id] });
      toast({ title: "Custom field deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mapping mutation
  const updateMapping = useMutation({
    mutationFn: async ({ mappingId, fieldKey }: { mappingId: string; fieldKey: string | null }) => {
      const { error } = await supabase
        .from("data_center_source_field_mappings")
        .update({ confirmed_field_key: fieldKey })
        .eq("id", mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-mappings", source?.id] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddField = () => {
    if (!newField.label.trim()) {
      toast({ title: "Error", description: "Field label is required", variant: "destructive" });
      return;
    }
    // Generate key from label
    const key = `custom_${newField.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
    saveCustomField.mutate({ ...newField, key });
  };

  const allFields = [
    ...(systemFields || []),
    ...(sourceCustomFields || []).map(f => ({ ...f, isCustom: true })),
  ];

  const groupedFields = allFields.reduce((acc, field) => {
    const group = field.grouping || "custom";
    if (!acc[group]) acc[group] = [];
    acc[group].push(field);
    return acc;
  }, {} as Record<string, any[]>);

  const isLoading = loadingCustomFields || loadingMappings;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Mappings - {source?.source_name}</DialogTitle>
          <DialogDescription>
            Configure field mappings and create custom fields for this data source
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Custom Fields Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Custom Fields</h3>
                {!showNewFieldForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFieldForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                )}
              </div>

              {/* New Field Form */}
              {showNewFieldForm && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Field Label *</Label>
                      <Input
                        placeholder="e.g., PO Number"
                        value={newField.label}
                        onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data Type</Label>
                      <Select
                        value={newField.data_type}
                        onValueChange={(v) => setNewField({ ...newField, data_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grouping</Label>
                    <Select
                      value={newField.grouping}
                      onValueChange={(v) => setNewField({ ...newField, grouping: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUPINGS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewFieldForm(false);
                        setNewField({ key: "", label: "", data_type: "string", grouping: "custom", isNew: true });
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddField}
                      disabled={saveCustomField.isPending}
                    >
                      {saveCustomField.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Save Field
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing Custom Fields */}
              {sourceCustomFields && sourceCustomFields.length > 0 && (
                <div className="space-y-2">
                  {sourceCustomFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-sm">{field.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Key: {field.key} • Type: {field.data_type}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {field.grouping}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteCustomField.mutate(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {(!sourceCustomFields || sourceCustomFields.length === 0) && !showNewFieldForm && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom fields yet. Add fields to capture data specific to this source.
                </p>
              )}
            </div>

            {/* Existing Mappings Section */}
            {existingMappings && existingMappings.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Saved Mappings</h3>
                <div className="border rounded-lg divide-y">
                  {existingMappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center justify-between p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{mapping.file_column_name}</p>
                      </div>
                      <Select
                        value={mapping.confirmed_field_key || mapping.inferred_field_key || "unmapped"}
                        onValueChange={(v) =>
                          updateMapping.mutate({
                            mappingId: mapping.id,
                            fieldKey: v === "unmapped" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unmapped">— Skip —</SelectItem>
                          {Object.entries(groupedFields).map(([group, fields]) => (
                            <div key={group}>
                              <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                                {group}
                              </div>
                              {fields.map((field: any) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                  {field.isCustom && " ⭐"}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Fields Reference */}
            <Accordion type="single" collapsible>
              <AccordionItem value="fields">
                <AccordionTrigger className="text-sm">
                  Available Fields Reference
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {Object.entries(groupedFields).map(([group, fields]) => (
                      <div key={group}>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                          {group}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {fields.map((field: any) => (
                            <Badge
                              key={field.key}
                              variant={field.isCustom ? "default" : "outline"}
                              className="text-xs"
                            >
                              {field.label}
                              {field.required_for_recouply && " *"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
