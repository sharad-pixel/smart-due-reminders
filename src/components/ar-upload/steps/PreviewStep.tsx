import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Check, AlertTriangle, Users, FileWarning, Loader2 } from "lucide-react";
import type { ValidationResult, ColumnMapping } from "../ARUploadWizard";

interface PreviewStepProps {
  validationResult: ValidationResult;
  rows: Record<string, any>[];
  mapping: ColumnMapping;
  onImport: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

export const PreviewStep = ({
  validationResult,
  rows,
  mapping,
  onImport,
  onBack,
  isProcessing,
}: PreviewStepProps) => {
  const {
    totalRows,
    validRows,
    errorRows,
    duplicateRows,
    newCustomers,
    existingCustomers,
    duplicates,
    errors,
  } = validationResult;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{validRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{duplicateRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{errorRows}</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Customer Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newCustomers.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2 text-green-600">
                {newCustomers.length} New Customers to Create:
              </p>
              <div className="flex flex-wrap gap-2">
                {newCustomers.slice(0, 10).map((name) => (
                  <Badge key={name} variant="outline" className="bg-green-50">
                    {name}
                  </Badge>
                ))}
                {newCustomers.length > 10 && (
                  <Badge variant="secondary">+{newCustomers.length - 10} more</Badge>
                )}
              </div>
            </div>
          )}
          {existingCustomers.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                {existingCustomers.length} Existing Customers:
              </p>
              <div className="flex flex-wrap gap-2">
                {existingCustomers.slice(0, 10).map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
                {existingCustomers.length > 10 && (
                  <Badge variant="secondary">+{existingCustomers.length - 10} more</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicates */}
      {duplicates.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Potential Duplicates ({duplicates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These rows will be skipped during import. You can change this behavior in the full version.
            </p>
            <div className="max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.slice(0, 10).map((dup) => (
                    <TableRow key={dup.rowIndex}>
                      <TableCell>{dup.rowIndex + 2}</TableCell>
                      <TableCell>
                        {String(rows[dup.rowIndex]?.[mapping.customer_name!] || "Unknown")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-50">
                          {dup.reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {duplicates.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  +{duplicates.length - 10} more duplicates
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <FileWarning className="h-4 w-4" />
              Validation Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These rows have missing or invalid data and will be skipped.
            </p>
            <div className="max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.slice(0, 10).map((err) => (
                    <TableRow key={err.rowIndex}>
                      <TableCell>{err.rowIndex + 2}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {err.errors.map((e, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {errors.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  +{errors.length - 10} more errors
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onImport} disabled={validRows === 0 || isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Import {validRows} Records
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
