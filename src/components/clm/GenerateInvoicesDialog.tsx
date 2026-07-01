import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, FileEdit, Lock, FileText, AlertCircle } from "lucide-react";
import { formatDateShort } from "@/lib/formatters";

export type ScheduleSummary = {
  id: string;
  scheduled_date?: string | null;
  amount?: number | null;
  currency?: string | null;
  description?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: ScheduleSummary[];
  submitting?: boolean;
  onConfirm: (postingState: "draft" | "posted") => void | Promise<void>;
}

const money = (n: number | null | undefined, cur?: string | null) => {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
};

export const GenerateInvoicesDialog = ({
  open,
  onOpenChange,
  schedules,
  submitting,
  onConfirm,
}: Props) => {
  const [postingState, setPostingState] = useState<"draft" | "posted">("draft");

  const total = schedules.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const currency = schedules[0]?.currency || "USD";
  const count = schedules.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Review &amp; generate {count} invoice{count === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            These invoices will be created from the contract billing schedule. Choose whether to
            create them as editable drafts or lock them as posted.
          </DialogDescription>
        </DialogHeader>

        {/* Schedule summary */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2 max-h-52 overflow-y-auto">
          {schedules.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {s.description || "Contract billing"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.scheduled_date ? formatDateShort(s.scheduled_date) : "No date"}
                </div>
              </div>
              <div className="font-mono text-sm shrink-0">{money(s.amount, s.currency)}</div>
            </div>
          ))}
          {schedules.length > 8 && (
            <div className="text-xs text-muted-foreground pt-1 border-t">
              +{schedules.length - 8} more…
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t font-medium">
            <span>Total ({count} invoice{count === 1 ? "" : "s"})</span>
            <span className="font-mono">{money(total, currency)}</span>
          </div>
        </div>

        {/* Posting state chooser */}
        <RadioGroup
          value={postingState}
          onValueChange={(v) => setPostingState(v as "draft" | "posted")}
          className="space-y-2"
        >
          <label
            htmlFor="ps-draft"
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
              postingState === "draft" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
          >
            <RadioGroupItem value="draft" id="ps-draft" className="mt-1" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-medium text-sm">
                <FileEdit className="h-4 w-4 text-amber-600" />
                Draft — open to editing
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recommended. Review amounts, dates and descriptions in AR before finalizing. AI
                collection outreach will not start until posted.
              </p>
            </div>
          </label>

          <label
            htmlFor="ps-posted"
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
              postingState === "posted" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
          >
            <RadioGroupItem value="posted" id="ps-posted" className="mt-1" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Lock className="h-4 w-4 text-emerald-600" />
                Posted — locked
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Finalize immediately. Invoices become read-only, enter aging, and are eligible for
                automated outreach.
              </p>
            </div>
          </label>
        </RadioGroup>

        {postingState === "posted" && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Posted invoices cannot be edited from the invoice screen. You can unpost from the
              contract page if the AI made an error.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(postingState)} disabled={submitting || count === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {postingState === "draft" ? "Create as Draft" : "Create as Posted"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
