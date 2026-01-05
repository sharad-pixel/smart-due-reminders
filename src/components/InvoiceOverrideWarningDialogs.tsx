import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, AlertTriangle, Info, FileSpreadsheet } from "lucide-react";

// Session storage key for CSV warning dismissal
const CSV_WARNING_DISMISSED_KEY = "csv_edit_warning_dismissed";

interface CSVEditWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
}

export const CSVEditWarning = ({ open, onOpenChange, onProceed }: CSVEditWarningProps) => {
  const handleDismissSession = () => {
    sessionStorage.setItem(CSV_WARNING_DISMISSED_KEY, "true");
    onProceed();
    onOpenChange(false);
  };

  const handleProceed = () => {
    onProceed();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-blue-200 dark:border-blue-800">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <AlertDialogTitle className="text-blue-900 dark:text-blue-100">
              CSV Imported Invoice
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            This invoice was imported from a CSV file. Any changes you make here{" "}
            <span className="font-medium text-blue-700 dark:text-blue-300">
              won't sync back to the source file
            </span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800 rounded-lg p-3 my-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your original CSV file remains unchanged. Changes are saved only in Recouply.
            </p>
          </div>
        </div>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={handleDismissSession}
            className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            Don't show again this session
          </Button>
          <AlertDialogAction
            onClick={handleProceed}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            I Understand
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Check if CSV warning should be shown
export const shouldShowCSVWarning = (): boolean => {
  return sessionStorage.getItem(CSV_WARNING_DISMISSED_KEY) !== "true";
};

interface IntegrationOverrideWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
  integrationSource: string;
  integrationUrl?: string | null;
  fieldName: string;
  currentValue: string;
  newValue: string;
}

export const IntegrationOverrideWarning = ({
  open,
  onOpenChange,
  onProceed,
  integrationSource,
  integrationUrl,
  fieldName,
  currentValue,
  newValue,
}: IntegrationOverrideWarningProps) => {
  const [acknowledgeChecked, setAcknowledgeChecked] = useState(false);

  // Reset checkbox when dialog opens
  useEffect(() => {
    if (open) {
      setAcknowledgeChecked(false);
    }
  }, [open]);

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      stripe: "Stripe",
      quickbooks: "QuickBooks",
      xero: "Xero",
    };
    return labels[source] || source;
  };

  const handleEditInSource = () => {
    if (integrationUrl) {
      window.open(integrationUrl, "_blank");
    }
    onOpenChange(false);
  };

  const handleOverride = () => {
    if (!acknowledgeChecked) return;
    onProceed();
    onOpenChange(false);
  };

  const sourceLabel = getSourceLabel(integrationSource);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-orange-200 dark:border-orange-800">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <AlertDialogTitle className="text-orange-900 dark:text-orange-100">
              Override {sourceLabel} Data?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            This change will be{" "}
            <span className="font-semibold text-orange-700 dark:text-orange-300">
              overwritten on the next sync
            </span>{" "}
            from {sourceLabel}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 my-2">
          {/* Field change preview */}
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-800 rounded-lg p-4">
            <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
              {fieldName}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Current (from {sourceLabel})
                </span>
                <Badge variant="outline" className="font-mono text-sm">
                  {currentValue || "—"}
                </Badge>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">New Value</span>
                <Badge className="bg-orange-600 hover:bg-orange-600 font-mono text-sm">
                  {newValue || "—"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Recommended:</span> Make this change in {sourceLabel}{" "}
              instead. It will automatically sync to Recouply.
            </p>
          </div>

          {/* Acknowledgment checkbox */}
          <div className="flex items-center space-x-2 p-3 border border-orange-200 dark:border-orange-800 rounded-lg">
            <Checkbox
              id="acknowledge-override"
              checked={acknowledgeChecked}
              onCheckedChange={(checked) => setAcknowledgeChecked(checked === true)}
            />
            <label
              htmlFor="acknowledge-override"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I understand this will be overwritten on next sync
            </label>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {integrationUrl && (
            <Button
              variant="outline"
              onClick={handleEditInSource}
              className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Edit in {sourceLabel}
            </Button>
          )}
          <Button
            onClick={handleOverride}
            disabled={!acknowledgeChecked}
            className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
          >
            Override Anyway
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Hook to manage override warning state
interface UseOverrideWarningOptions {
  integrationSource: string | null | undefined;
  integrationUrl?: string | null;
  invoiceId: string;
}

interface OverrideContext {
  fieldName: string;
  currentValue: string;
  newValue: string;
  onConfirm: () => Promise<void>;
}

export const useOverrideWarning = ({ integrationSource, integrationUrl, invoiceId }: UseOverrideWarningOptions) => {
  const [csvWarningOpen, setCsvWarningOpen] = useState(false);
  const [integrationWarningOpen, setIntegrationWarningOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [overrideContext, setOverrideContext] = useState<OverrideContext | null>(null);

  const checkAndProceed = async (
    fieldName: string,
    currentValue: string,
    newValue: string,
    action: () => Promise<void>
  ) => {
    // For Recouply manual invoices, proceed directly
    if (!integrationSource || integrationSource === "recouply_manual") {
      await action();
      return;
    }

    // For CSV imports, show soft warning once per session
    if (integrationSource === "csv_upload") {
      if (shouldShowCSVWarning()) {
        setOverrideContext({ fieldName, currentValue, newValue, onConfirm: action });
        setPendingAction(() => action);
        setCsvWarningOpen(true);
      } else {
        await action();
      }
      return;
    }

    // For integrated invoices (Stripe, QuickBooks, Xero), always show strong warning
    if (["stripe", "quickbooks", "xero"].includes(integrationSource)) {
      setOverrideContext({ fieldName, currentValue, newValue, onConfirm: action });
      setPendingAction(() => action);
      setIntegrationWarningOpen(true);
      return;
    }

    // Unknown source, proceed
    await action();
  };

  const handleCSVProceed = async () => {
    if (pendingAction) {
      await pendingAction();
    }
    setPendingAction(null);
    setOverrideContext(null);
  };

  const handleIntegrationProceed = async () => {
    if (pendingAction) {
      await pendingAction();
    }
    setPendingAction(null);
    setOverrideContext(null);
  };

  const CSVWarningDialog = () => (
    <CSVEditWarning
      open={csvWarningOpen}
      onOpenChange={setCsvWarningOpen}
      onProceed={handleCSVProceed}
    />
  );

  const IntegrationWarningDialog = () =>
    overrideContext ? (
      <IntegrationOverrideWarning
        open={integrationWarningOpen}
        onOpenChange={setIntegrationWarningOpen}
        onProceed={handleIntegrationProceed}
        integrationSource={integrationSource || ""}
        integrationUrl={integrationUrl}
        fieldName={overrideContext.fieldName}
        currentValue={overrideContext.currentValue}
        newValue={overrideContext.newValue}
      />
    ) : null;

  return {
    checkAndProceed,
    CSVWarningDialog,
    IntegrationWarningDialog,
    invoiceId,
  };
};

// Helper to log override and update invoice flags
export const logOverrideAndUpdateInvoice = async (
  supabase: any,
  invoiceId: string,
  userId: string,
  fieldName: string,
  originalValue: string | null,
  newValue: string,
  integrationSource: string | null | undefined
) => {
  // Insert override log
  await supabase.from("invoice_override_log").insert({
    invoice_id: invoiceId,
    user_id: userId,
    field_name: fieldName,
    original_value: originalValue,
    new_value: newValue,
    acknowledged_warning: true,
    integration_source: integrationSource,
  });

  // Update invoice override flags
  const { data: currentInvoice } = await supabase
    .from("invoices")
    .select("override_count")
    .eq("id", invoiceId)
    .single();

  await supabase
    .from("invoices")
    .update({
      has_local_overrides: true,
      override_count: (currentInvoice?.override_count || 0) + 1,
    })
    .eq("id", invoiceId);
};
