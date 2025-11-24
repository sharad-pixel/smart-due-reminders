import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Users, FileText, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ARAgingImportSummaryProps {
  results: {
    newDebtors: number;
    updatedDebtors: number;
    newInvoices: number;
    updatedInvoices: number;
    errors: string[];
  } | null;
  onStartNew: () => void;
}

export const ARAgingImportSummary = ({
  results,
  onStartNew,
}: ARAgingImportSummaryProps) => {
  const navigate = useNavigate();

  if (!results) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No import results available</p>
      </div>
    );
  }

  const hasErrors = results.errors.length > 0;
  const totalSuccess = results.newInvoices + results.updatedInvoices;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        {hasErrors ? (
          <>
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-600" />
            <h2 className="text-2xl font-bold">Import Completed with Warnings</h2>
            <p className="text-muted-foreground">
              Some items were imported successfully, but there were errors
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            <h2 className="text-2xl font-bold">Import Completed Successfully!</h2>
            <p className="text-muted-foreground">
              Your AR aging data has been imported into Recouply.ai
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border rounded-lg p-6 space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Debtors</h3>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New Debtors Created</span>
              <Badge variant="secondary">{results.newDebtors}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Existing Debtors Updated</span>
              <Badge variant="outline">{results.updatedDebtors}</Badge>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Invoices</h3>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New Invoices Created</span>
              <Badge variant="secondary">{results.newInvoices}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Existing Invoices Updated</span>
              <Badge variant="outline">{results.updatedInvoices}</Badge>
            </div>
          </div>
        </div>
      </div>

      {hasErrors && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{results.errors.length} Error(s) Occurred:</p>
              <ul className="list-disc list-inside space-y-1">
                {results.errors.slice(0, 5).map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
                {results.errors.length > 5 && (
                  <li className="text-sm italic">...and {results.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="font-medium">Next Steps:</h4>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate("/debtors")}
          >
            <Users className="h-4 w-4 mr-2" />
            View All Debtors
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate("/invoices")}
          >
            <FileText className="h-4 w-4 mr-2" />
            View All Invoices
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate("/collections/drafts")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate AI Collection Drafts
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={onStartNew}>
          Import Another File
        </Button>
        <Button onClick={() => navigate("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};
