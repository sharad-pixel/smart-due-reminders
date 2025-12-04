import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wand2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { ParsedFileData, ColumnMapping } from "../DataCenterUploadWizard";

interface DataCenterMappingStepProps {
  parsedData: ParsedFileData;
  columnMappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  fieldDefinitions: any[];
  fileType: "invoice_aging" | "payments";
  isLoadingAI: boolean;
  onRunAI: () => void;
}

export const DataCenterMappingStep = ({
  parsedData,
  columnMappings,
  onMappingsChange,
  fieldDefinitions,
  fileType,
  isLoadingAI,
  onRunAI,
}: DataCenterMappingStepProps) => {
  const relevantGroupings = fileType === "invoice_aging" 
    ? ["customer", "invoice", "meta"] 
    : ["customer", "payment", "meta"];
  
  const relevantFields = fieldDefinitions.filter(f => relevantGroupings.includes(f.grouping));
  const requiredFields = relevantFields.filter(f => f.required_for_recouply);
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
            const fieldDef = relevantFields.find(f => f.key === mapping.fieldKey);

            return (
              <div
                key={mapping.fileColumn}
                className="grid grid-cols-12 gap-4 items-center py-2 border-b last:border-0"
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
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">— Skip this column —</SelectItem>
                      {relevantFields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          <div className="flex items-center gap-2">
                            {field.label}
                            {field.required_for_recouply && (
                              <span className="text-destructive">*</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
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

      {/* Legend */}
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
    </div>
  );
};
