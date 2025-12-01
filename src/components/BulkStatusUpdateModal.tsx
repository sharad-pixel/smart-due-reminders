import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface BulkStatusUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateComplete: () => void;
}

interface UpdateRow {
  external_invoice_id: string;
  new_status: string;
  paid_date?: string;
  notes?: string;
}

const ALLOWED_STATUSES = ["Open", "Paid", "Disputed", "Settled", "InPaymentPlan", "Canceled", "FinalInternalCollections"];

export function BulkStatusUpdateModal({ open, onOpenChange, onUpdateComplete }: BulkStatusUpdateModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<UpdateRow[]>([]);
  const [validRows, setValidRows] = useState<UpdateRow[]>([]);
  const [errorRows, setErrorRows] = useState<Array<{ row: number; data: UpdateRow; error: string }>>([]);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  const downloadTemplate = () => {
    const headers = ["external_invoice_id", "new_status", "paid_date (optional)", "notes (optional)"];
    const example = ["INV-12345", "Paid", "2024-01-15", "Payment received via bank transfer"];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, `bulk-status-update-template.xlsx`);
    toast.success("Template downloaded");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    
    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      if (jsonData.length === 0) {
        toast.error("File is empty");
        return;
      }

      const parsed = jsonData.map((row: any) => ({
        external_invoice_id: row.external_invoice_id || row["Invoice ID"] || row["invoice_id"],
        new_status: row.new_status || row["New Status"] || row["status"],
        paid_date: row.paid_date || row["Paid Date"] || row["paid_at"],
        notes: row.notes || row["Notes"] || "",
      }));
      
      setParsedData(parsed);
      setStep(2);
      toast.success(`Parsed ${parsed.length} rows from ${uploadedFile.name}`);
    } catch (error) {
      console.error("File parse error:", error);
      toast.error("Failed to parse file");
    }
  };

  const validateData = async () => {
    const valid: UpdateRow[] = [];
    const errors: Array<{ row: number; data: UpdateRow; error: string }> = [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    // Fetch existing invoice IDs for validation
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("external_invoice_id")
      .eq("user_id", user.id);

    const existingIds = new Set(existingInvoices?.map(i => i.external_invoice_id) || []);

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      let error = "";

      if (!row.external_invoice_id) {
        error = "Missing invoice ID";
      } else if (!existingIds.has(row.external_invoice_id)) {
        error = "Invoice ID not found in your account";
      } else if (!row.new_status) {
        error = "Missing new status";
      } else if (!ALLOWED_STATUSES.includes(row.new_status)) {
        error = `Invalid status: ${row.new_status}. Allowed: ${ALLOWED_STATUSES.join(", ")}`;
      } else if (row.new_status === "Paid" && !row.paid_date) {
        error = "Paid status requires a paid_date";
      }

      if (error) {
        errors.push({ row: i + 2, data: row, error });
      } else {
        valid.push(row);
      }
    }

    setValidRows(valid);
    setErrorRows(errors);
    setStep(3);
  };

  const runUpdate = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to update");
      return;
    }

    setUpdating(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create status update job
      const { data: job, error: jobError } = await supabase
        .from("invoice_status_update_jobs")
        .insert({
          created_by_user_id: user.id,
          file_name: file?.name || "unknown",
          total_rows: validRows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Process updates
      const { data, error } = await supabase.functions.invoke("bulk-update-invoice-status", {
        body: {
          job_id: job.id,
          updates: validRows,
        },
      });

      if (error) throw error;

      setProgress(100);
      setStep(4);
      toast.success(`Successfully updated ${data.success_count} of ${validRows.length} invoices`);
      
      setTimeout(() => {
        onUpdateComplete();
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const downloadErrorCSV = () => {
    const csv = [
      ["Row", "Error", "Invoice ID", "New Status"].join(","),
      ...errorRows.map(e => [
        e.row,
        `"${e.error}"`,
        e.data.external_invoice_id,
        e.data.new_status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `status-update-errors-${Date.now()}.csv`;
    a.click();
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setParsedData([]);
    setValidRows([]);
    setErrorRows([]);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Status Update</DialogTitle>
        </DialogHeader>

        {/* Step 1: Download Template & Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div><strong>Required columns:</strong> external_invoice_id, new_status</div>
                  <div><strong>Optional columns:</strong> paid_date (required if status = Paid), notes</div>
                  <div className="text-xs mt-2">
                    Allowed statuses: {ALLOWED_STATUSES.join(", ")}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Template CSV
            </Button>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-sm font-medium mb-2">Upload completed CSV or Excel file</div>
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

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Preview of first 5 rows. Click "Validate" to check all rows.
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Invoice ID</th>
                    <th className="p-2 text-left">New Status</th>
                    <th className="p-2 text-left">Paid Date</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{row.external_invoice_id}</td>
                      <td className="p-2">{row.new_status}</td>
                      <td className="p-2">{row.paid_date || "-"}</td>
                      <td className="p-2 truncate max-w-xs">{row.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={validateData}>Validate Data</Button>
            </div>
          </div>
        )}

        {/* Step 3: Validation Results */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong className="text-green-600">{validRows.length} valid updates</strong>
                </AlertDescription>
              </Alert>

              {errorRows.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{errorRows.length} rows with errors</strong>
                  </AlertDescription>
                </Alert>
              )}
            </div>

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
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button 
                onClick={runUpdate} 
                disabled={validRows.length === 0 || updating}
              >
                {updating ? "Updating..." : `Apply ${validRows.length} Updates`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong className="text-green-600">Update Complete!</strong>
                <br />
                Successfully updated {validRows.length} invoices.
              </AlertDescription>
            </Alert>

            {updating && (
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
