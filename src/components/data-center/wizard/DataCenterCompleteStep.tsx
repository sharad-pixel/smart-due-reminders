import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Users, FileSpreadsheet, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DataCenterCompleteStepProps {
  result: any;
  uploadId: string | null;
}

export const DataCenterCompleteStep = ({ result, uploadId }: DataCenterCompleteStepProps) => {
  const navigate = useNavigate();

  if (!result) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Processing complete</p>
      </div>
    );
  }

  const hasNeedsReview = (result.needsReview || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
        <h2 className="text-xl font-bold">Import Complete!</h2>
        <p className="text-muted-foreground">
          Your data has been processed successfully
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{result.totalRows || 0}</div>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">{result.processed || 0}</div>
            <p className="text-sm text-muted-foreground">Processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{result.matched || 0}</div>
            <p className="text-sm text-muted-foreground">Matched</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className={`text-2xl font-bold ${hasNeedsReview ? "text-amber-600" : "text-muted-foreground"}`}>
              {result.needsReview || 0}
            </div>
            <p className="text-sm text-muted-foreground">Needs Review</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>Customers</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{result.newCustomers || 0} new</Badge>
              <Badge variant="secondary">{result.existingCustomers || 0} existing</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <span>{result.fileType === "payments" ? "Payments" : "Invoices"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{result.newRecords || 0} created</Badge>
              {result.updatedRecords > 0 && (
                <Badge variant="secondary">{result.updatedRecords} updated</Badge>
              )}
            </div>
          </div>

          {result.errors > 0 && (
            <div className="flex items-center justify-between text-destructive">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Errors</span>
              </div>
              <Badge variant="destructive">{result.errors}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Needs Review Warning */}
      {hasNeedsReview && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
            <Eye className="h-5 w-5" />
            <span className="font-medium">Some records need your attention</span>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-500 mb-3">
            {result.needsReview} records have low-confidence matches and require manual review.
          </p>
          <Button
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-100"
            onClick={() => navigate(`/data-center/review/${uploadId}`)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Review Matches
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => navigate("/invoices")}>
          View Invoices
        </Button>
        <Button variant="outline" onClick={() => navigate("/debtors")}>
          View Customers
        </Button>
      </div>
    </div>
  );
};
