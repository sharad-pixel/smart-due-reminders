import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link2, Plus, Trash2, Crown, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatters";

const LINK_TYPE_LABELS: Record<string, string> = {
  supplemental: "Supplemental",
  expansion: "Expansion",
  amendment: "Amendment",
  renewal: "Renewal",
  sow: "SOW",
  order_form: "Order Form",
  addendum: "Addendum",
};

const LINK_TYPE_TONE: Record<string, string> = {
  supplemental: "bg-slate-50 text-slate-700 border-slate-200",
  expansion: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amendment: "bg-amber-50 text-amber-700 border-amber-200",
  renewal: "bg-blue-50 text-blue-700 border-blue-200",
  sow: "bg-indigo-50 text-indigo-700 border-indigo-200",
  order_form: "bg-purple-50 text-purple-700 border-purple-200",
  addendum: "bg-pink-50 text-pink-700 border-pink-200",
};

interface Props {
  importId: string;
  accountId: string;
  debtorId: string | null;
  isPrimaryHint?: boolean;
}

export const ContractLinksPanel = ({ importId, accountId, debtorId }: Props) => {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  // Anything connected to this contract, in either direction.
  const { data, isLoading } = useQuery({
    queryKey: ["lc-links", importId],
    queryFn: async () => {
      const [outgoing, incoming] = await Promise.all([
        supabase
          .from("live_contract_links" as any)
          .select("*")
          .eq("primary_import_id", importId),
        supabase
          .from("live_contract_links" as any)
          .select("*")
          .eq("linked_import_id", importId),
      ]);
      const rows = [
        ...((outgoing.data as any[]) || []).map((r) => ({ ...r, direction: "out" as const })),
        ...((incoming.data as any[]) || []).map((r) => ({ ...r, direction: "in" as const })),
      ];
      const otherIds = Array.from(new Set(rows.map((r) => (r.direction === "out" ? r.linked_import_id : r.primary_import_id))));
      let others: any[] = [];
      if (otherIds.length) {
        const { data: imps } = await supabase
          .from("live_contract_imports")
          .select("id, contract_name, file_name, contract_type, status, effective_date, term_end_date, contract_value")
          .in("id", otherIds);
        others = imps || [];
      }
      const byId = new Map(others.map((o) => [o.id, o]));
      return rows.map((r) => ({
        ...r,
        other: byId.get(r.direction === "out" ? r.linked_import_id : r.primary_import_id),
        isPrimaryOf: r.direction === "in", // an incoming row means the OTHER contract was declared primary
      }));
    },
    enabled: !!importId,
  });

  const remove = async (id: string) => {
    if (!confirm("Remove this link?")) return;
    const { error } = await supabase.from("live_contract_links" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Link removed");
      qc.invalidateQueries({ queryKey: ["lc-links", importId] });
    }
  };

  const links = data || [];
  const primaries = links.filter((l) => l.isPrimaryOf);
  const children = links.filter((l) => !l.isPrimaryOf);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Linked Contracts
          <Badge variant="outline" className="text-[10px]">{links.length}</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Link contract
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

        {!isLoading && primaries.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              This contract is a {LINK_TYPE_LABELS[primaries[0]?.link_type] || "supplemental"} of:
            </p>
            {primaries.map((l) => (
              <LinkRow key={l.id} l={l} onRemove={remove} primaryBadge />
            ))}
          </div>
        )}

        {!isLoading && (primaries.length === 0 || children.length > 0) && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              {primaries.length === 0 && <Crown className="h-3 w-3 text-amber-600" />}
              {primaries.length === 0 ? "This is the primary contract" : "Also linked"} · {children.length} related
            </p>
            {children.length === 0 && primaries.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No supplemental contracts linked yet. Link expansions, SOWs, amendments, or renewals to keep the full
                commercial picture in one place.
              </p>
            )}
            {children.map((l) => (
              <LinkRow key={l.id} l={l} onRemove={remove} />
            ))}
          </div>
        )}
      </CardContent>

      <AddLinkDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        importId={importId}
        accountId={accountId}
        debtorId={debtorId}
        excludeIds={[
          importId,
          ...links.map((l) => (l.direction === "out" ? l.linked_import_id : l.primary_import_id)),
        ]}
        onAdded={() => qc.invalidateQueries({ queryKey: ["lc-links", importId] })}
      />
    </Card>
  );
};

const LinkRow = ({
  l,
  onRemove,
  primaryBadge,
}: {
  l: any;
  onRemove: (id: string) => void;
  primaryBadge?: boolean;
}) => {
  const o = l.other;
  return (
    <div className="rounded-md border p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {primaryBadge && <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
          <span className="font-medium text-sm truncate">{o?.contract_name || o?.file_name || "Untitled"}</span>
          <Badge variant="outline" className={`text-[10px] ${LINK_TYPE_TONE[l.link_type] || ""}`}>
            {LINK_TYPE_LABELS[l.link_type] || l.link_type}
          </Badge>
          {o?.status && (
            <Badge variant="outline" className="text-[10px] capitalize">{String(o.status).replace(/_/g, " ")}</Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
          {o?.contract_type && <span>{o.contract_type}</span>}
          {o?.effective_date && <span>From {formatDateShort(o.effective_date)}</span>}
          {o?.term_end_date && <span>To {formatDateShort(o.term_end_date)}</span>}
        </div>
        {l.notes && <p className="text-xs text-muted-foreground mt-1">{l.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {o?.id && (
          <Button asChild size="sm" variant="ghost" className="h-7 px-2">
            <Link to={`/contracts/live/${o.id}`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => onRemove(l.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

const AddLinkDialog = ({
  open,
  onOpenChange,
  importId,
  accountId,
  debtorId,
  excludeIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  importId: string;
  accountId: string;
  debtorId: string | null;
  excludeIds: string[];
  onAdded: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [role, setRole] = useState<"this_is_primary" | "this_is_child">("this_is_primary");
  const [linkType, setLinkType] = useState("supplemental");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ["lc-link-candidates", accountId, debtorId, query],
    enabled: open && !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("live_contract_imports")
        .select("id, contract_name, file_name, contract_type, status, effective_date, debtor_id")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (debtorId) q = q.eq("debtor_id", debtorId);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`contract_name.ilike.${term},file_name.ilike.${term}`);
      }
      const { data } = await q;
      return (data || []).filter((r) => !excludeIds.includes(r.id));
    },
  });

  const save = async () => {
    if (!pickedId) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not signed in");

      const primary_import_id = role === "this_is_primary" ? importId : pickedId;
      const linked_import_id = role === "this_is_primary" ? pickedId : importId;

      const { error } = await supabase.from("live_contract_links" as any).insert({
        account_id: accountId,
        primary_import_id,
        linked_import_id,
        link_type: linkType,
        notes: notes.trim() || null,
        created_by: uid,
      });
      if (error) throw error;
      toast.success("Contract linked");
      onAdded();
      onOpenChange(false);
      setPickedId(null);
      setNotes("");
      setQuery("");
    } catch (e: any) {
      toast.error(e?.message || "Link failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Link a contract</DialogTitle>
          <DialogDescription>
            Connect supplemental, expansion, SOW, amendment, renewal, or addendum contracts to keep the full commercial
            picture in one workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Relationship</label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_is_primary">This is the primary — add a supplemental/expansion</SelectItem>
                <SelectItem value="this_is_child">This is a supplemental — pick its primary contract</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Link type</label>
            <Select value={linkType} onValueChange={setLinkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LINK_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Find contract</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-7"
                placeholder={debtorId ? "Search this customer's contracts…" : "Search contracts…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="border rounded-md max-h-60 overflow-y-auto divide-y mt-1">
              {(candidates || []).length === 0 && (
                <p className="text-xs text-muted-foreground p-3">No matching contracts.</p>
              )}
              {(candidates || []).map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPickedId(c.id)}
                  className={`w-full text-left p-2 text-sm hover:bg-muted ${pickedId === c.id ? "bg-primary/10" : ""}`}
                >
                  <div className="font-medium truncate">{c.contract_name || c.file_name}</div>
                  <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                    {c.contract_type && <span>{c.contract_type}</span>}
                    {c.effective_date && <span>{formatDateShort(c.effective_date)}</span>}
                    {c.status && <span className="capitalize">{String(c.status).replace(/_/g, " ")}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Notes (optional)</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Adds 50 seats from May 2026" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={!pickedId || saving}>{saving ? "Linking…" : "Link contract"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContractLinksPanel;
