import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  AlertTriangle,
  Merge,
  Building2,
  Mail,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
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

interface DuplicateGroup {
  key: string;
  reason: string;
  confidence: "high" | "medium";
  debtors: Debtor[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtors: Debtor[];
  onMergeComplete: () => void;
}

function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function detectDuplicates(debtors: Debtor[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  // 1. Exact email match
  const emailMap = new Map<string, Debtor[]>();
  for (const d of debtors) {
    const email = normalize(d.email);
    if (!email) continue;
    if (!emailMap.has(email)) emailMap.set(email, []);
    emailMap.get(email)!.push(d);
  }
  for (const [email, dups] of emailMap) {
    if (dups.length < 2) continue;
    const key = `email:${email}`;
    groups.push({ key, reason: `Same email: ${dups[0].email}`, confidence: "high", debtors: dups });
    dups.forEach(d => seen.add(d.id));
  }

  // 2. Fuzzy company name match (normalized)
  const nameMap = new Map<string, Debtor[]>();
  for (const d of debtors) {
    const name = normalize(d.company_name);
    if (!name || name.length < 3) continue;
    if (!nameMap.has(name)) nameMap.set(name, []);
    nameMap.get(name)!.push(d);
  }
  for (const [, dups] of nameMap) {
    if (dups.length < 2) continue;
    // Skip if all already captured by email
    const newIds = dups.filter(d => !seen.has(d.id));
    if (newIds.length === 0 && dups.every(d => seen.has(d.id))) {
      // Check if this group is different from email groups
      const key = `name:${normalize(dups[0].company_name)}`;
      if (!groups.find(g => g.key === key)) {
        groups.push({ key, reason: `Same company name: ${dups[0].company_name}`, confidence: "high", debtors: dups });
      }
    } else {
      const key = `name:${normalize(dups[0].company_name)}`;
      groups.push({ key, reason: `Same company name: ${dups[0].company_name}`, confidence: "high", debtors: dups });
    }
    dups.forEach(d => seen.add(d.id));
  }

  // 3. Similar name match (first 6 chars)
  const prefixMap = new Map<string, Debtor[]>();
  for (const d of debtors) {
    if (seen.has(d.id)) continue;
    const name = normalize(d.company_name);
    if (!name || name.length < 6) continue;
    const prefix = name.substring(0, 6);
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(d);
  }
  for (const [, dups] of prefixMap) {
    if (dups.length < 2) continue;
    const key = `prefix:${normalize(dups[0].company_name).substring(0, 6)}`;
    groups.push({ key, reason: `Similar company name`, confidence: "medium", debtors: dups });
  }

  // Deduplicate groups
  const uniqueGroups: DuplicateGroup[] = [];
  const seenKeys = new Set<string>();
  for (const g of groups) {
    if (seenKeys.has(g.key)) continue;
    seenKeys.add(g.key);
    uniqueGroups.push(g);
  }

  return uniqueGroups.sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (b.confidence === "high" && a.confidence !== "high") return 1;
    return b.debtors.length - a.debtors.length;
  });
}

export function DebtorDuplicateDetector({ open, onOpenChange, debtors, onMergeComplete }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [showMerge, setShowMerge] = useState(false);

  const duplicateGroups = useMemo(() => detectDuplicates(debtors), [debtors]);

  const handleMergeGroup = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    setShowMerge(true);
  };

  return (
    <>
      <Dialog open={open && !showMerge} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Duplicate Account Detection
            </DialogTitle>
            <DialogDescription>
              Found {duplicateGroups.length} potential duplicate group{duplicateGroups.length !== 1 ? "s" : ""} across {debtors.length} accounts.
            </DialogDescription>
          </DialogHeader>

          {duplicateGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm font-medium">No duplicates detected</p>
              <p className="text-xs text-muted-foreground mt-1">Your account list looks clean!</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {duplicateGroups.map(group => (
                  <Card key={group.key} className="border-amber-200 dark:border-amber-800">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium">{group.reason}</span>
                          <Badge
                            variant="outline"
                            className={
                              group.confidence === "high"
                                ? "text-red-600 border-red-300 dark:text-red-400"
                                : "text-amber-600 border-amber-300 dark:text-amber-400"
                            }
                          >
                            {group.confidence} confidence
                          </Badge>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleMergeGroup(group)}>
                          <Merge className="h-3.5 w-3.5" />
                          Merge
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        {group.debtors.map(d => (
                          <div key={d.id} className="flex items-center justify-between text-xs p-2 bg-muted/40 rounded">
                            <div className="flex items-center gap-3 min-w-0">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{d.company_name}</span>
                              <span className="text-muted-foreground">{d.reference_id}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {d.email && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {d.email}
                                </span>
                              )}
                              <span className="font-medium">
                                ${(d.total_open_balance || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {showMerge && selectedGroup && (
        <DebtorMergeDialog
          open={showMerge}
          onOpenChange={(open) => {
            setShowMerge(open);
            if (!open) setSelectedGroup(null);
          }}
          debtors={selectedGroup.debtors}
          onMergeComplete={() => {
            setShowMerge(false);
            setSelectedGroup(null);
            onOpenChange(false);
            onMergeComplete();
          }}
        />
      )}
    </>
  );
}
