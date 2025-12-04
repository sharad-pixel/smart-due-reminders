import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Plus } from "lucide-react";

interface DataCenterFileUploadStepProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  sources: any[];
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
  onCreateSource?: () => void;
}

export const DataCenterFileUploadStep = ({
  file,
  onFileSelect,
  sources,
  selectedSourceId,
  onSourceSelect,
  onCreateSource,
}: DataCenterFileUploadStepProps) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const hasNoSources = sources.length === 0;

  return (
    <div className="space-y-6">
      {/* Source Selection - REQUIRED */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Data Source <span className="text-destructive">*</span>
        </Label>
        
        {hasNoSources ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>You need to create a data source before uploading files.</span>
              {onCreateSource && (
                <Button size="sm" variant="outline" onClick={onCreateSource}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Source
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Select
              value={selectedSourceId || ""}
              onValueChange={(v) => onSourceSelect(v || null)}
            >
              <SelectTrigger className={!selectedSourceId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a data source (required)" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.source_name} ({source.system_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the data source this file comes from. Column mappings will be saved for reuse.
            </p>
          </>
        )}
      </div>

      {/* File Upload - only enabled when source is selected */}
      <Card
        {...getRootProps()}
        className={`cursor-pointer transition-all ${
          !selectedSourceId ? "opacity-50 pointer-events-none" : ""
        } ${
          isDragActive ? "border-primary bg-primary/5" : "border-dashed hover:border-primary/50"
        } ${file ? "border-primary bg-primary/5" : ""}`}
      >
        <CardContent className="py-12">
          <input {...getInputProps()} disabled={!selectedSourceId} />
          <div className="text-center">
            {!selectedSourceId ? (
              <>
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">
                  Select a data source first
                </p>
                <p className="text-sm text-muted-foreground">
                  You must select a source before uploading
                </p>
              </>
            ) : file ? (
              <>
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Drop a new file or click to replace
                </p>
              </>
            ) : (
              <>
                {isDragActive ? (
                  <Upload className="h-12 w-12 mx-auto mb-4 text-primary animate-bounce" />
                ) : (
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                )}
                <p className="font-medium">
                  {isDragActive ? "Drop file here" : "Drag and drop your file"}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: CSV, XLSX, XLS
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
