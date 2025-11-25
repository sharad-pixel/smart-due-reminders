import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ARAgingUpload } from "@/components/import/ARAgingUpload";
import { ARAgingColumnMapping } from "@/components/import/ARAgingColumnMapping";
import { ARAgingPreview } from "@/components/import/ARAgingPreview";
import { ARAgingImportSummary } from "@/components/import/ARAgingImportSummary";

export type ImportStep = "upload" | "mapping" | "preview" | "importing" | "summary";

export interface ParsedRow {
  rowIndex: number;
  company_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string; // Computed from invoice_date + payment_terms
  payment_terms: string;
  invoice_amount: number;
  outstanding_balance: number;
  days_past_due: number; // Computed from due_date
  link_to_invoice?: string;
  currency?: string;
}

export interface DebtorMatch {
  matched: boolean;
  debtorId?: string;
  debtorReferenceId?: string;
  debtorName?: string;
  confidence: "high" | "medium" | "low";
  matchReason?: string;
  suggestedReferenceId?: string;
}

export interface PreviewRow extends ParsedRow {
  debtorMatch: DebtorMatch;
  validationErrors: string[];
}

const ImportARAging = () => {
  const [currentStep, setCurrentStep] = useState<ImportStep>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importResults, setImportResults] = useState<{
    newDebtors: number;
    updatedDebtors: number;
    newInvoices: number;
    updatedInvoices: number;
    errors: string[];
  } | null>(null);

  const downloadSampleTemplate = () => {
    const csvContent = `Company Name,Contact Name,Contact Email,Contact Phone,Invoice Number,Invoice Date,Payment Terms,Invoice Amount,Outstanding Balance,Link to Invoice,Currency
ACME Corporation,John Smith,john@acme.com,555-0100,INV-001,2024-01-15,Net 30,5000.00,5000.00,https://invoices.example.com/001,USD
Tech Solutions Inc,Jane Doe,jane@techsolutions.com,555-0200,INV-002,2024-02-01,Net 15,3500.00,3500.00,https://invoices.example.com/002,USD
Global Services LLC,Bob Johnson,bob@globalservices.com,555-0300,INV-003,2023-12-01,Net 45,7500.00,7500.00,https://invoices.example.com/003,USD`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ar_aging_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Sample template downloaded");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Import AR Aging Report</h1>
            <p className="text-muted-foreground mt-2">
              Upload your accounts receivable aging report to automatically create debtors and invoices
            </p>
          </div>
          <Button variant="outline" onClick={downloadSampleTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Sample
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <CardTitle>Import Wizard</CardTitle>
            </div>
            <CardDescription>
              Follow the steps to map your data and import it into Recouply.ai
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={currentStep} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="upload" disabled={currentStep !== "upload"}>
                  1. Upload
                </TabsTrigger>
                <TabsTrigger value="mapping" disabled={currentStep !== "mapping"}>
                  2. Map Columns
                </TabsTrigger>
                <TabsTrigger value="preview" disabled={currentStep !== "preview"}>
                  3. Preview
                </TabsTrigger>
                <TabsTrigger value="summary" disabled={currentStep !== "summary"}>
                  4. Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-6">
                <ARAgingUpload
                  onFileUploaded={(file, data) => {
                    setUploadedFile(file);
                    setParsedData(data);
                    setCurrentStep("mapping");
                  }}
                />
              </TabsContent>

              <TabsContent value="mapping" className="mt-6">
                <ARAgingColumnMapping
                  parsedData={parsedData}
                  onMappingComplete={(mapping) => {
                    setColumnMapping(mapping);
                    setCurrentStep("preview");
                  }}
                  onBack={() => setCurrentStep("upload")}
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-6">
                <ARAgingPreview
                  parsedData={parsedData}
                  columnMapping={columnMapping}
                  onImportComplete={(results) => {
                    setImportResults(results);
                    setCurrentStep("summary");
                  }}
                  onBack={() => setCurrentStep("mapping")}
                />
              </TabsContent>

              <TabsContent value="summary" className="mt-6">
                <ARAgingImportSummary
                  results={importResults}
                  onStartNew={() => {
                    setCurrentStep("upload");
                    setUploadedFile(null);
                    setParsedData([]);
                    setColumnMapping({});
                    setPreviewData([]);
                    setImportResults(null);
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported File Formats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">CSV Files</h4>
                  <p className="text-sm text-muted-foreground">
                    Comma-separated values with headers
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Excel Files</h4>
                  <p className="text-sm text-muted-foreground">
                    .xlsx and .xls formats supported
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ImportARAging;
