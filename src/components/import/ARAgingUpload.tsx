import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ARAgingUploadProps {
  onFileUploaded: (file: File, data: any[]) => void;
}

export const ARAgingUpload = ({ onFileUploaded }: ARAgingUploadProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let parsedData: any[] = [];

          if (file.name.endsWith(".csv")) {
            // Parse CSV
            const text = data as string;
            const lines = text.split("\n").filter((line) => line.trim());
            const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
            
            parsedData = lines.slice(1).map((line) => {
              const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || "";
              });
              return row;
            });
          } else {
            // Parse Excel
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            parsedData = XLSX.utils.sheet_to_json(worksheet);
          }

          if (parsedData.length === 0) {
            throw new Error("No data found in file");
          }

          if (parsedData.length > 10000) {
            throw new Error("File contains more than 10,000 rows. Please split into smaller files.");
          }

          toast.success(`Parsed ${parsedData.length} rows successfully`);
          onFileUploaded(file, parsedData);
        } catch (err) {
          console.error("Parse error:", err);
          setError(err instanceof Error ? err.message : "Failed to parse file");
          toast.error("Failed to parse file");
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setIsProcessing(false);
        toast.error("Failed to read file");
      };

      if (file.name.endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (err) {
      console.error("File processing error:", err);
      setError(err instanceof Error ? err.message : "Failed to process file");
      setIsProcessing(false);
      toast.error("Failed to process file");
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      setError("Please upload a CSV or Excel file");
      return;
    }

    const file = acceptedFiles[0];
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const isValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      setError("Invalid file type. Please upload a CSV or Excel file.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File size exceeds 50MB limit");
      return;
    }

    processFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              <p className="text-lg font-medium">Processing file...</p>
              <p className="text-sm text-muted-foreground">Please wait while we parse your data</p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? "Drop your file here" : "Drag & drop your AR aging report"}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse for CSV or Excel files
                </p>
              </div>
              <Button type="button" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-sm">File Requirements:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Maximum file size: 50MB</li>
          <li>Maximum rows: 10,000</li>
          <li>Required columns: Company Name, Invoice Number, Invoice Date, Amount</li>
          <li>Recommended: Contact Email, Contact Phone, Due Date, Outstanding Balance</li>
        </ul>
      </div>
    </div>
  );
};
