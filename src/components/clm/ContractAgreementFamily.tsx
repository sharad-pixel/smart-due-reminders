import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Link2, Unlink, GitBranch, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DocumentTypeBadge } from "./DocumentTypeBadge";

interface ImportRow {
  id: string;
  file_name: string | null;
  contract_name: string | null;
  document_type: string | null;
  agreement_number: string | null;
  parent_import_id: string | null;
}

interface Props {
  importId: string;
  accountId: string;
  debtorId?: string | null;
}

/**
 * Agreement family tree — shows the parent MSA (if any) and every sibling
 * document (Order Forms, Amendments, SOWs, Renewals) that references the
 * same parent. Lets the user (re)link a document to its parent MSA.
 */
export const ContractAgreementFamily = ({ importId, accountId, debtorId }: Props) => {
  const [self, setSelf] = useState<ImportRow | null>(null);
  const [parent, setParent] = useState<ImportRow | null>(null);
  const [siblings, setSiblings] = useState<ImportRow[]>([]);
  const [children, setChildren] = useState<ImportRow[]>([]);
  const [candidates, setCandidates] = useState<ImportRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    // Current row
    const { data: me } = await supabase
      .from("live_contract_imports")
      .select("id, file_name, contract_name, document_type, agreement_number, parent_import_id")
      .eq("id", importId)
      .maybeSingle();
    if (!me) return;
    setSelf(me as ImportRow);

    // Parent
    if ((me as any).parent_import_id) {
      const { data: p } = await supabase
        .from("live_contract_imports")
        .select("id, file_name, contract_name, document_type, agreement_number, parent_import_id")
        .eq("id", (me as any).parent_import_id)
        .maybeSingle();
      setParent(p as ImportRow | null);
    } else {
      setParent(null);
    }

    // Siblings — same parent, excluding self
    if ((me as any).parent_import_id) {
      const { data: sibs } = await supabase
        .from("live_contract_imports")
        .select("id, file_name, contract_name, document_type, agreement_number, parent_import_id")
        .eq("parent_import_id", (me as any).parent_import_id)
        .neq("id", importId)
        .order("created_at", { ascending: true });
      setSiblings((sibs as any) || []);
    } else {
      setSiblings([]);
    }

    // Children — documents pointing to me as parent
    const { data: kids } = await supabase
      .from("live_contract_imports")
      .select("id, file_name, contract_name, document_type, agreement_number, parent_import_id")
      .eq("parent_import_id", importId)
      .order("created_at", { ascending: true });
    setChildren((kids as any) || []);

    // Candidates for parent picker — MSAs/PSAs in the same account, or same debtor
    let q = supabase
      .from("live_contract_imports")
      .select("id, file_name, contract_name, document_type, agreement_number, parent_import_id")
      .eq("account_id", accountId)
      .in("document_type", ["msa", "professional_services_agreement"])
      .neq("id", importId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (debtorId) q = q.eq("debtor_id", debtorId);
    const { data: cands } = await q;
    setCandidates((cands as any) || []);
  };

  useEffect(() => {
    if (importId && accountId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId, accountId, debtorId]);

  const setParentId = async (parentId: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("live_contract_imports")
        .update({ parent_import_id: parentId } as any)
        .eq("id", importId);
      if (error) throw error;
      toast.success(parentId ? "Linked to parent agreement" : "Parent link removed");
      setPickerOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update parent");
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (r: ImportRow) =>
    r.contract_name || r.file_name || "Untitled document";

  // Only show the panel once we have data
  if (!self) return null;

  // If this doc IS a top-level agreement (MSA/PSA) with no parent AND no children,
  // showing an empty family panel adds noise — skip.
  const isTopLevel =
    ["msa", "professional_services_agreement"].includes(self.document_type || "");
  if (isTopLevel && !parent && children.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" /> Agreement Family
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Documents grouped by their parent Master Service Agreement.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Parent slot */}
        <div className="rounded-md border p-3 bg-muted/30">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            Parent Agreement
          </div>
          {parent ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DocumentTypeBadge type={parent.document_type} />
                  <Link
                    to={`/ai-ingestion/${parent.id}`}
                    className="text-sm font-medium truncate hover:underline"
                  >
                    {nameOf(parent)}
                  </Link>
                </div>
                {parent.agreement_number && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    #{parent.agreement_number}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                  <Link to={`/ai-ingestion/${parent.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive"
                  onClick={() => setParentId(null)}
                  disabled={saving}
                  title="Unlink from parent"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ) : isTopLevel ? (
            <div className="text-xs text-muted-foreground italic">
              This is a top-level agreement — no parent needed.
            </div>
          ) : (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-8 text-xs"
                  disabled={saving}
                >
                  <span className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Link to a parent Master Agreement…
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[480px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name or agreement #…" />
                  <CommandList>
                    <CommandEmpty>
                      No MSA/PSA candidates found for this customer.
                    </CommandEmpty>
                    <CommandGroup>
                      {candidates.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${nameOf(c)} ${c.agreement_number || ""}`}
                          onSelect={() => setParentId(c.id)}
                          className="text-xs"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <DocumentTypeBadge type={c.document_type} hideIcon />
                            <span className="truncate">{nameOf(c)}</span>
                            {c.agreement_number && (
                              <span className="text-muted-foreground text-[10px] ml-auto">
                                #{c.agreement_number}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Current document (self) */}
        <div className="rounded-md border-2 border-primary/40 p-3 bg-primary/5">
          <div className="text-[10px] uppercase tracking-wide text-primary mb-1.5">
            This document
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DocumentTypeBadge type={self.document_type} />
            <span className="text-sm font-medium truncate">{nameOf(self)}</span>
            {self.agreement_number && (
              <span className="text-xs text-muted-foreground">
                #{self.agreement_number}
              </span>
            )}
          </div>
        </div>

        {/* Siblings (same parent) */}
        {siblings.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Related documents under the same parent ({siblings.length})
            </div>
            <div className="space-y-1.5">
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  to={`/ai-ingestion/${s.id}`}
                  className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 transition-colors"
                >
                  <DocumentTypeBadge type={s.document_type} />
                  <span className="text-xs font-medium truncate flex-1">{nameOf(s)}</span>
                  {s.agreement_number && (
                    <span className="text-[10px] text-muted-foreground">#{s.agreement_number}</span>
                  )}
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Children (docs that reference this one as parent) */}
        {children.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Documents attached to this agreement ({children.length})
            </div>
            <div className="space-y-1.5">
              {children.map((k) => (
                <Link
                  key={k.id}
                  to={`/ai-ingestion/${k.id}`}
                  className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 transition-colors"
                >
                  <DocumentTypeBadge type={k.document_type} />
                  <span className="text-xs font-medium truncate flex-1">{nameOf(k)}</span>
                  {k.agreement_number && (
                    <span className="text-[10px] text-muted-foreground">#{k.agreement_number}</span>
                  )}
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractAgreementFamily;
