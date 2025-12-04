import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileSpreadsheet, 
  Wand2, 
  CheckCircle, 
  Loader2,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { DataCenterFileUploadStep } from "./wizard/DataCenterFileUploadStep";
import { DataCenterMappingStep } from "./wizard/DataCenterMappingStep";
import { DataCenterPreviewStep } from "./wizard/DataCenterPreviewStep";
import { DataCenterCompleteStep } from "./wizard/DataCenterCompleteStep";

interface DataCenterUploadWizardProps {
  open: boolean;
  onClose: () => void;
  fileType: "invoice_aging" | "payments";
}

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  sampleRows: Record<string, any>[];
}

export interface ColumnMapping {
  fileColumn: string;
  fieldKey: string | null;
  confidence: number;
  isConfirmed: boolean;
}

const STEPS = [
  { id: "upload", label: "Upload File", icon: Upload },
  { id: "mapping", label: "Map Columns", icon: Wand2 },
  { id: "preview", label: "Preview", icon: FileSpreadsheet },
  { id: "complete", label: "Complete", icon: CheckCircle },
];

export const DataCenterUploadWizard = ({ open, onClose, fileType }: DataCenterUploadWizardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);

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

  const { data: sources } = useQuery({
    queryKey: ["data-center-sources"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("data_center_sources")
        .select("*")
        .eq("user_id", user.id)
        .order("source_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        toast({ title: "Error", description: "File must have headers and at least one data row", variant: "destructive" });
        return;
      }

      const headers = (jsonData[0] as any[]).map(h => String(h || "").trim()).filter(Boolean);
      const rows = jsonData.slice(1).map((row: any) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      }).filter(row => Object.values(row).some(v => v != null && v !== ""));

      const sampleRows = rows.slice(0, 5);

      setParsedData({ headers, rows, sampleRows });
      
      // Initialize mappings
      const initialMappings: ColumnMapping[] = headers.map(header => ({
        fileColumn: header,
        fieldKey: null,
        confidence: 0,
        isConfirmed: false,
      }));
      setColumnMappings(initialMappings);

    } catch (error: any) {
      toast({ title: "Error parsing file", description: error.message, variant: "destructive" });
    }
  }, [toast]);

  const runAIMapping = useMutation({
    mutationFn: async () => {
      if (!parsedData) throw new Error("No file data");

      const { data, error } = await supabase.functions.invoke("data-center-ai-mapping", {
        body: {
          headers: parsedData.headers,
          sampleRows: parsedData.sampleRows,
          fileType,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.mappings) {
        setColumnMappings(prev => prev.map(m => {
          const aiMapping = data.mappings.find((am: any) => am.fileColumn === m.fileColumn);
          if (aiMapping) {
            return {
              ...m,
              fieldKey: aiMapping.fieldKey,
              confidence: aiMapping.confidence,
            };
          }
          return m;
        }));
      }
      toast({ title: "AI mapping complete", description: "Review and confirm the suggested mappings" });
    },
    onError: (error: any) => {
      toast({ title: "AI mapping failed", description: error.message, variant: "destructive" });
    },
  });

  const processUpload = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!parsedData || !file) throw new Error("No file data");

      // Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from("data_center_uploads")
        .insert({
          user_id: user.id,
          source_id: selectedSourceId,
          file_name: file.name,
          file_type: fileType,
          status: "processing",
          row_count: parsedData.rows.length,
        })
        .select()
        .single();

      if (uploadError) throw uploadError;
      setUploadId(upload.id);

      // Save mappings if source selected
      if (selectedSourceId) {
        const mappingsToSave = columnMappings.filter(m => m.fieldKey).map(m => ({
          source_id: selectedSourceId,
          file_column_name: m.fileColumn,
          confirmed_field_key: m.fieldKey,
          confidence_score: m.confidence,
        }));

        if (mappingsToSave.length > 0) {
          await supabase.from("data_center_source_field_mappings").upsert(
            mappingsToSave,
            { onConflict: "source_id,file_column_name" }
          );
        }
      }

      // Process data via edge function
      const { data: result, error: processError } = await supabase.functions.invoke("data-center-process-upload", {
        body: {
          uploadId: upload.id,
          rows: parsedData.rows,
          mappings: columnMappings.filter(m => m.fieldKey).reduce((acc, m) => {
            acc[m.fileColumn] = m.fieldKey!;
            return acc;
          }, {} as Record<string, string>),
          fileType,
        },
      });

      if (processError) throw processError;
      return result;
    },
    onSuccess: (result) => {
      setProcessResult(result);
      queryClient.invalidateQueries({ queryKey: ["data-center-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["data-center-stats"] });
      setCurrentStep(3); // Go to complete step
    },
    onError: (error: any) => {
      toast({ title: "Processing failed", description: error.message, variant: "destructive" });
    },
  });

  const handleNext = () => {
    if (currentStep === 0 && parsedData) {
      setCurrentStep(1);
      // Trigger AI mapping when entering mapping step
      runAIMapping.mutate();
    } else if (currentStep === 1) {
      // Validate required fields
      const relevantGroupings = fileType === "invoice_aging" ? ["customer", "invoice"] : ["customer", "payment"];
      const requiredFields = fieldDefinitions?.filter(f => f.required_for_recouply && relevantGroupings.includes(f.grouping)) || [];
      const mappedKeys = columnMappings.filter(m => m.fieldKey).map(m => m.fieldKey);
      const missingRequired = requiredFields.filter(f => !mappedKeys.includes(f.key));

      if (missingRequired.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please map: ${missingRequired.map(f => f.label).join(", ")}`,
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      processUpload.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFile(null);
    setParsedData(null);
    setColumnMappings([]);
    setSelectedSourceId(null);
    setUploadId(null);
    setProcessResult(null);
    onClose();
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {fileType === "invoice_aging" ? (
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            ) : (
              <FileSpreadsheet className="h-5 w-5 text-green-500" />
            )}
            {fileType === "invoice_aging" ? "Import Invoice Aging" : "Import Payments"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 ${isActive ? "text-primary font-medium" : isComplete ? "text-primary" : ""}`}
                >
                  <Icon className="h-3 w-3" />
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === 0 && (
            <DataCenterFileUploadStep
              file={file}
              onFileSelect={handleFileSelect}
              sources={sources || []}
              selectedSourceId={selectedSourceId}
              onSourceSelect={setSelectedSourceId}
            />
          )}

          {currentStep === 1 && parsedData && (
            <DataCenterMappingStep
              parsedData={parsedData}
              columnMappings={columnMappings}
              onMappingsChange={setColumnMappings}
              fieldDefinitions={fieldDefinitions || []}
              fileType={fileType}
              isLoadingAI={runAIMapping.isPending}
              onRunAI={() => runAIMapping.mutate()}
              selectedSourceId={selectedSourceId}
            />
          )}

          {currentStep === 2 && parsedData && (
            <DataCenterPreviewStep
              parsedData={parsedData}
              columnMappings={columnMappings}
              fieldDefinitions={fieldDefinitions || []}
            />
          )}

          {currentStep === 3 && (
            <DataCenterCompleteStep
              result={processResult}
              uploadId={uploadId}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 0 || currentStep === 3 ? handleClose : handleBack}
          >
            {currentStep === 0 || currentStep === 3 ? "Cancel" : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {currentStep < 3 && (
            <Button
              onClick={handleNext}
              disabled={
                (currentStep === 0 && !parsedData) ||
                (currentStep === 2 && processUpload.isPending)
              }
            >
              {currentStep === 2 && processUpload.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : currentStep === 2 ? (
                "Process Data"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {currentStep === 3 && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
