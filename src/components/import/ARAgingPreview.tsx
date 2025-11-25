import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PreviewRow, DebtorMatch } from "@/pages/ImportARAging";
import { calculateDueDateFromTerms } from "@/lib/paymentTerms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface ARAgingPreviewProps {
  parsedData: any[];
  columnMapping: Record<string, string>;
  onImportComplete: (results: {
    newDebtors: number;
    updatedDebtors: number;
    newInvoices: number;
    updatedInvoices: number;
    errors: string[];
  }) => void;
  onBack: () => void;
}

export const ARAgingPreview = ({
  parsedData,
  columnMapping,
  onImportComplete,
  onBack,
}: ARAgingPreviewProps) => {
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    processPreviewData();
  }, [parsedData, columnMapping]);

  const processPreviewData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch existing debtors for matching
      const { data: existingDebtors } = await supabase
        .from("debtors")
        .select("id, reference_id, company_name, email, phone, primary_email, primary_phone")
        .eq("user_id", user.id);

      const rows: PreviewRow[] = parsedData.map((row, index) => {
        const mappedRow: any = {};
        Object.entries(columnMapping).forEach(([field, column]) => {
          if (column) {
            mappedRow[field] = row[column];
          }
        });

        // Validate and parse the row
        const validationErrors: string[] = [];
        
        if (!mappedRow.company_name) validationErrors.push("Missing company name");
        if (!mappedRow.invoice_number) validationErrors.push("Missing invoice number");
        if (!mappedRow.invoice_date) validationErrors.push("Missing invoice date");
        if (!mappedRow.payment_terms) validationErrors.push("Missing payment terms");
        if (!mappedRow.invoice_amount) validationErrors.push("Missing invoice amount");

        // Try to match with existing debtor
        const debtorMatch = matchDebtor(mappedRow, existingDebtors || []);

        // Calculate due date from payment terms
        const dueDate = mappedRow.payment_terms 
          ? calculateDueDateFromTerms(mappedRow.invoice_date || "", mappedRow.payment_terms)
          : mappedRow.invoice_date;

        // Calculate days past due from computed due date
        const today = new Date();
        const dueDateObj = new Date(dueDate);
        const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          rowIndex: index,
          company_name: mappedRow.company_name || "",
          contact_name: mappedRow.contact_name,
          contact_email: mappedRow.contact_email,
          contact_phone: mappedRow.contact_phone,
          invoice_number: mappedRow.invoice_number || "",
          invoice_date: mappedRow.invoice_date || "",
          due_date: dueDate,
          payment_terms: mappedRow.payment_terms,
          invoice_amount: parseFloat(mappedRow.invoice_amount) || 0,
          outstanding_balance: parseFloat(mappedRow.outstanding_balance || mappedRow.invoice_amount) || 0,
          days_past_due: daysPastDue,
          link_to_invoice: mappedRow.link_to_invoice,
          currency: mappedRow.currency || "USD",
          debtorMatch,
          validationErrors,
        };
      });

      setPreviewRows(rows);
      
      // Select all valid rows by default
      const validRowIndices = new Set(
        rows
          .filter((row) => row.validationErrors.length === 0)
          .map((row) => row.rowIndex)
      );
      setSelectedRows(validRowIndices);
    } catch (error) {
      console.error("Error processing preview:", error);
      toast.error("Failed to process data");
    } finally {
      setIsLoading(false);
    }
  };

  const matchDebtor = (row: any, existingDebtors: any[]): DebtorMatch => {
    const email = row.contact_email?.toLowerCase().trim();
    const phone = row.contact_phone?.replace(/\D/g, "");
    const companyName = row.company_name?.toLowerCase().trim();

    // 1. Try email match (highest priority)
    if (email) {
      const emailMatch = existingDebtors.find(
        (d) =>
          d.email?.toLowerCase().trim() === email ||
          d.primary_email?.toLowerCase().trim() === email
      );
      if (emailMatch) {
        return {
          matched: true,
          debtorId: emailMatch.id,
          debtorReferenceId: emailMatch.reference_id,
          debtorName: emailMatch.company_name,
          confidence: "high",
          matchReason: "Email match",
        };
      }
    }

    // 2. Try company name + phone match
    if (companyName && phone) {
      const namePhoneMatch = existingDebtors.find((d) => {
        const dPhone = d.phone?.replace(/\D/g, "") || d.primary_phone?.replace(/\D/g, "");
        const dName = d.company_name?.toLowerCase().trim();
        return dName === companyName && dPhone === phone;
      });
      if (namePhoneMatch) {
        return {
          matched: true,
          debtorId: namePhoneMatch.id,
          debtorReferenceId: namePhoneMatch.reference_id,
          debtorName: namePhoneMatch.company_name,
          confidence: "high",
          matchReason: "Company name + phone match",
        };
      }
    }

    // 3. Try fuzzy company name match
    if (companyName) {
      const fuzzyMatch = existingDebtors.find(
        (d) => d.company_name?.toLowerCase().trim() === companyName
      );
      if (fuzzyMatch) {
        return {
          matched: true,
          debtorId: fuzzyMatch.id,
          debtorReferenceId: fuzzyMatch.reference_id,
          debtorName: fuzzyMatch.company_name,
          confidence: "medium",
          matchReason: "Company name match (verify contact details differ)",
        };
      }
    }

    // No match - will create new debtor
    return {
      matched: false,
      confidence: "high",
      suggestedReferenceId: "Will be auto-generated (RCPLY-XXXXX)",
    };
  };

  const handleImport = async () => {
    setIsImporting(true);
    const results = {
      newDebtors: 0,
      updatedDebtors: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      errors: [] as string[],
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const rowsToImport = previewRows.filter((row) =>
        selectedRows.has(row.rowIndex)
      );

      // Group rows by debtor
      const debtorGroups = new Map<string, PreviewRow[]>();
      rowsToImport.forEach((row) => {
        const key = row.debtorMatch.matched
          ? row.debtorMatch.debtorId!
          : row.company_name;
        if (!debtorGroups.has(key)) {
          debtorGroups.set(key, []);
        }
        debtorGroups.get(key)!.push(row);
      });

      // Process each debtor group
      for (const [key, rows] of debtorGroups) {
        const firstRow = rows[0];
        let debtorId: string;

        if (firstRow.debtorMatch.matched) {
          // Use existing debtor
          debtorId = firstRow.debtorMatch.debtorId!;
          results.updatedDebtors++;
        } else {
          // Create new debtor
          const { data: newDebtor, error } = await supabase
            .from("debtors")
            .insert([{
              user_id: user.id,
              company_name: firstRow.company_name,
              name: firstRow.company_name,
              contact_name: firstRow.contact_name || firstRow.company_name,
              email: firstRow.contact_email || `no-email-${Date.now()}@placeholder.com`,
              phone: firstRow.contact_phone,
              primary_email: firstRow.contact_email,
              primary_phone: firstRow.contact_phone,
              primary_contact_name: firstRow.contact_name,
              reference_id: ""  // Will be auto-generated by trigger
            }])
            .select()
            .single();

          if (error) {
            results.errors.push(`Failed to create debtor ${firstRow.company_name}: ${error.message}`);
            continue;
          }

          debtorId = newDebtor.id;
          results.newDebtors++;
        }

        // Create invoices for this debtor
        for (const row of rows) {
          // Calculate due date from payment terms or use invoice date
          const dueDate = row.payment_terms
            ? calculateDueDateFromTerms(row.invoice_date, row.payment_terms)
            : row.invoice_date;

          const invoiceData = {
            user_id: user.id,
            debtor_id: debtorId,
            invoice_number: row.invoice_number,
            issue_date: row.invoice_date,
            due_date: dueDate,
            amount: row.invoice_amount,
            total_amount: row.outstanding_balance,
            subtotal: row.outstanding_balance,
            currency: row.currency,
            status: "Open" as const,
            payment_terms: row.payment_terms || null,
            external_link: row.link_to_invoice,
            reference_id: ""  // Will be auto-generated by trigger
          };

          const { error } = await supabase.from("invoices").insert([invoiceData]);

          if (error) {
            results.errors.push(`Failed to create invoice ${row.invoice_number}: ${error.message}`);
          } else {
            results.newInvoices++;
          }
        }
      }

      toast.success(`Import completed: ${results.newInvoices} invoices, ${results.newDebtors} new debtors`);
      onImportComplete(results);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
      results.errors.push(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsImporting(false);
    }
  };

  const toggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === previewRows.filter(r => r.validationErrors.length === 0).length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(previewRows.filter(r => r.validationErrors.length === 0).map((r) => r.rowIndex)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-muted-foreground">Processing data and matching debtors...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Preview Import Data</h3>
          <p className="text-sm text-muted-foreground">
            {selectedRows.size} of {previewRows.length} rows selected
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll}>
          {selectedRows.size === previewRows.filter(r => r.validationErrors.length === 0).length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedRows.size === previewRows.filter(r => r.validationErrors.length === 0).length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Debtor Status</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row) => (
                <TableRow key={row.rowIndex}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(row.rowIndex)}
                      onCheckedChange={() => toggleRow(row.rowIndex)}
                      disabled={row.validationErrors.length > 0}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{row.company_name}</div>
                      {row.contact_email && (
                        <div className="text-xs text-muted-foreground">{row.contact_email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.debtorMatch.matched ? (
                      <div>
                        <Badge variant="outline" className="gap-1">
                          <Check className="h-3 w-3" />
                          {row.debtorMatch.debtorReferenceId}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {row.debtorMatch.matchReason}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Plus className="h-3 w-3" />
                        New Debtor
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{row.invoice_number}</div>
                    {row.invoice_date && (
                      <div className="text-xs text-muted-foreground">{row.invoice_date}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${row.invoice_amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${row.outstanding_balance.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {row.validationErrors.length > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {row.validationErrors.length} Error(s)
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Ready
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleImport}
          disabled={selectedRows.size === 0 || isImporting}
        >
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Importing...
            </>
          ) : (
            `Import ${selectedRows.size} Row(s)`
          )}
        </Button>
      </div>
    </div>
  );
};
