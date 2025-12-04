import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";

interface DataCenterFileUploadStepProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  sources: any[];
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
}

export const DataCenterFileUploadStep = ({
  file,
  onFileSelect,
  sources,
  selectedSourceId,
  onSourceSelect,
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

  return (
    <div className="space-y-6">
      {/* Source Selection */}
      <div className="space-y-2">
        <Label>Data Source (optional)</Label>
        <Select
          value={selectedSourceId || "none"}
          onValueChange={(v) => onSourceSelect(v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a data source to reuse mappings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No source - create new mappings</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.source_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select a previously configured source to automatically apply saved column mappings
        </p>
      </div>

      {/* File Upload */}
      <Card
        {...getRootProps()}
        className={`cursor-pointer transition-all ${
          isDragActive ? "border-primary bg-primary/5" : "border-dashed hover:border-primary/50"
        } ${file ? "border-primary bg-primary/5" : ""}`}
      >
        <CardContent className="py-12">
          <input {...getInputProps()} />
          <div className="text-center">
            {file ? (
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
