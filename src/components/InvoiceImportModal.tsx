import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface InvoiceImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ColumnMapping {
  [key: string]: string;
}

interface ParsedRow {
  [key: string]: any;
}

const REQUIRED_FIELDS = [
  { key: "external_invoice_id", label: "Invoice Number/ID" },
  { key: "amount", label: "Amount Due" },
  { key: "currency", label: "Currency" },
  { key: "due_date", label: "Due Date" },
  { key: "status", label: "Status" },
];

const OPTIONAL_FIELDS = [
  { key: "invoice_number", label: "Internal Invoice #" },
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_email", label: "Customer Email" },
  { key: "issue_date", label: "Issue Date" },
  { key: "source_system", label: "Invoicing System" },
  { key: "product_description", label: "Product Description" },
  { key: "notes", label: "Notes" },
];

const ALLOWED_STATUSES = ["Open", "Paid", "PartiallyPaid", "Disputed", "Settled", "InPaymentPlan", "Canceled", "FinalInternalCollections"];

export function InvoiceImportModal({ open, onOpenChange, onImportComplete }: InvoiceImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [importMode, setImportMode] = useState<"INSERT_ONLY" | "UPSERT_BY_EXTERNAL_INVOICE_ID">("INSERT_ONLY");
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [errorRows, setErrorRows] = useState<Array<{ row: number; data: ParsedRow; error: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [duplicateRows, setDuplicateRows] = useState<Array<{ row: number; data: ParsedRow; reason: string }>>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(uploadedFile.type)) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    setFile(uploadedFile);
    
    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      if (jsonData.length === 0) {
        toast.error("File is empty");
        return;
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];
      
      setFileHeaders(headers);
      
      const parsed = rows
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ""))
        .map((row) => {
          const obj: ParsedRow = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });
      
      setParsedData(parsed);
      autoDetectMapping(headers);
      setStep(2);
      toast.success(`Parsed ${parsed.length} rows from ${uploadedFile.name}`);
    } catch (error) {
      console.error("File parse error:", error);
      toast.error("Failed to parse file");
    }
  };

  const autoDetectMapping = (headers: string[]) => {
    const mapping: ColumnMapping = {};
    
    const mappingRules: Record<string, string[]> = {
      external_invoice_id: ["invoice", "invoice number", "invoice_number", "invoice #", "id", "external_invoice_id"],
      invoice_number: ["internal invoice", "internal invoice #", "internal invoice number", "internal_invoice_number", "invoice_number"],
      customer_name: ["customer", "customer name", "customer_name", "debtor", "name", "company"],
      customer_email: ["email", "customer email", "customer_email", "contact email"],
      amount: ["amount", "amount due", "amount_due", "total", "balance"],
      currency: ["currency", "curr"],
      issue_date: ["issue date", "issue_date", "invoice date", "date"],
      due_date: ["due date", "due_date", "payment due"],
      status: ["status", "state"],
      source_system: ["source", "source system", "source_system", "system", "invoicing system", "invoicing_system"],
      product_description: ["product", "product description", "product_description", "description", "item", "service"],
      notes: ["notes", "note", "comments", "comment"],
    };

    headers.forEach((header) => {
      const headerLower = header.toLowerCase().trim();
      Object.entries(mappingRules).forEach(([field, patterns]) => {
        if (patterns.some(pattern => headerLower.includes(pattern))) {
          mapping[field] = header;
        }
      });
    });

    setColumnMapping(mapping);
  };

  const handleMappingChange = (field: string, column: string) => {
    setColumnMapping(prev => ({ ...prev, [field]: column }));
  };

  const validateMapping = () => {
    const missingRequired = REQUIRED_FIELDS.filter(field => !columnMapping[field.key]);
    
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map(f => f.label).join(", ")}`);
      return false;
    }
    
    return true;
  };

  const validateData = async () => {
    setIsCheckingDuplicates(true);
    const valid: ParsedRow[] = [];
    const errors: Array<{ row: number; data: ParsedRow; error: string }> = [];
    const dupes: Array<{ row: number; data: ParsedRow; reason: string }> = [];

    // Map all rows first
    const allMapped = parsedData.map((row, index) => {
      const mappedRow: any = {};
      Object.entries(columnMapping).forEach(([field, column]) => {
        mappedRow[field] = row[column];
      });
      return { mappedRow, index };
    });

    // Collect all external_invoice_ids to check against DB
    const invoiceIds = allMapped
      .map(r => String(r.mappedRow.external_invoice_id || "").trim())
      .filter(Boolean);

    // Batch-check existing invoices in DB (paginate to bypass 1000-row limit)
    let existingIds = new Set<string>();
    if (invoiceIds.length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // First, fetch ALL existing external_invoice_ids via pagination
          let from = 0;
          const PAGE_SIZE = 1000;
          while (true) {
            const { data: page } = await supabase
              .from("invoices")
              .select("external_invoice_id")
              .eq("user_id", user.id)
              .not("external_invoice_id", "is", null)
              .range(from, from + PAGE_SIZE - 1);
            if (!page || page.length === 0) break;
            page.forEach(inv => {
              if (inv.external_invoice_id) existingIds.add(inv.external_invoice_id);
            });
            if (page.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
        }
      } catch (e) {
        console.error("Duplicate check error:", e);
      }
    }

    // Track in-file duplicates
    const seenInFile = new Set<string>();

    allMapped.forEach(({ mappedRow, index }) => {
      let error = "";
      const extId = String(mappedRow.external_invoice_id || "").trim();

      // Validate required fields
      if (!extId) {
        error = "Missing invoice ID";
      } else if (!mappedRow.amount || isNaN(parseFloat(mappedRow.amount))) {
        error = "Invalid amount";
      } else if (!mappedRow.currency || mappedRow.currency.length !== 3) {
        error = "Currency must be 3 letters (e.g., USD)";
      } else if (!mappedRow.due_date) {
        error = "Missing due date";
      } else if (!mappedRow.status) {
        error = "Missing status";
      } else if (!ALLOWED_STATUSES.includes(mappedRow.status)) {
        error = `Invalid status: ${mappedRow.status}. Allowed: ${ALLOWED_STATUSES.join(", ")}`;
      }

      if (error) {
        errors.push({ row: index + 2, data: mappedRow, error });
      } else if (importMode === "INSERT_ONLY" && existingIds.has(extId)) {
        dupes.push({ row: index + 2, data: mappedRow, reason: `Already exists in system (${extId})` });
      } else if (seenInFile.has(extId)) {
        dupes.push({ row: index + 2, data: mappedRow, reason: `Duplicate in file (${extId})` });
      } else {
        seenInFile.add(extId);
        valid.push(mappedRow);
      }
    });

    setValidRows(valid);
    setErrorRows(errors);
    setDuplicateRows(dupes);
    setIsCheckingDuplicates(false);
    setStep(4);
  };

  const runImport = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create import job
      const { data: job, error: jobError } = await supabase
        .from("invoice_import_jobs")
        .insert({
          created_by_user_id: user.id,
          file_name: file?.name || "unknown",
          total_rows: validRows.length,
          mode: importMode,
          status: "PROCESSING",
        })
        .select()
        .single();

      if (jobError) throw jobError;
      setJobId(job.id);

      // Process in client-side batches to avoid edge function timeouts
      const CLIENT_BATCH_SIZE = 100;
      let totalSuccess = 0;
      let totalErrors = 0;

      for (let i = 0; i < validRows.length; i += CLIENT_BATCH_SIZE) {
        const batch = validRows.slice(i, i + CLIENT_BATCH_SIZE);
        const batchNum = Math.floor(i / CLIENT_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(validRows.length / CLIENT_BATCH_SIZE);

        const isLastBatch = (i + CLIENT_BATCH_SIZE) >= validRows.length;

        const { data, error } = await supabase.functions.invoke("import-invoices", {
          body: {
            job_id: job.id,
            rows: batch,
            mode: importMode,
            is_final_batch: isLastBatch,
          },
        });

        if (error) throw error;

        totalSuccess += data.success_count || 0;
        totalErrors += data.error_count || 0;

        const pct = Math.round(((i + batch.length) / validRows.length) * 100);
        setProgress(pct);

        // Small delay between batches to avoid overwhelming the backend
        if (i + CLIENT_BATCH_SIZE < validRows.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      setProgress(100);
      setStep(5);
      toast.success(`Successfully imported ${totalSuccess} of ${validRows.length} invoices${totalErrors > 0 ? ` (${totalErrors} errors)` : ''}`);
      
      setTimeout(() => {
        onImportComplete();
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "external_invoice_id",
      "invoice_number",
      "customer_name",
      "customer_email",
      "amount",
      "currency",
      "issue_date",
      "due_date",
      "status",
      "source_system",
      "product_description",
      "notes"
    ];

    const exampleRow = [
      "INV-2024-001",
      "INT-001",
      "Acme Corporation",
      "accounting@acme.com",
      "1500.00",
      "USD",
      "2024-01-01",
      "2024-01-31",
      "Open",
      "QuickBooks",
      "Professional Services - January 2024",
      "Net 30 payment terms"
    ];

    const csv = [
      headers.join(","),
      exampleRow.join(",")
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-import-template.csv`;
    a.click();
  };

  const downloadErrorCSV = () => {
    const csv = [
      ["Row", "Error", ...Object.keys(errorRows[0]?.data || {})].join(","),
      ...errorRows.map(e => [
        e.row,
        `"${e.error}"`,
        ...Object.values(e.data).map(v => `"${v}"`)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    a.click();
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setParsedData([]);
    setFileHeaders([]);
    setColumnMapping({});
    setValidRows([]);
    setErrorRows([]);
    setDuplicateRows([]);
    setProgress(0);
    setJobId(null);
    setIsCheckingDuplicates(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Invoices</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required fields:</strong> Invoice ID, Amount, Currency (3 letters), Due Date, Status
                <br />
                <strong>Optional fields:</strong> Internal Invoice #, Customer Name, Customer Email, Issue Date, Invoicing System, Product Description, Notes
                <br />
                <span className="text-xs mt-1 block">
                  <strong>Limits:</strong> Max 10,000 rows per import. Imports exceeding your plan's invoice limit will incur overage charges ($1.99/invoice).
                </span>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end mb-4">
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-sm font-medium mb-2">Upload CSV or Excel file</div>
                <div className="text-xs text-muted-foreground mb-4">Click to browse or drag and drop</div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button type="button" variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </Label>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Map your file columns to invoice fields. We've auto-detected some mappings.
            </div>

            <div className="space-y-3">
              <div className="font-medium">Required Fields</div>
              {REQUIRED_FIELDS.map(field => (
                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                  <Label>{field.label} *</Label>
                  <Select
                    value={columnMapping[field.key] || ""}
                    onValueChange={(value) => handleMappingChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {fileHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="font-medium mt-6">Optional Fields</div>
              {OPTIONAL_FIELDS.map(field => (
                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                  <Label className="text-muted-foreground">{field.label}</Label>
                  <Select
                    value={columnMapping[field.key] || ""}
                    onValueChange={(value) => handleMappingChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Skip (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Skip</SelectItem>
                      {fileHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => validateMapping() && setStep(3)}>Next: Import Mode</Button>
            </div>
          </div>
        )}

        {/* Step 3: Import Mode */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Choose how to handle existing invoices with matching invoice IDs.
            </div>

            <RadioGroup value={importMode} onValueChange={(value: any) => setImportMode(value)}>
              <div className="flex items-start space-x-3 border rounded-lg p-4">
                <RadioGroupItem value="INSERT_ONLY" id="insert" />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="insert" className="font-medium cursor-pointer">
                    Insert Only (Fail on Duplicates)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only insert new invoices. If an invoice ID already exists, it will be marked as an error.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 border rounded-lg p-4">
                <RadioGroupItem value="UPSERT_BY_EXTERNAL_INVOICE_ID" id="upsert" />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="upsert" className="font-medium cursor-pointer">
                    Upsert (Update or Insert)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Update existing invoices with matching IDs, or insert new ones if they don't exist.
                  </p>
                </div>
              </div>
            </RadioGroup>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={validateData} disabled={isCheckingDuplicates}>
                {isCheckingDuplicates ? "Checking duplicates..." : "Next: Validate Data"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Validation & Preview */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong className="text-green-600">{validRows.length} valid rows</strong>
                </AlertDescription>
              </Alert>

              {duplicateRows.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <strong className="text-yellow-600">{duplicateRows.length} duplicates skipped</strong>
                  </AlertDescription>
                </Alert>
              )}

              {errorRows.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{errorRows.length} rows with errors</strong>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {duplicateRows.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Duplicates (first 5) — these will NOT be imported</div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Row</th>
                        <th className="p-2 text-left">Invoice ID</th>
                        <th className="p-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicateRows.slice(0, 5).map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{d.row}</td>
                          <td className="p-2">{d.data.external_invoice_id}</td>
                          <td className="p-2 text-yellow-600">{d.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {errorRows.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium">Error Preview (first 5)</div>
                  <Button size="sm" variant="outline" onClick={downloadErrorCSV}>
                    <Download className="h-3 w-3 mr-1" />
                    Download All Errors
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Row</th>
                        <th className="p-2 text-left">Error</th>
                        <th className="p-2 text-left">Invoice ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.slice(0, 5).map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{e.row}</td>
                          <td className="p-2 text-red-600">{e.error}</td>
                          <td className="p-2">{e.data.external_invoice_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button 
                onClick={runImport} 
                disabled={validRows.length === 0 || importing}
              >
                {importing ? "Importing..." : `Import ${validRows.length} Invoices`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Results */}
        {step === 5 && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong className="text-green-600">Import Complete!</strong>
                <br />
                Successfully imported {validRows.length} invoices.
              </AlertDescription>
            </Alert>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <div className="text-sm text-center text-muted-foreground">Processing...</div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
