import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";

interface FileUploadStepProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export const FileUploadStep = ({ onFileSelect, isProcessing }: FileUploadStepProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div>
              <p className="text-lg font-medium">Processing file...</p>
              <p className="text-sm text-muted-foreground">Please wait while we parse your data</p>
            </div>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-4">
            <Upload className="h-12 w-12 text-primary" />
            <p className="text-lg font-medium">Drop your file here</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Drag & drop your file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <p className="text-xs text-muted-foreground">Supported formats: .xlsx, .xls, .csv</p>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Tips for best results:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Ensure your file has a header row with column names</li>
          <li>• Customer names should be consistent across rows</li>
          <li>• Dates should be in a standard format (MM/DD/YYYY or YYYY-MM-DD)</li>
          <li>• Amount values should be numeric (no currency symbols)</li>
        </ul>
      </div>
    </div>
  );
};
