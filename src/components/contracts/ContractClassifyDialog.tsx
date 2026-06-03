import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Crown, Layers, Replace, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importId: string;
  accountId: string;
  debtorId: string | null;
  contractName?: string | null;
}

type Role = "primary" | "supplemental" | "replacement";

const OPTIONS: { value: Role; title: string; desc: string; icon: any; tone: string }[] = [
  {
    value: "primary",
    title: "Primary contract",
    desc: "Defines the full term, scope, and commercial baseline.",
    icon: Crown,
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    value: "supplemental",
    title: "Supplemental / Expansion",
    desc: "Adds to an existing primary contract (SOW, order form, amendment, expansion).",
    icon: Layers,
    tone: "border-blue-200 bg-blue-50 text-blue-900",
  },
  {
    value: "replacement",
    title: "Replacement / Supersedes",
    desc: "Rip-and-replace — voids one or more prior contracts effective on signature.",
    icon: Replace,
    tone: "border-red-200 bg-red-50 text-red-900",
  },
];

export function ContractClassifyDialog({
  open, onOpenChange, importId, accountId, debtorId, contractName,
}: Props) {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  const [query, setQuery] = useState("");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [replaceIds, setReplaceIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ["lc-classify-candidates", accountId, debtorId, query, importId],
    enabled: open && !!accountId && role !== "primary" && role !== null,
    queryFn: async () => {
      let q = supabase
        .from("live_contract_imports")
        .select("id, contract_name, file_name, contract_type, effective_date, superseded_by_id")
        .eq("account_id", accountId)
        .neq("id", importId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (debtorId) q = q.eq("debtor_id", debtorId);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`contract_name.ilike.${term},file_name.ilike.${term}`);
      }
      const { data } = await q;
      // Hide already-superseded contracts from the picker
      return (data || []).filter((r: any) => !r.superseded_by_id);
    },
  });

  const goToReview = () => {
    onOpenChange(false);
    navigate(`/ai-ingestion/${importId}`);
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not signed in");

      if (role === "primary") {
        const { error } = await supabase
          .from("live_contract_imports")
          .update({ primary_role: "primary", awaiting_primary: false })
          .eq("id", importId);
        if (error) throw error;
        toast.success("Flagged as primary contract");
      }

      if (role === "supplemental") {
        const { error: e1 } = await supabase
          .from("live_contract_imports")
          .update({
            primary_role: "supplemental",
            awaiting_primary: !linkedId, // awaiting if no primary picked
          })
          .eq("id", importId);
        if (e1) throw e1;

        if (linkedId) {
          const { error: e2 } = await supabase.from("live_contract_links" as any).insert({
            account_id: accountId,
            primary_import_id: linkedId,
            linked_import_id: importId,
            link_type: "supplemental",
            notes: reason.trim() || null,
            created_by: uid,
          });
          if (e2 && (e2 as any).code !== "23505") throw e2;
          toast.success("Linked to primary contract");
        } else {
          toast.success("Saved — flagged as supplemental awaiting primary upload");
        }
      }

      if (role === "replacement") {
        if (replaceIds.length === 0) {
          throw new Error("Pick at least one contract this replaces");
        }
        // Mark this contract as primary
        const { error: e1 } = await supabase
          .from("live_contract_imports")
          .update({ primary_role: "primary", awaiting_primary: false })
          .eq("id", importId);
        if (e1) throw e1;

        // For each replaced contract: mark superseded + create supersedes link
        for (const rid of replaceIds) {
          const { error: eS } = await supabase
            .from("live_contract_imports")
            .update({
              superseded_by_id: importId,
              superseded_at: new Date().toISOString(),
              supersedes_reason: reason.trim() || "Replaced by newer contract",
            })
            .eq("id", rid);
          if (eS) throw eS;

          const { error: eL } = await supabase.from("live_contract_links" as any).insert({
            account_id: accountId,
            primary_import_id: importId,
            linked_import_id: rid,
            link_type: "supersedes",
            notes: reason.trim() || null,
            created_by: uid,
          });
          if (eL && (eL as any).code !== "23505") throw eL;
        }
        toast.success(`Replaced ${replaceIds.length} prior contract${replaceIds.length > 1 ? "s" : ""}`);
      }

      goToReview();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleReplace = (id: string) => {
    setReplaceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (saving) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Classify this contract</DialogTitle>
          <DialogDescription>
            {contractName ? <><strong>{contractName}</strong> — </> : null}
            How does this contract relate to others on file? This drives ECL, renewals, and AI workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setRole(opt.value);
                  setLinkedId(null);
                  setReplaceIds([]);
                }}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition flex gap-3",
                  active ? opt.tone + " ring-2 ring-offset-1 ring-current" : "hover:bg-muted/50",
                )}
              >
                <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{opt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {(role === "supplemental" || role === "replacement") && (
          <div className="space-y-2 border-t pt-3">
            <label className="text-xs font-medium">
              {role === "supplemental"
                ? "Pick the primary contract this supplements (optional)"
                : "Pick the contract(s) this replaces"}
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-7 h-9"
                placeholder={debtorId ? "Search this customer's contracts…" : "Search contracts…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
              {(candidates || []).length === 0 && (
                <p className="text-xs text-muted-foreground p-3">
                  {role === "supplemental"
                    ? "No existing contracts found. You can save and link the primary later — this contract will be flagged as awaiting primary."
                    : "No prior contracts found to replace."}
                </p>
              )}
              {(candidates || []).map((c: any) => {
                const isPicked = role === "supplemental" ? linkedId === c.id : replaceIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => (role === "supplemental" ? setLinkedId(c.id) : toggleReplace(c.id))}
                    className={cn(
                      "w-full text-left p-2 text-sm hover:bg-muted flex items-start gap-2",
                      isPicked && "bg-primary/10",
                    )}
                  >
                    {role === "replacement" && (
                      <input type="checkbox" checked={isPicked} readOnly className="mt-1" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.contract_name || c.file_name}</div>
                      <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                        {c.contract_type && <span>{c.contract_type}</span>}
                        {c.effective_date && <span>{formatDateShort(c.effective_date)}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                role === "supplemental"
                  ? "Notes (optional) — e.g. Adds 50 seats from May 2026"
                  : "Reason — e.g. Master MSA replaces all prior order forms effective Jan 2026"
              }
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={goToReview} disabled={saving}>
            Skip for now
          </Button>
          <Button
            onClick={save}
            disabled={
              !role ||
              saving ||
              (role === "replacement" && replaceIds.length === 0)
            }
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save & continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContractClassifyDialog;
