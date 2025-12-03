import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ImportResultStepProps {
  result: { success: number; errors: number };
  uploadType: "invoice_detail" | "ar_summary" | "payments";
  onClose: () => void;
}

export const ImportResultStep = ({ result, uploadType, onClose }: ImportResultStepProps) => {
  const navigate = useNavigate();

  const getNextAction = () => {
    switch (uploadType) {
      case "invoice_detail":
        return {
          label: "View Invoices",
          path: "/invoices",
        };
      case "ar_summary":
        return {
          label: "View AR Dashboard",
          path: "/ar-aging",
        };
      case "payments":
        return {
          label: "Go to Reconciliation",
          path: "/reconciliation",
        };
    }
  };

  const nextAction = getNextAction();

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <div>
              <h3 className="text-xl font-semibold text-green-800">Import Complete!</h3>
              <p className="text-green-700 mt-1">
                Successfully imported {result.success} records
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.errors > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  {result.errors} rows were skipped
                </p>
                <p className="text-sm text-yellow-700">
                  These rows had validation errors or were duplicates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadType === "payments" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/20 p-2">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">AI Payment Matching Started</p>
                <p className="text-sm text-muted-foreground">
                  Our AI is analyzing your payments and matching them to invoices.
                  Check the Reconciliation page to review matches.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Upload More Files
        </Button>
        <Button onClick={() => navigate(nextAction.path)}>
          {nextAction.label}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
