import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Merge, CheckCircle2, AlertTriangle, Building2, Mail, DollarSign, FileText } from "lucide-react";

interface Debtor {
  id: string;
  reference_id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  current_balance: number | null;
  total_open_balance: number | null;
  open_invoices_count: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtors: Debtor[];
  onMergeComplete: () => void;
}

export function DebtorMergeDialog({ open, onOpenChange, debtors, onMergeComplete }: Props) {
  const [primaryId, setPrimaryId] = useState<string | null>(debtors[0]?.id || null);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMerge = async () => {
    if (!primaryId) {
      toast.error("Select a primary account");
      return;
    }

    const duplicateIds = debtors.filter(d => d.id !== primaryId).map(d => d.id);
    if (duplicateIds.length === 0) {
      toast.error("Need at least 2 accounts to merge");
      return;
    }

    setMerging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("merge_debtors" as any, {
        p_primary_debtor_id: primaryId,
        p_duplicate_debtor_ids: duplicateIds,
        p_user_id: user.id,
      });

      if (error) throw error;

      const res = data as any;
      if (res?.success) {
        setResult(res);
        toast.success("Accounts merged successfully");
      } else {
        throw new Error(res?.error || "Merge failed");
      }
    } catch (err: any) {
      toast.error("Merge failed", { description: err.message });
    } finally {
      setMerging(false);
    }
  };

  const handleClose = () => {
    if (result) onMergeComplete();
    setResult(null);
    setPrimaryId(debtors[0]?.id || null);
    onOpenChange(false);
  };

  const primary = debtors.find(d => d.id === primaryId);
  const duplicates = debtors.filter(d => d.id !== primaryId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Accounts
          </DialogTitle>
          <DialogDescription>
            Select the primary account to keep. All invoices, payments, activities, and contacts from duplicate accounts will be moved to the primary account.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">Merge Complete</p>
                <p className="text-sm text-muted-foreground">All records have been consolidated.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Invoices Moved", value: result.invoices_moved },
                { label: "Payments Moved", value: result.payments_moved },
                { label: "Activities Moved", value: result.activities_moved },
                { label: "Contacts Moved", value: result.contacts_moved },
              ].map(stat => (
                <Card key={stat.label}>
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className="text-lg font-bold">{stat.value}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Primary Account (to keep)</p>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {debtors.map(d => {
                    const isPrimary = d.id === primaryId;
                    return (
                      <Card
                        key={d.id}
                        className={`cursor-pointer transition-all ${
                          isPrimary ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:border-primary/30"
                        }`}
                        onClick={() => setPrimaryId(d.id)}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                <p className="text-sm font-semibold truncate">{d.company_name}</p>
                                {isPrimary && <Badge className="text-xs bg-primary text-primary-foreground">Primary</Badge>}
                                {!isPrimary && <Badge variant="outline" className="text-xs text-destructive border-destructive/30">Will be merged</Badge>}
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {d.email || "No email"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${(d.total_open_balance || 0).toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {d.open_invoices_count || 0} invoices
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">RAID: {d.reference_id}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {duplicates.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-700 dark:text-amber-400">This action cannot be undone</p>
                    <p className="text-muted-foreground mt-0.5">
                      {duplicates.length} account{duplicates.length !== 1 ? "s" : ""} will be archived and all their records merged into <strong>{primary?.company_name}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleMerge}
                disabled={merging || !primaryId || duplicates.length === 0}
                className="gap-2"
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                Merge {duplicates.length + 1} Accounts
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
