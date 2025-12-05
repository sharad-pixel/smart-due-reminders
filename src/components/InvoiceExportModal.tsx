import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InvoiceExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXPORT_COLUMNS = [
  { key: "recouply_invoice_id", label: "Recouply Invoice ID", default: true },
  { key: "external_invoice_id", label: "External Invoice ID", default: true },
  { key: "invoice_number", label: "Invoice Number", default: true },
  { key: "customer_name", label: "Customer Name", default: true },
  { key: "customer_email", label: "Customer Email", default: true },
  { key: "amount", label: "Amount", default: true },
  { key: "currency", label: "Currency", default: true },
  { key: "issue_date", label: "Issue Date", default: true },
  { key: "due_date", label: "Due Date", default: true },
  { key: "status", label: "Status", default: true },
  { key: "aging_bucket", label: "Aging Bucket", default: true },
  { key: "source_system", label: "Invoicing System", default: true },
  { key: "product_description", label: "Product Description", default: false },
  { key: "payment_terms", label: "Payment Terms", default: false },
  { key: "last_contacted_at", label: "Last Contacted", default: false },
  { key: "notes", label: "Notes", default: false },
];

export function InvoiceExportModal({ open, onOpenChange }: InvoiceExportModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(EXPORT_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agingBucketFilter, setAgingBucketFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const toggleColumn = (column: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(column)) {
      newSelected.delete(column);
    } else {
      newSelected.add(column);
    }
    setSelectedColumns(newSelected);
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    setExporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build query
      let query = supabase
        .from("invoices")
        .select("*, debtors(name, email)")
        .eq("user_id", user.id)
        .eq("is_archived", false);

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      if (dateFrom) {
        query = query.gte("due_date", dateFrom);
      }

      if (dateTo) {
        query = query.lte("due_date", dateTo);
      }

      const { data: invoices, error } = await query;

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        toast.error("No invoices found matching the filters");
        return;
      }

      // Calculate aging bucket for each invoice
      const processedInvoices = invoices.map(inv => {
        const daysPastDue = Math.max(
          0,
          Math.ceil((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
        );
        
        let aging_bucket = "current";
        if (daysPastDue > 0 && daysPastDue <= 30) aging_bucket = "0-30";
        else if (daysPastDue <= 60) aging_bucket = "31-60";
        else if (daysPastDue <= 90) aging_bucket = "61-90";
        else if (daysPastDue <= 120) aging_bucket = "91-120";
        else if (daysPastDue > 120) aging_bucket = "121+";

        return {
          recouply_invoice_id: inv.reference_id,
          external_invoice_id: inv.external_invoice_id || "",
          invoice_number: inv.invoice_number,
          customer_name: inv.debtors?.name || "",
          customer_email: inv.debtors?.email || "",
          amount: inv.amount,
          currency: inv.currency || "USD",
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          status: inv.status,
          aging_bucket,
          source_system: inv.source_system || "manual",
          product_description: inv.product_description || "",
          payment_terms: inv.payment_terms || "",
          last_contacted_at: inv.last_contacted_at || "",
          notes: inv.notes || "",
        };
      });

      // Filter by aging bucket if specified
      let filtered = processedInvoices;
      if (agingBucketFilter !== "all") {
        filtered = filtered.filter(inv => inv.aging_bucket === agingBucketFilter);
      }

      if (filtered.length === 0) {
        toast.error("No invoices found matching the filters");
        return;
      }

      // Select only requested columns
      const exportData = filtered.map(inv => {
        const row: any = {};
        Array.from(selectedColumns).forEach(col => {
          row[EXPORT_COLUMNS.find(c => c.key === col)?.label || col] = (inv as any)[col];
        });
        return row;
      });

      // Generate CSV
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
      XLSX.writeFile(workbook, `invoices-export-${Date.now()}.xlsx`);

      toast.success(`Exported ${filtered.length} invoices`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = EXPORT_COLUMNS.map(c => c.label);
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, `invoice-import-template.xlsx`);
    toast.success("Template downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Invoices</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters */}
          <div className="space-y-4">
            <div className="text-sm font-medium">Filters</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="PartiallyPaid">Partially Paid</SelectItem>
                    <SelectItem value="Disputed">Disputed</SelectItem>
                    <SelectItem value="Settled">Settled</SelectItem>
                    <SelectItem value="InPaymentPlan">In Payment Plan</SelectItem>
                    <SelectItem value="Canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aging Bucket</Label>
                <Select value={agingBucketFilter} onValueChange={setAgingBucketFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buckets</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="0-30">0-30 Days</SelectItem>
                    <SelectItem value="31-60">31-60 Days</SelectItem>
                    <SelectItem value="61-90">61-90 Days</SelectItem>
                    <SelectItem value="91-120">91-120 Days</SelectItem>
                    <SelectItem value="121+">121+ Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Due Date To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Select Columns to Export</div>
            <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
              {EXPORT_COLUMNS.map(column => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.key}
                    checked={selectedColumns.has(column.key)}
                    onCheckedChange={() => toggleColumn(column.key)}
                  />
                  <Label htmlFor={column.key} className="cursor-pointer">
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedColumns.size} columns selected
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex-1"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Empty Template
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || selectedColumns.size === 0}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Download CSV"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
