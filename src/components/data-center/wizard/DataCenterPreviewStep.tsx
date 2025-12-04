import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, AlertTriangle } from "lucide-react";
import type { ParsedFileData, ColumnMapping } from "../DataCenterUploadWizard";

interface DataCenterPreviewStepProps {
  parsedData: ParsedFileData;
  columnMappings: ColumnMapping[];
  fieldDefinitions: any[];
}

export const DataCenterPreviewStep = ({
  parsedData,
  columnMappings,
  fieldDefinitions,
}: DataCenterPreviewStepProps) => {
  const mappedColumns = columnMappings.filter(m => m.fieldKey);
  const totalRows = parsedData.rows.length;
  const previewRows = parsedData.rows.slice(0, 10);

  // Get field labels for mapped columns
  const getFieldLabel = (key: string) => {
    const field = fieldDefinitions.find(f => f.key === key);
    return field?.label || key;
  };

  // Simple validation for preview
  const validateRow = (row: Record<string, any>) => {
    const issues: string[] = [];
    
    mappedColumns.forEach(mapping => {
      const value = row[mapping.fileColumn];
      const field = fieldDefinitions.find(f => f.key === mapping.fieldKey);
      
      if (field?.required_for_recouply && (value == null || value === "")) {
        issues.push(`Missing ${field.label}`);
      }
    });

    return issues;
  };

  const rowsWithIssues = parsedData.rows.filter(row => validateRow(row).length > 0).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalRows}</div>
            <p className="text-sm text-muted-foreground">Total rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{mappedColumns.length}</div>
            <p className="text-sm text-muted-foreground">Mapped columns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${rowsWithIssues > 0 ? "text-amber-600" : "text-green-600"}`}>
              {rowsWithIssues}
            </div>
            <p className="text-sm text-muted-foreground">Rows with issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Mapped Fields */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Mapped Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {mappedColumns.map(mapping => (
              <Badge key={mapping.fileColumn} variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {getFieldLabel(mapping.fieldKey!)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Preview */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Data Preview (first 10 rows)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {mappedColumns.slice(0, 6).map(mapping => (
                  <TableHead key={mapping.fileColumn} className="min-w-[120px]">
                    {getFieldLabel(mapping.fieldKey!)}
                  </TableHead>
                ))}
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, index) => {
                const issues = validateRow(row);
                return (
                  <TableRow key={index}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    {mappedColumns.slice(0, 6).map(mapping => (
                      <TableCell key={mapping.fileColumn} className="truncate max-w-[200px]">
                        {row[mapping.fileColumn] != null ? String(row[mapping.fileColumn]) : "-"}
                      </TableCell>
                    ))}
                    <TableCell>
                      {issues.length > 0 ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {issues.length}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalRows > 10 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Showing 10 of {totalRows} rows
            </p>
          )}
        </CardContent>
      </Card>

      {/* Warning if issues */}
      {rowsWithIssues > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              {rowsWithIssues} rows have validation issues. They will still be processed but may require review.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
