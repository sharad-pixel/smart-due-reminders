import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { FileUploadStep } from "./steps/FileUploadStep";
import { ColumnMappingStep } from "./steps/ColumnMappingStep";
import { PreviewStep } from "./steps/PreviewStep";
import { ImportResultStep } from "./steps/ImportResultStep";

type UploadType = "invoice_detail" | "payments";

interface ARUploadWizardProps {
  open: boolean;
  onClose: () => void;
  uploadType: UploadType;
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
}

export interface ColumnMapping {
  [targetField: string]: string | null;
}

export interface ValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  newCustomers: string[];
  existingCustomers: string[];
  duplicates: Array<{
    rowIndex: number;
    reason: string;
    existingId?: string;
  }>;
  errors: Array<{
    rowIndex: number;
    errors: string[];
  }>;
}

const STEPS = ["Upload File", "Map Columns", "Preview & Validate", "Complete"];

const getRequiredFields = (uploadType: UploadType): string[] => {
  switch (uploadType) {
    case "invoice_detail":
      return ["customer_name", "invoice_number", "invoice_date", "due_date", "amount"];
    case "payments":
      return ["customer_name", "payment_date", "amount"];
  }
};

const getOptionalFields = (uploadType: UploadType): string[] => {
  switch (uploadType) {
    case "invoice_detail":
      return [
        "currency", 
        "status", 
        "notes", 
        "product_description", 
        "contact_email", 
        "contact_name",
        "external_invoice_id",
        "po_number",
        "payment_terms"
      ];
    case "payments":
      return ["currency", "reference", "invoice_number", "notes"];
  }
};

export const ARUploadWizard = ({ open, onClose, uploadType }: ARUploadWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [batchId, setBatchId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const requiredFields = getRequiredFields(uploadType);
  const optionalFields = getOptionalFields(uploadType);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        throw new Error("File must contain at least a header row and one data row");
      }

      const headers = jsonData[0].map((h: any) => String(h || "").trim());
      const rows = jsonData.slice(1).map((row) => {
        const rowObj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx];
        });
        return rowObj;
      }).filter(row => Object.values(row).some(v => v !== undefined && v !== null && v !== ""));

      setParsedData({ headers, rows });

      // Auto-map columns based on header names
      const autoMapping: ColumnMapping = {};
      const allFields = [...requiredFields, ...optionalFields];
      
      allFields.forEach((field) => {
        const matchingHeader = headers.find((h) => {
          const normalizedHeader = h.toLowerCase().replace(/[_\s-]/g, "");
          const normalizedField = field.toLowerCase().replace(/[_\s-]/g, "");
          return normalizedHeader.includes(normalizedField) || normalizedField.includes(normalizedHeader);
        });
        if (matchingHeader) {
          autoMapping[field] = matchingHeader;
        }
      });

      setColumnMapping(autoMapping);

      // Create upload batch
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: batch, error: batchError } = await supabase
        .from("upload_batches")
        .insert({
          user_id: user.id,
          upload_type: uploadType,
          file_name: selectedFile.name,
          processed_status: "preview",
          row_count: rows.length,
        })
        .select()
        .single();

      if (batchError) throw batchError;
      setBatchId(batch.id);

      setCurrentStep(1);
    } catch (error: any) {
      toast({
        title: "Error parsing file",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [uploadType, requiredFields, optionalFields, toast]);

  const handleMappingComplete = useCallback(async (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setIsProcessing(true);

    try {
      // Validate that all required fields are mapped
      const unmappedRequired = requiredFields.filter((f) => !mapping[f]);
      if (unmappedRequired.length > 0) {
        throw new Error(`Missing required mappings: ${unmappedRequired.join(", ")}`);
      }

      if (!parsedData || !batchId) throw new Error("No data to validate");

      // Update batch with mapping
      await supabase
        .from("upload_batches")
        .update({ column_mapping: mapping })
        .eq("id", batchId);

      // Validate data and check for duplicates
      const result = await validateData(parsedData.rows, mapping, uploadType);
      setValidationResult(result);

      setCurrentStep(2);
    } catch (error: any) {
      toast({
        title: "Validation error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, batchId, requiredFields, uploadType, toast]);

  const validateData = async (
    rows: Record<string, any>[],
    mapping: ColumnMapping,
    type: UploadType
  ): Promise<ValidationResult> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch existing customers for duplicate detection
    const { data: existingDebtors } = await supabase
      .from("debtors")
      .select("id, company_name, name")
      .eq("user_id", user.id);

    const debtorMap = new Map(
      (existingDebtors || []).map((d) => [
        normalizeString(d.company_name || d.name),
        d.id,
      ])
    );

    // Fetch existing invoices for duplicate detection by invoice_number AND external_invoice_id
    let invoiceMap = new Map<string, string>();
    let externalIdSet = new Set<string>();
    if (type === "invoice_detail") {
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, debtor_id, external_invoice_id")
        .eq("user_id", user.id);

      (existingInvoices || []).forEach((inv) => {
        invoiceMap.set(`${inv.debtor_id}-${inv.invoice_number}`, inv.id);
        if (inv.external_invoice_id) {
          externalIdSet.add(inv.external_invoice_id);
        }
      });
    }

    const result: ValidationResult = {
      totalRows: rows.length,
      validRows: 0,
      errorRows: 0,
      duplicateRows: 0,
      newCustomers: [],
      existingCustomers: [],
      duplicates: [],
      errors: [],
    };

    const seenCustomers = new Set<string>();
    const seenInvoices = new Set<string>();
    const seenPayments = new Set<string>();

    rows.forEach((row, idx) => {
      const rowErrors: string[] = [];
      const customerName = String(row[mapping.customer_name!] || "").trim();
      const normalizedName = normalizeString(customerName);

      // Check required fields
      requiredFields.forEach((field) => {
        const value = row[mapping[field]!];
        if (value === undefined || value === null || value === "") {
          rowErrors.push(`Missing ${field}`);
        }
      });

      // Track customers
      if (customerName) {
        if (debtorMap.has(normalizedName)) {
          if (!result.existingCustomers.includes(customerName)) {
            result.existingCustomers.push(customerName);
          }
        } else if (!seenCustomers.has(normalizedName)) {
          result.newCustomers.push(customerName);
          seenCustomers.add(normalizedName);
        }
      }

      // Check for duplicates based on type
      if (type === "invoice_detail" && mapping.invoice_number) {
        const invoiceNum = String(row[mapping.invoice_number] || "");
        const key = `${normalizedName}-${invoiceNum}`;
        
        if (seenInvoices.has(key)) {
          result.duplicates.push({
            rowIndex: idx,
            reason: "Duplicate invoice in upload",
          });
          result.duplicateRows++;
        } else if (invoiceMap.has(key)) {
          result.duplicates.push({
            rowIndex: idx,
            reason: "Invoice already exists",
            existingId: invoiceMap.get(key),
          });
          result.duplicateRows++;
        }
        seenInvoices.add(key);
      }

      if (type === "payments" && mapping.payment_date && mapping.amount) {
        const paymentDate = row[mapping.payment_date];
        const amount = row[mapping.amount];
        const reference = mapping.reference ? row[mapping.reference] : "";
        const key = `${normalizedName}-${paymentDate}-${amount}-${reference}`;

        if (seenPayments.has(key)) {
          result.duplicates.push({
            rowIndex: idx,
            reason: "Duplicate payment in upload",
          });
          result.duplicateRows++;
        }
        seenPayments.add(key);
      }

      if (rowErrors.length > 0) {
        result.errors.push({ rowIndex: idx, errors: rowErrors });
        result.errorRows++;
      } else if (!result.duplicates.some((d) => d.rowIndex === idx)) {
        result.validRows++;
      }
    });

    return result;
  };

  const handleImport = useCallback(async () => {
    if (!parsedData || !batchId || !validationResult) return;

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let successCount = 0;
      let errorCount = 0;

      // Create/update customers first
      const customerIdMap = new Map<string, string>();
      const { data: existingDebtors } = await supabase
        .from("debtors")
        .select("id, company_name, name")
        .eq("user_id", user.id);

      (existingDebtors || []).forEach((d) => {
        customerIdMap.set(normalizeString(d.company_name || d.name), d.id);
      });

      // Create new customers with optional contact details
      for (const customerName of validationResult.newCustomers) {
        // Find the first row with this customer to get contact details
        const customerRow = parsedData.rows.find(row => {
          const name = String(row[columnMapping.customer_name!] || "").trim();
          return normalizeString(name) === normalizeString(customerName);
        });

        const debtorData: Record<string, any> = {
          user_id: user.id,
          company_name: customerName,
          name: customerName,
          email: "",
          reference_id: `RCPLY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        };

        // Get contact details if available from mapped columns
        let contactName = customerName;
        let contactEmail = "";
        let contactPhone = "";
        
        if (customerRow && columnMapping.contact_email && customerRow[columnMapping.contact_email]) {
          contactEmail = String(customerRow[columnMapping.contact_email]);
          debtorData.email = contactEmail;
        }
        if (customerRow && columnMapping.contact_name && customerRow[columnMapping.contact_name]) {
          contactName = String(customerRow[columnMapping.contact_name]);
        }

        const { data: newDebtor, error } = await supabase
          .from("debtors")
          .insert(debtorData as any)
          .select()
          .single();

        if (!error && newDebtor) {
          customerIdMap.set(normalizeString(customerName), newDebtor.id);
          
          // Create contact entry in debtor_contacts
          if (contactEmail) {
            await supabase
              .from("debtor_contacts")
              .insert({
                debtor_id: newDebtor.id,
                user_id: user.id,
                name: contactName,
                email: contactEmail,
                phone: contactPhone || null,
                is_primary: true,
                outreach_enabled: true
              });
          }
        }
      }

      // Process rows based on upload type
      const duplicateRows = new Set(validationResult.duplicates.map((d) => d.rowIndex));
      const errorRows = new Set(validationResult.errors.map((e) => e.rowIndex));

      for (let i = 0; i < parsedData.rows.length; i++) {
        if (duplicateRows.has(i) || errorRows.has(i)) continue;

        const row = parsedData.rows[i];
        const customerName = String(row[columnMapping.customer_name!] || "").trim();
        const debtorId = customerIdMap.get(normalizeString(customerName));

        if (!debtorId) {
          errorCount++;
          continue;
        }

        try {
          if (uploadType === "invoice_detail") {
            await importInvoice(row, columnMapping, debtorId, user.id, batchId);
            successCount++;
          } else if (uploadType === "payments") {
            await importPayment(row, columnMapping, debtorId, user.id, batchId);
            successCount++;
          }
        } catch (error) {
          console.error("Error importing row:", error);
          errorCount++;
        }
      }

      // Update batch status
      await supabase
        .from("upload_batches")
        .update({
          processed_status: "processed",
          processed_count: successCount,
          error_count: errorCount,
          processed_at: new Date().toISOString(),
        })
        .eq("id", batchId);

      setImportResult({ success: successCount, errors: errorCount });

      // Trigger payment matching if payments were imported
      if (uploadType === "payments" && successCount > 0) {
        await supabase.functions.invoke("match-payments", {
          body: { batch_id: batchId },
        });
      }

      setCurrentStep(3);

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} records.`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, batchId, validationResult, columnMapping, uploadType, toast]);

  const handleClose = () => {
    setCurrentStep(0);
    setFile(null);
    setParsedData(null);
    setColumnMapping({});
    setBatchId(null);
    setValidationResult(null);
    setImportResult(null);
    onClose();
  };

  const getTitle = () => {
    switch (uploadType) {
      case "invoice_detail":
        return "Import Invoice Aging";
      case "payments":
        return "Import Payments";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              {STEPS.map((step, idx) => (
                <span
                  key={step}
                  className={idx <= currentStep ? "text-primary font-medium" : "text-muted-foreground"}
                >
                  {step}
                </span>
              ))}
            </div>
            <Progress value={(currentStep / (STEPS.length - 1)) * 100} />
          </div>

          {/* Step content */}
          {currentStep === 0 && (
            <FileUploadStep onFileSelect={handleFileSelect} isProcessing={isProcessing} />
          )}

          {currentStep === 1 && parsedData && (
            <ColumnMappingStep
              headers={parsedData.headers}
              requiredFields={requiredFields}
              optionalFields={optionalFields}
              initialMapping={columnMapping}
              onComplete={handleMappingComplete}
              onBack={() => setCurrentStep(0)}
              isProcessing={isProcessing}
            />
          )}

          {currentStep === 2 && validationResult && parsedData && (
            <PreviewStep
              validationResult={validationResult}
              rows={parsedData.rows}
              mapping={columnMapping}
              onImport={handleImport}
              onBack={() => setCurrentStep(1)}
              isProcessing={isProcessing}
            />
          )}

          {currentStep === 3 && importResult && (
            <ImportResultStep
              result={importResult}
              uploadType={uploadType}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper functions
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

async function importInvoice(
  row: Record<string, any>,
  mapping: ColumnMapping,
  debtorId: string,
  userId: string,
  batchId: string
) {
  const amount = parseFloat(row[mapping.amount!]) || 0;
  const invoiceDate = parseDate(row[mapping.invoice_date!]);
  const dueDate = parseDate(row[mapping.due_date!]);
  const status = mapping.status ? mapStatus(row[mapping.status]) : "Open";

  // Build invoice object with all available fields
  const invoiceData: Record<string, any> = {
    user_id: userId,
    debtor_id: debtorId,
    invoice_number: String(row[mapping.invoice_number!] || ""),
    invoice_date: invoiceDate,
    due_date: dueDate,
    amount: amount,
    amount_original: amount,
    amount_outstanding: status === "Paid" ? 0 : amount,
    currency: mapping.currency ? String(row[mapping.currency] || "USD") : "USD",
    status: status,
    upload_batch_id: batchId,
    reference_id: `INV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  };

  // Add optional fields if mapped
  if (mapping.notes && row[mapping.notes]) {
    invoiceData.notes = String(row[mapping.notes]);
  }
  if (mapping.product_description && row[mapping.product_description]) {
    invoiceData.product_description = String(row[mapping.product_description]);
  }
  if (mapping.external_invoice_id && row[mapping.external_invoice_id]) {
    invoiceData.external_invoice_id = String(row[mapping.external_invoice_id]);
  }
  if (mapping.po_number && row[mapping.po_number]) {
    invoiceData.po_number = String(row[mapping.po_number]);
  }
  if (mapping.payment_terms && row[mapping.payment_terms]) {
    invoiceData.payment_terms = String(row[mapping.payment_terms]);
  }

  const { error } = await supabase.from("invoices").insert(invoiceData as any);

  if (error) throw error;
}

async function importPayment(
  row: Record<string, any>,
  mapping: ColumnMapping,
  debtorId: string,
  userId: string,
  batchId: string
) {
  const { error } = await supabase.from("payments").insert({
    user_id: userId,
    debtor_id: debtorId,
    payment_date: parseDate(row[mapping.payment_date!]),
    amount: parseFloat(row[mapping.amount!]) || 0,
    currency: mapping.currency ? String(row[mapping.currency] || "USD") : "USD",
    reference: mapping.reference ? String(row[mapping.reference] || "") : null,
    invoice_number_hint: mapping.invoice_number ? String(row[mapping.invoice_number] || "") : null,
    notes: mapping.notes ? String(row[mapping.notes] || "") : null,
    upload_batch_id: batchId,
    reconciliation_status: "pending",
  });

  if (error) throw error;
}

function parseDate(value: any): string {
  if (!value) return new Date().toISOString().split("T")[0];
  
  if (typeof value === "number") {
    // Excel serial date
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
}

function mapStatus(status: any): string {
  const statusStr = String(status || "").toLowerCase();
  if (statusStr.includes("partial")) return "PartiallyPaid";
  if (statusStr.includes("paid")) return "Paid";
  if (statusStr.includes("disputed")) return "Disputed";
  if (statusStr.includes("written") || statusStr.includes("cancel")) return "Canceled";
  return "Open";
}
