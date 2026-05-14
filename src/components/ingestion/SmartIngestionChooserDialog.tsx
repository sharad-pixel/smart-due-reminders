import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, FileSignature, ArrowRight } from "lucide-react";

interface SmartIngestionChooserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Asks the user whether they're ingesting Invoices or Contracts and routes
 * them to the correct AI Smart Ingestion pipeline.
 */
export const SmartIngestionChooserDialog = ({ open, onOpenChange }: SmartIngestionChooserDialogProps) => {
  const navigate = useNavigate();

  const choose = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Smart Ingestion</DialogTitle>
          <DialogDescription>
            What are you ingesting today? We'll route the document to the right AI pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <button
            type="button"
            onClick={() => choose("/data-center?tab=ingestion")}
            className="group text-left rounded-lg border bg-card p-4 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="p-2 rounded-md bg-emerald-50 text-emerald-600">
                <FileText className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="mt-3 font-semibold text-sm">Invoices &amp; AR docs</p>
            <p className="text-xs text-muted-foreground mt-1">
              Extract invoice numbers, amounts, due dates and customer details into your AR ledger.
            </p>
          </button>

          <button
            type="button"
            onClick={() => choose("/contracts/live")}
            className="group text-left rounded-lg border bg-card p-4 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="p-2 rounded-md bg-indigo-50 text-indigo-600">
                <FileSignature className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="mt-3 font-semibold text-sm">Contracts &amp; agreements</p>
            <p className="text-xs text-muted-foreground mt-1">
              Extract parties, term, value, renewal and key clauses into the CLM workspace.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmartIngestionChooserDialog;
