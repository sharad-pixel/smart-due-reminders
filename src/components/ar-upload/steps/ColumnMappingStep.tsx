import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { ColumnMapping } from "../ARUploadWizard";

interface ColumnMappingStepProps {
  headers: string[];
  requiredFields: string[];
  optionalFields: string[];
  initialMapping: ColumnMapping;
  onComplete: (mapping: ColumnMapping) => void;
  onBack: () => void;
  isProcessing: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  customer_name: "Customer Name",
  invoice_number: "Invoice Number",
  invoice_date: "Invoice Date",
  due_date: "Due Date",
  amount: "Amount",
  currency: "Currency",
  status: "Status",
  notes: "Notes",
  as_of_date: "As-of Date",
  bucket_current: "Current (0 days)",
  bucket_1_30: "1-30 Days",
  bucket_31_60: "31-60 Days",
  bucket_61_90: "61-90 Days",
  bucket_91_120: "91-120 Days",
  bucket_120_plus: "120+ Days",
  payment_date: "Payment Date",
  reference: "Reference/Check #",
};

export const ColumnMappingStep = ({
  headers,
  requiredFields,
  optionalFields,
  initialMapping,
  onComplete,
  onBack,
  isProcessing,
}: ColumnMappingStepProps) => {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  const handleMappingChange = (field: string, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value === "none" ? null : value,
    }));
  };

  const isValid = requiredFields.every((field) => mapping[field]);

  const unmappedRequired = requiredFields.filter((f) => !mapping[f]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Required Fields</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {requiredFields.map((field) => (
              <div key={field} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {FIELD_LABELS[field] || field}
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                </Label>
                <Select
                  value={mapping[field] || "none"}
                  onValueChange={(value) => handleMappingChange(field, value)}
                >
                  <SelectTrigger className={!mapping[field] ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped --</SelectItem>
                    {headers.filter(h => h && h.trim() !== '').map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {optionalFields.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Optional Fields</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {optionalFields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {FIELD_LABELS[field] || field}
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  </Label>
                  <Select
                    value={mapping[field] || "none"}
                    onValueChange={(value) => handleMappingChange(field, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Not mapped --</SelectItem>
                    {headers.filter(h => h && h.trim() !== '').map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {unmappedRequired.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">
            Missing required mappings: {unmappedRequired.map((f) => FIELD_LABELS[f] || f).join(", ")}
          </p>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Available columns in your file:</h4>
        <div className="flex flex-wrap gap-2">
          {headers.map((header) => (
            <Badge key={header} variant="outline">
              {header}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={() => onComplete(mapping)} disabled={!isValid || isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
