import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ARAgingColumnMappingProps {
  parsedData: any[];
  onMappingComplete: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

const REQUIRED_FIELDS = [
  { key: "company_name", label: "Company Name", required: true },
  { key: "invoice_number", label: "Invoice Number", required: true },
  { key: "invoice_date", label: "Invoice Date", required: true },
  { key: "invoice_amount", label: "Invoice Amount", required: true },
];

const OPTIONAL_FIELDS = [
  { key: "contact_name", label: "Contact Name", required: false },
  { key: "contact_email", label: "Contact Email", required: false },
  { key: "contact_phone", label: "Contact Phone", required: false },
  { key: "due_date", label: "Due Date", required: false },
  { key: "payment_terms", label: "Payment Terms", required: false },
  { key: "outstanding_balance", label: "Outstanding Balance", required: false },
  { key: "days_past_due", label: "Days Past Due", required: false },
  { key: "link_to_invoice", label: "Link to Invoice", required: false },
  { key: "currency", label: "Currency", required: false },
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

export const ARAgingColumnMapping = ({
  parsedData,
  onMappingComplete,
  onBack,
}: ARAgingColumnMappingProps) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileColumns, setFileColumns] = useState<string[]>([]);

  useEffect(() => {
    if (parsedData.length > 0) {
      const columns = Object.keys(parsedData[0]);
      setFileColumns(columns);

      // Auto-detect mappings
      const autoMapping: Record<string, string> = {};
      ALL_FIELDS.forEach((field) => {
        const matchingColumn = columns.find((col) =>
          col.toLowerCase().replace(/[^a-z0-9]/g, "").includes(
            field.key.toLowerCase().replace(/_/g, "")
          )
        );
        if (matchingColumn) {
          autoMapping[field.key] = matchingColumn;
        }
      });
      setMapping(autoMapping);
    }
  }, [parsedData]);

  const handleMappingChange = (fieldKey: string, columnName: string) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: columnName === "none" ? "" : columnName,
    }));
  };

  const isValidMapping = () => {
    return REQUIRED_FIELDS.every((field) => mapping[field.key]);
  };

  const handleNext = () => {
    if (isValidMapping()) {
      onMappingComplete(mapping);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Map your file columns to Recouply.ai fields. We've auto-detected some matches for you.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Required Fields
            <Badge variant="destructive">Must Map</Badge>
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="flex items-center gap-2">
                  {field.label}
                  {mapping[field.key] && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </Label>
                <Select
                  value={mapping[field.key] || "none"}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger id={field.key}>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not Mapped --</SelectItem>
                    {fileColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Optional Fields
            <Badge variant="secondary">Recommended</Badge>
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {OPTIONAL_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="flex items-center gap-2">
                  {field.label}
                  {mapping[field.key] && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </Label>
                <Select
                  value={mapping[field.key] || "none"}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger id={field.key}>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not Mapped --</SelectItem>
                    {fileColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={!isValidMapping()}>
          Next: Preview Data
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
