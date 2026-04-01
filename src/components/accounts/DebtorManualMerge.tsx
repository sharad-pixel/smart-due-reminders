import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Building2, Mail, DollarSign, FileText, Merge } from "lucide-react";
import { DebtorMergeDialog } from "./DebtorMergeDialog";

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

export function DebtorManualMerge({ open, onOpenChange, debtors, onMergeComplete }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMerge, setShowMerge] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    return debtors.filter(
      (d) =>
        d.company_name?.toLowerCase().includes(term) ||
        d.name?.toLowerCase().includes(term) ||
        d.email?.toLowerCase().includes(term) ||
        d.reference_id?.toLowerCase().includes(term)
    );
  }, [debtors, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDebtors = debtors.filter((d) => selected.has(d.id));

  const handleClose = () => {
    setSearch("");
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !showMerge} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Merge Accounts by Name / Email
            </DialogTitle>
            <DialogDescription>
              Search for accounts by name or email, select 2 or more to merge. Contacts with the same email will be deduplicated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or RAID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedDebtors.map((d) => (
                <Badge
                  key={d.id}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => toggle(d.id)}
                >
                  {d.company_name}
                  <span className="text-muted-foreground">×</span>
                </Badge>
              ))}
            </div>
          )}

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1.5">
              {search.trim() === "" ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Type a name or email to search accounts
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No accounts found matching "{search}"
                </p>
              ) : (
                filtered.map((d) => {
                  const isSelected = selected.has(d.id);
                  return (
                    <Card
                      key={d.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "hover:border-primary/30"
                      }`}
                      onClick={() => toggle(d.id)}
                    >
                      <CardContent className="py-2.5 px-3">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate">{d.company_name}</span>
                              <span className="text-xs text-muted-foreground">{d.reference_id}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              disabled={selected.size < 2}
              onClick={() => setShowMerge(true)}
              className="gap-2"
            >
              <Merge className="h-4 w-4" />
              Continue to Merge ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showMerge && selectedDebtors.length >= 2 && (
        <DebtorMergeDialog
          open={showMerge}
          onOpenChange={(o) => {
            setShowMerge(o);
            if (!o) setSelected(new Set());
          }}
          debtors={selectedDebtors}
          onMergeComplete={() => {
            setShowMerge(false);
            setSelected(new Set());
            handleClose();
            onMergeComplete();
          }}
        />
      )}
    </>
  );
}
