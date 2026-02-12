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
  ArrowLeft,
  AlertTriangle,
  Users,
  DollarSign
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
  fileType: "invoice_aging" | "payments" | "accounts";
}

// Keywords that indicate payment data
const PAYMENT_KEYWORDS = [
  "payment_date", "payment date", "paymentdate", "pay_date", "paid_date", "paid date",
  "payment_amount", "payment amount", "paymentamount", "pay_amount", "amount_paid", "amount paid",
  "payment_method", "payment method", "pay_method", "method",
  "check_number", "check number", "checknumber", "check_no", "check no", "check #",
  "transaction_id", "transaction id", "transactionid", "trans_id", "reference_number",
  "applied_amount", "applied amount", "amount_applied", "applied_to",
  "receipt", "deposit", "remittance"
];

// Keywords that indicate invoice data
const INVOICE_KEYWORDS = [
  "invoice_number", "invoice number", "invoicenumber", "inv_number", "inv number", "inv#", "invoice#", "invoice_no",
  "invoice_date", "invoice date", "invoicedate", "inv_date", "bill_date", "bill date",
  "due_date", "due date", "duedate", "payment_due", "due",
  "invoice_amount", "invoice amount", "total_amount", "amount_due", "amount due", "balance_due", "balance due",
  "aging_bucket", "aging bucket", "agingbucket", "aging", "days_past_due", "days past due",
  "outstanding", "open_balance", "open balance", "balance", "original_amount"
];

// Keywords that indicate account/customer data
const ACCOUNT_KEYWORDS = [
  "customer_name", "customer name", "customername", "company_name", "company name", "companyname",
  "account_name", "account name", "accountname", "client_name", "client name",
  "contact_name", "contact name", "contactname", "primary_contact",
  "customer_email", "customer email", "contact_email", "email_address", "email address",
  "customer_phone", "customer phone", "phone_number", "phone number",
  "billing_address", "billing address", "address_line", "address line",
  "industry", "account_type", "customer_type", "credit_limit"
];

const detectFileType = (headers: string[]): { detected: "invoice_aging" | "payments" | "accounts" | "unknown"; confidence: number; reasons: string[] } => {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  let paymentScore = 0;
  let invoiceScore = 0;
  let accountScore = 0;
  const paymentReasons: string[] = [];
  const invoiceReasons: string[] = [];
  const accountReasons: string[] = [];

  normalizedHeaders.forEach(header => {
    // Check payment keywords
    const paymentMatch = PAYMENT_KEYWORDS.some(kw => header.includes(kw.toLowerCase()));
    if (paymentMatch) {
      paymentScore += 2;
      paymentReasons.push(header);
    }

    // Check invoice keywords
    const invoiceMatch = INVOICE_KEYWORDS.some(kw => header.includes(kw.toLowerCase()));
    if (invoiceMatch) {
      invoiceScore += 2;
      invoiceReasons.push(header);
    }

    // Check account keywords
    const accountMatch = ACCOUNT_KEYWORDS.some(kw => header.includes(kw.toLowerCase()));
    if (accountMatch) {
      accountScore += 2;
      accountReasons.push(header);
    }
  });

  // Specific high-confidence indicators
  if (normalizedHeaders.some(h => h.includes("payment_date") || h.includes("payment date") || h === "paid_date")) {
    paymentScore += 5;
  }
  if (normalizedHeaders.some(h => h.includes("check") || h.includes("remittance"))) {
    paymentScore += 3;
  }
  if (normalizedHeaders.some(h => h.includes("invoice_number") || h.includes("invoice number") || h.includes("inv#"))) {
    invoiceScore += 3;
  }
  if (normalizedHeaders.some(h => h.includes("due_date") || h.includes("due date") || h.includes("aging"))) {
    invoiceScore += 4;
  }
  if (normalizedHeaders.some(h => h.includes("customer_name") || h.includes("company_name") || h.includes("account_name"))) {
    accountScore += 4;
  }
  if (normalizedHeaders.some(h => h.includes("industry") || h.includes("credit_limit"))) {
    accountScore += 3;
  }

  const totalScore = paymentScore + invoiceScore + accountScore;
  if (totalScore === 0) {
    return { detected: "unknown", confidence: 0, reasons: [] };
  }

  // Find the highest scoring type
  const maxScore = Math.max(paymentScore, invoiceScore, accountScore);
  
  if (maxScore === paymentScore && paymentScore > invoiceScore && paymentScore > accountScore) {
    const confidence = Math.min(100, Math.round((paymentScore / totalScore) * 100));
    return { detected: "payments", confidence, reasons: paymentReasons.slice(0, 3) };
  } else if (maxScore === invoiceScore && invoiceScore > accountScore) {
    const confidence = Math.min(100, Math.round((invoiceScore / totalScore) * 100));
    return { detected: "invoice_aging", confidence, reasons: invoiceReasons.slice(0, 3) };
  } else if (maxScore === accountScore) {
    const confidence = Math.min(100, Math.round((accountScore / totalScore) * 100));
    return { detected: "accounts", confidence, reasons: accountReasons.slice(0, 3) };
  }

  return { detected: "unknown", confidence: 50, reasons: [] };
};

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

export const DataCenterUploadWizard = ({ open, onClose, fileType: initialFileType }: DataCenterUploadWizardProps) => {
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
  const [fileType, setFileType] = useState<"invoice_aging" | "payments" | "accounts">(initialFileType);
  const [detectedType, setDetectedType] = useState<{ detected: "invoice_aging" | "payments" | "accounts" | "unknown"; confidence: number; reasons: string[] } | null>(null);

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
      
      // Use defval to ensure empty cells are included, and raw:false for value parsing
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: "",  // Include empty cells
        blankrows: false  // Skip completely blank rows
      });

      if (jsonData.length < 2) {
        toast({ title: "Error", description: "File must have headers and at least one data row", variant: "destructive" });
        return;
      }

      const headers = (jsonData[0] as any[]).map(h => String(h || "").trim()).filter(Boolean);
      const rows = jsonData.slice(1).map((row: any) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, i) => {
          // Ensure we get the value at the correct index, defaulting to empty string
          const value = row[i] !== undefined ? row[i] : "";
          obj[header] = value;
        });
        return obj;
      }).filter(row => Object.values(row).some(v => v != null && v !== ""));

      const sampleRows = rows.slice(0, 5);

      setParsedData({ headers, rows, sampleRows });
      
      // Detect file type from headers
      const detection = detectFileType(headers);
      setDetectedType(detection);
      
      // If detected type differs from selected type with high confidence, auto-switch and notify
      if (detection.detected !== "unknown" && detection.detected !== fileType && detection.confidence >= 70) {
        setFileType(detection.detected);
        toast({
          title: `File detected as ${detection.detected === "payments" ? "Payments" : "Invoice Aging"}`,
          description: `Switched to ${detection.detected === "payments" ? "payment" : "invoice"} mapping based on columns: ${detection.reasons.join(", ")}`,
        });
      } else if (detection.detected !== "unknown" && detection.detected !== fileType) {
        toast({
          title: "File type may not match",
          description: `This file looks like ${detection.detected === "payments" ? "payment" : "invoice"} data (${detection.confidence}% confidence). You can change the type below if needed.`,
          variant: "destructive",
        });
      }
      
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

  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingBatch, setProcessingBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

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

      // Process data in client-side batches - larger batches = fewer round trips = faster uploads
      const BATCH_SIZE = 100; // Optimized batch size for faster processing
      const rows = parsedData.rows;
      const batches = Math.ceil(rows.length / BATCH_SIZE);
      setTotalBatches(batches);
      
      const mappings = columnMappings.filter(m => m.fieldKey).reduce((acc, m) => {
        acc[m.fileColumn] = m.fieldKey!;
        return acc;
      }, {} as Record<string, string>);

      let aggregatedResult = {
        totalRows: rows.length,
        processed: 0,
        matched: 0,
        needsReview: 0,
        errors: 0,
        newCustomers: 0,
        existingCustomers: 0,
        newRecords: 0,
        fileType,
        invoicesPaid: 0,
        invoicesPartiallyPaid: 0,
        draftsGenerated: 0,
      };

      for (let i = 0; i < batches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(start, end);
        
        setProcessingBatch(i + 1);
        setProcessingProgress(Math.round(((i + 1) / batches) * 100));

        const { data: result, error: processError } = await supabase.functions.invoke("data-center-process-upload", {
          body: {
            uploadId: upload.id,
            rows: batchRows,
            mappings,
            fileType,
            batchIndex: i,
            totalBatches: batches,
            isLastBatch: i === batches - 1,
          },
        });

        if (processError) throw processError;
        
        // Aggregate results from each batch
        if (result) {
          aggregatedResult.processed += result.processed || 0;
          aggregatedResult.matched += result.matched || 0;
          aggregatedResult.needsReview += result.needsReview || 0;
          aggregatedResult.errors += result.errors || 0;
          aggregatedResult.newCustomers += result.newCustomers || 0;
          aggregatedResult.existingCustomers += result.existingCustomers || 0;
          aggregatedResult.newRecords += result.newRecords || 0;
          aggregatedResult.invoicesPaid += result.invoicesPaid || 0;
          aggregatedResult.invoicesPartiallyPaid += result.invoicesPartiallyPaid || 0;
          aggregatedResult.draftsGenerated += result.draftsGenerated || 0;
        }
      }

      return aggregatedResult;
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
    if (currentStep === 0) {
      if (!selectedSourceId) {
        toast({ title: "Source required", description: "Please select a data source before proceeding", variant: "destructive" });
        return;
      }
      if (!parsedData) {
        toast({ title: "File required", description: "Please upload a file to continue", variant: "destructive" });
        return;
      }
      setCurrentStep(1);
      // Trigger AI mapping when entering mapping step
      runAIMapping.mutate();
    } else if (currentStep === 1) {
      // Validate required fields based on file type
      // For accounts: customer_name, customer_email (RAID is auto-generated)
      // For invoices: recouply_account_id, invoice_number, amount_original, invoice_date, due_date
      // For payments: recouply_invoice_id, payment_invoice_number, payment_amount, payment_date
      
      let requiredKeys: string[] = [];
      
      if (fileType === "accounts") {
        // Accounts: company name, contact name, and email required, RAID is auto-generated
        requiredKeys = ["company_name", "contact_name", "contact_email"];
      } else if (fileType === "invoice_aging") {
        // Invoices: need RAID to link to account, plus invoice details
        requiredKeys = ["recouply_account_id", "invoice_number", "amount_original", "invoice_date", "due_date"];
      } else if (fileType === "payments") {
        // Payments: need invoice identifier + amount + date. Account matching uses multi-tier fallback.
        requiredKeys = ["payment_amount", "payment_date"];
      }
      
      const mappedKeys = columnMappings.filter(m => m.fieldKey).map(m => m.fieldKey);
      const missingRequiredKeys = requiredKeys.filter(key => !mappedKeys.includes(key));
      
      if (missingRequiredKeys.length > 0) {
        // Get labels for the missing fields
        const missingLabels = missingRequiredKeys.map(key => {
          const field = fieldDefinitions?.find(f => f.key === key);
          return field?.label || key;
        });
        
        toast({
          title: "Missing required fields",
          description: `Please map: ${missingLabels.join(", ")}`,
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
    setDetectedType(null);
    setFileType(initialFileType);
    setProcessingProgress(0);
    setProcessingBatch(0);
    setTotalBatches(0);
    onClose();
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {fileType === "accounts" ? (
              <Users className="h-5 w-5 text-blue-500" />
            ) : fileType === "invoice_aging" ? (
              <FileSpreadsheet className="h-5 w-5 text-amber-500" />
            ) : (
              <DollarSign className="h-5 w-5 text-green-500" />
            )}
            {fileType === "accounts" ? "Import Accounts" : fileType === "invoice_aging" ? "Import Invoices" : "Import Payments"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {fileType === "invoice_aging" 
              ? "Invoices count toward your monthly allotment. Max 10,000 rows per upload. Overages billed at $1.99/invoice."
              : fileType === "payments"
              ? "Payments are matched to invoices using Recouply Invoice ID. Max 10,000 rows per upload."
              : "Accounts are matched using Recouply Account ID. Max 10,000 rows per upload."}
          </p>
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
              onCreateSource={onClose}
              fileType={fileType}
              onFileTypeChange={setFileType}
              detectedType={detectedType}
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
            processUpload.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <h3 className="text-lg font-medium">Processing Data...</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Batch {processingBatch} of {totalBatches}
                  </p>
                  <div className="w-64 mt-4">
                    <Progress value={processingProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{processingProgress}% complete</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Please wait while we process your {parsedData.rows.length} rows...
                  </p>
                </div>
              </div>
            ) : (
              <DataCenterPreviewStep
                parsedData={parsedData}
                columnMappings={columnMappings}
                fieldDefinitions={fieldDefinitions || []}
              />
            )
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
                (currentStep === 0 && (!parsedData || !selectedSourceId)) ||
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
