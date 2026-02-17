import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Plus, DollarSign, AlertTriangle, Users, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface DataCenterFileUploadStepProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  sources: any[];
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
  onCreateSource?: () => void;
  fileType: "invoice_aging" | "payments" | "accounts";
  onFileTypeChange: (type: "invoice_aging" | "payments" | "accounts") => void;
  detectedType?: { detected: "invoice_aging" | "payments" | "accounts" | "unknown"; confidence: number; reasons: string[] } | null;
}

// Template columns matching Create New Account form exactly
const ACCOUNTS_TEMPLATE_COLUMNS = [
  "Company Name",
  "Type",
  "Contact Name",
  "Contact Title",
  "Contact Email",
  "Contact Phone",
  "Address Line 1",
  "Address Line 2",
  "City",
  "State",
  "Postal Code",
  "Country",
  "Account ID (Billing System)",
  "CRM ID",
  "Industry",
  "Notes",
  "Recouply Account ID (RAID)",
];

const INVOICES_TEMPLATE_COLUMNS = [
  "Recouply Account ID (RAID)",
  "Invoice Number",
  "Invoice Date",
  "Due Date",
  "Original Amount",
  "Outstanding Amount",
  "Currency",
  "Invoice Status",
  "PO Number",
  "Product/Service Description",
  "External Invoice ID",
  "Notes",
];

const PAYMENTS_TEMPLATE_COLUMNS = [
  "Recouply Invoice ID",
  "Invoice Number",
  "Payment Date",
  "Payment Amount",
  "Payment Reference",
  "Payment Method",
  "Payment Notes",
];

const downloadTemplate = (fileType: "invoice_aging" | "payments" | "accounts") => {
  const columns = fileType === "accounts" 
    ? ACCOUNTS_TEMPLATE_COLUMNS 
    : fileType === "invoice_aging" 
      ? INVOICES_TEMPLATE_COLUMNS 
      : PAYMENTS_TEMPLATE_COLUMNS;

  // Create workbook with headers only
  const ws = XLSX.utils.aoa_to_sheet([columns]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");

  // Set column widths
  ws["!cols"] = columns.map(() => ({ wch: 20 }));

  const fileName = fileType === "accounts" 
    ? "recouply_accounts_template.xlsx"
    : fileType === "invoice_aging"
      ? "recouply_invoices_template.xlsx"
      : "recouply_payments_template.xlsx";

  XLSX.writeFile(wb, fileName);
};

export const DataCenterFileUploadStep = ({
  file,
  onFileSelect,
  sources,
  selectedSourceId,
  onSourceSelect,
  onCreateSource,
  fileType,
  onFileTypeChange,
  detectedType,
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

      {/* File Type Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Data Type</Label>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => downloadTemplate(fileType)}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download Template
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={fileType === "accounts" ? "default" : "outline"}
            className="flex-1"
            onClick={() => onFileTypeChange("accounts")}
          >
            <Users className="h-4 w-4 mr-2" />
            Accounts
          </Button>
          <Button
            type="button"
            variant={fileType === "invoice_aging" ? "default" : "outline"}
            className="flex-1"
            onClick={() => onFileTypeChange("invoice_aging")}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Invoices
          </Button>
          <Button
            type="button"
            variant={fileType === "payments" ? "default" : "outline"}
            className="flex-1"
            onClick={() => onFileTypeChange("payments")}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Payments
          </Button>
        </div>
        
        {/* Data Type Documentation */}
        {fileType === "accounts" && (
          <Alert className="mt-2 bg-muted/50">
            <Users className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Accounts Upload - Required Fields:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li><strong>Company Name *</strong> - Business/company name</li>
                <li><strong>Contact Name *</strong> - Primary contact full name</li>
                <li><strong>Contact Email *</strong> - Primary contact email</li>
                <li><strong>Without RAID:</strong> Creates new account with auto-generated ID</li>
                <li><strong>With RAID:</strong> Updates existing account record</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {fileType === "invoice_aging" && (
          <Alert className="mt-2 bg-muted/50">
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Invoices Upload - Invoice Fields Only:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li><strong>RAID required *</strong> - Links invoice to an existing account (no account fields needed)</li>
                <li><strong>Invoice Number *</strong>, <strong>Invoice Date *</strong>, <strong>Due Date *</strong>, <strong>Original Amount *</strong></li>
                <li>Account details (company name, contact, etc.) are already stored via RAID</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {fileType === "payments" && (
          <Alert className="mt-2 bg-muted/50">
            <DollarSign className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Payments Upload - Payment Fields Only:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li><strong>Recouply Invoice ID *</strong> - Links payment to the correct invoice (primary match)</li>
                <li><strong>Invoice Number *</strong> - Fallback matching if Recouply Invoice ID unavailable</li>
                <li><strong>Payment Amount *</strong> and <strong>Payment Date *</strong> required</li>
                <li>Account is resolved automatically from the linked invoice</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Detection Alert */}
        {detectedType && detectedType.detected !== "unknown" && detectedType.detected !== fileType && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                File appears to be <strong>{detectedType.detected === "payments" ? "Payment" : detectedType.detected === "accounts" ? "Account" : "Invoice"}</strong> data 
                ({detectedType.confidence}% confidence based on: {detectedType.reasons.join(", ")})
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onFileTypeChange(detectedType.detected as "invoice_aging" | "payments" | "accounts")}
              >
                Switch Type
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {detectedType && detectedType.detected !== "unknown" && detectedType.detected === fileType && (
          <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
            <CheckCircle className="h-4 w-4" />
            <span>File type matches detected content ({detectedType.confidence}% confidence)</span>
          </div>
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
