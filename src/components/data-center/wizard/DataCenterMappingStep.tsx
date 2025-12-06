import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wand2, Loader2, CheckCircle, AlertCircle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ParsedFileData, ColumnMapping } from "../DataCenterUploadWizard";

// Display label overrides for cleaner UI
const FIELD_DISPLAY_LABELS: Record<string, { short: string; full: string }> = {
  payment_invoice_number: { short: "SS Invoice #", full: "Source System Invoice Number - Your accounting system's invoice identifier (fallback if Recouply ID unavailable)" },
};

interface DataCenterMappingStepProps {
  parsedData: ParsedFileData;
  columnMappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  fieldDefinitions: any[];
  fileType: "invoice_aging" | "payments";
  isLoadingAI: boolean;
  onRunAI: () => void;
  selectedSourceId?: string | null;
}

const DATA_TYPES = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Currency" },
];

export const DataCenterMappingStep = ({
  parsedData,
  columnMappings,
  onMappingsChange,
  fieldDefinitions,
  fileType,
  isLoadingAI,
  onRunAI,
  selectedSourceId,
}: DataCenterMappingStepProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("string");

  // Fetch custom fields for selected source
  const { data: customFields } = useQuery({
    queryKey: ["source-custom-fields", selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId) return [];
      const { data, error } = await supabase
        .from("data_center_custom_fields")
        .select("*")
        .eq("source_id", selectedSourceId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSourceId,
  });

  // Add custom field mutation
  const addCustomField = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!selectedSourceId) throw new Error("No source selected");

      const key = `custom_${newFieldLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
      
      const { data, error } = await supabase
        .from("data_center_custom_fields")
        .insert({
          user_id: user.id,
          source_id: selectedSourceId,
          key,
          label: newFieldLabel,
          data_type: newFieldType,
          grouping: "custom",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-custom-fields", selectedSourceId] });
      toast({ title: "Custom field created" });
      setShowAddField(false);
      setNewFieldLabel("");
      setNewFieldType("string");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const relevantGroupings = fileType === "invoice_aging" 
    ? ["customer", "invoice", "account", "meta"] 
    : ["customer", "payment", "account", "meta"];
  
  // Combine system fields with custom fields
  const allFields = [
    ...fieldDefinitions.filter(f => relevantGroupings.includes(f.grouping)),
    ...(customFields || []).map(f => ({ ...f, isCustom: true })),
  ];
  
  const requiredFields = fieldDefinitions.filter(f => f.required_for_recouply && relevantGroupings.includes(f.grouping));
  const mappedKeys = columnMappings.filter(m => m.fieldKey).map(m => m.fieldKey);
  const missingRequired = requiredFields.filter(f => !mappedKeys.includes(f.key));

  const handleMappingChange = (fileColumn: string, fieldKey: string | null) => {
    onMappingsChange(
      columnMappings.map(m =>
        m.fileColumn === fileColumn
          ? { ...m, fieldKey, isConfirmed: true }
          : m
      )
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.5) return "text-amber-600";
    return "text-muted-foreground";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.5) return "Medium";
    if (confidence > 0) return "Low";
    return "";
  };

  return (
    <div className="space-y-4">
      {/* AI Mapping Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Column Mapping</h3>
          <p className="text-sm text-muted-foreground">
            Map your file columns to Recouply.ai fields
          </p>
        </div>
        <Button variant="outline" onClick={onRunAI} disabled={isLoadingAI}>
          {isLoadingAI ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          {isLoadingAI ? "Analyzing..." : "AI Auto-Map"}
        </Button>
      </div>

      {/* Required Fields Status */}
      {missingRequired.length > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Missing required fields:</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {missingRequired.map(f => (
              <Badge key={f.key} variant="destructive" className="text-xs">
                {f.label}
              </Badge>
            ))}
          </div>
          {fileType === "payments" && missingRequired.some(f => f.key === "recouply_invoice_id") && (
            <p className="text-xs mt-2 text-destructive/80">
              💡 The Recouply Invoice ID is required for accurate payment matching. Export your invoices to get this ID.
            </p>
          )}
        </div>
      )}

      {/* Mapping Table */}
      <Card>
        <CardHeader className="py-3">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
            <div className="col-span-4">File Column</div>
            <div className="col-span-2">Sample Value</div>
            <div className="col-span-4">Recouply.ai Field</div>
            <div className="col-span-2">AI Confidence</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {columnMappings.map((mapping) => {
            const sampleValue = parsedData.sampleRows[0]?.[mapping.fileColumn];
            const fieldDef = allFields.find(f => f.key === mapping.fieldKey);
            const isMappedToRequired = fieldDef?.required_for_recouply;

            return (
              <div
                key={mapping.fileColumn}
                className={`grid grid-cols-12 gap-4 items-center py-2 border-b last:border-0 ${
                  isMappedToRequired ? "bg-primary/5 -mx-4 px-4 rounded" : ""
                }`}
              >
                <div className="col-span-4">
                  <p className="font-medium text-sm truncate">{mapping.fileColumn}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground truncate">
                    {sampleValue != null ? String(sampleValue) : "-"}
                  </p>
                </div>
                <div className="col-span-4">
                  <Select
                    value={mapping.fieldKey || "unmapped"}
                    onValueChange={(v) => handleMappingChange(mapping.fileColumn, v === "unmapped" ? null : v)}
                  >
                    <SelectTrigger className={`h-8 ${isMappedToRequired ? "border-primary" : ""}`}>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="max-w-md">
                      <SelectItem value="unmapped">— Skip this column —</SelectItem>
                      {/* Required fields first */}
                      {allFields.filter((f: any) => f.required_for_recouply).length > 0 && (
                        <div className="px-2 py-1 text-xs font-semibold text-destructive bg-destructive/10">
                          Required Fields
                        </div>
                      )}
                      {allFields.filter((f: any) => f.required_for_recouply).map((field: any) => {
                        const displayOverride = FIELD_DISPLAY_LABELS[field.key];
                        const displayLabel = displayOverride?.short || field.label;
                        const fullDescription = displayOverride?.full || field.description;
                        
                        return (
                          <SelectItem key={field.key} value={field.key} className="py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-destructive font-medium">*</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={displayOverride ? "border-b border-dotted border-muted-foreground cursor-help" : ""}>
                                        {displayLabel}
                                      </span>
                                    </TooltipTrigger>
                                    {displayOverride && (
                                      <TooltipContent side="right" className="max-w-xs">
                                        <p className="font-medium">{displayOverride.full.split(' - ')[0]}</p>
                                        {displayOverride.full.includes(' - ') && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {displayOverride.full.split(' - ')[1]}
                                          </p>
                                        )}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                {field.key === "recouply_invoice_id" && (
                                  <Badge variant="default" className="text-[10px] px-1">Primary</Badge>
                                )}
                              </div>
                              {fullDescription && !displayOverride && (
                                <span className="text-[10px] text-muted-foreground leading-tight max-w-[280px]">
                                  {fullDescription}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                      {/* Optional fields */}
                      {allFields.filter((f: any) => !f.required_for_recouply).length > 0 && (
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1">
                          Optional Fields
                        </div>
                      )}
                      {allFields.filter((f: any) => !f.required_for_recouply).map((field: any) => {
                        const displayOverride = FIELD_DISPLAY_LABELS[field.key];
                        const displayLabel = displayOverride?.short || field.label;
                        const fullDescription = displayOverride?.full || field.description;
                        
                        return (
                          <SelectItem key={field.key} value={field.key} className="py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={displayOverride ? "border-b border-dotted border-muted-foreground cursor-help" : ""}>
                                        {displayLabel}
                                      </span>
                                    </TooltipTrigger>
                                    {displayOverride && (
                                      <TooltipContent side="right" className="max-w-xs">
                                        <p className="font-medium">{displayOverride.full.split(' - ')[0]}</p>
                                        {displayOverride.full.includes(' - ') && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {displayOverride.full.split(' - ')[1]}
                                          </p>
                                        )}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                {field.isCustom && <Badge variant="secondary" className="text-[10px] px-1">Custom</Badge>}
                              </div>
                              {fullDescription && !displayOverride && (
                                <span className="text-[10px] text-muted-foreground leading-tight max-w-[280px]">
                                  {fullDescription}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  {mapping.confidence > 0 && (
                    <>
                      <span className={`text-xs ${getConfidenceColor(mapping.confidence)}`}>
                        {getConfidenceLabel(mapping.confidence)}
                      </span>
                      {mapping.confidence >= 0.8 && (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Legend and Add Custom Field */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="text-destructive">* Required field</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-600" />
            High confidence
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            Medium confidence
          </span>
        </div>
        {selectedSourceId && (
          <Button variant="outline" size="sm" onClick={() => setShowAddField(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Custom Field
          </Button>
        )}
      </div>

      {/* Add Custom Field Dialog */}
      <Dialog open={showAddField} onOpenChange={setShowAddField}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Create a custom field to map columns specific to this data source
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Label *</Label>
              <Input
                placeholder="e.g., PO Number, Project Code"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddField(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addCustomField.mutate()}
              disabled={!newFieldLabel.trim() || addCustomField.isPending}
            >
              {addCustomField.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
