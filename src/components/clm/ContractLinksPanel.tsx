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
import { Link2, Plus, Trash2, Crown, ExternalLink, Search, AlertTriangle, Replace, FileWarning } from "lucide-react";
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
  replacement: "Replacement",
  supersedes: "Supersedes (voids prior)",
};

const LINK_TYPE_TONE: Record<string, string> = {
  supplemental: "bg-slate-50 text-slate-700 border-slate-200",
  expansion: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amendment: "bg-amber-50 text-amber-700 border-amber-200",
  renewal: "bg-blue-50 text-blue-700 border-blue-200",
  sow: "bg-indigo-50 text-indigo-700 border-indigo-200",
  order_form: "bg-purple-50 text-purple-700 border-purple-200",
  addendum: "bg-pink-50 text-pink-700 border-pink-200",
  replacement: "bg-orange-50 text-orange-700 border-orange-200",
  supersedes: "bg-red-50 text-red-700 border-red-200",
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
  const [addPreset, setAddPreset] = useState<{
    role: "this_is_primary" | "this_is_child";
    linkType: string;
    title?: string;
  } | null>(null);

  // Current contract self (role/awaiting/superseded)
  const { data: selfRow } = useQuery({
    queryKey: ["lc-self", importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_imports")
        .select("id, primary_role, awaiting_primary, superseded_by_id, superseded_at, supersedes_reason, contract_name, file_name")
        .eq("id", importId)
        .maybeSingle();
      return data;
    },
  });

  // Resolve the superseding contract (if any)
  const { data: supersededBy } = useQuery({
    queryKey: ["lc-superseded-by", (selfRow as any)?.superseded_by_id],
    enabled: !!(selfRow as any)?.superseded_by_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_imports")
        .select("id, contract_name, file_name, effective_date")
        .eq("id", (selfRow as any).superseded_by_id)
        .maybeSingle();
      return data;
    },
  });

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
          .select("id, contract_name, file_name, contract_type, status, effective_date, term_end_date, contract_value, primary_role")
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

  const updateSelf = async (patch: Record<string, any>, successMsg = "Updated") => {
    const { error } = await supabase.from("live_contract_imports").update(patch).eq("id", importId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(successMsg);
    qc.invalidateQueries({ queryKey: ["lc-self", importId] });
    qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
    return true;
  };

  const onRoleChange = async (val: string) => {
    if (val === "supplemental_awaiting") {
      await updateSelf(
        { primary_role: "supplemental", awaiting_primary: true },
        "Flagged as supplemental — awaiting primary",
      );
    } else if (val === "supplemental") {
      await updateSelf({ primary_role: "supplemental", awaiting_primary: false });
    } else {
      await updateSelf({ primary_role: val, awaiting_primary: false });
    }
  };

  const clearSuperseded = async () => {
    if (!confirm("Restore this contract (clear superseded status)?")) return;
    await updateSelf(
      { superseded_by_id: null, superseded_at: null, supersedes_reason: null },
      "Contract restored",
    );
  };

  const openAdd = (preset: typeof addPreset) => {
    setAddPreset(preset);
    setAddOpen(true);
  };

  const links = data || [];
  const primaries = links.filter((l) => l.isPrimaryOf);
  const children = links.filter((l) => !l.isPrimaryOf);

  const self = selfRow as any;
  const roleValue =
    self?.awaiting_primary && self?.primary_role === "supplemental"
      ? "supplemental_awaiting"
      : self?.primary_role || (primaries.length > 0 ? "supplemental" : "primary");

  const isSuperseded = !!self?.superseded_by_id;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Contract Hierarchy
          <Badge variant="outline" className="text-[10px]">{links.length} linked</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => openAdd(null)}>
          <Plus className="h-3 w-3 mr-1" /> Link contract
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Superseded banner */}
        {isSuperseded && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <FileWarning className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900">
                  This contract has been superseded {self?.superseded_at ? `on ${formatDateShort(self.superseded_at)}` : ""}
                </p>
                {supersededBy && (
                  <p className="text-xs text-red-800 mt-0.5">
                    Replaced by{" "}
                    <Link to={`/contracts/live/${(supersededBy as any).id}`} className="underline font-medium">
                      {(supersededBy as any).contract_name || (supersededBy as any).file_name}
                    </Link>
                  </p>
                )}
                {self?.supersedes_reason && (
                  <p className="text-xs text-red-800 mt-1 italic">"{self.supersedes_reason}"</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSuperseded}>
                Restore
              </Button>
            </div>
          </div>
        )}

        {/* Role flag */}
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Contract role
          </label>
          <Select value={roleValue} onValueChange={onRoleChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">
                <span className="flex items-center gap-1.5"><Crown className="h-3 w-3 text-amber-600" /> Primary contract</span>
              </SelectItem>
              <SelectItem value="supplemental">Supplemental / expansion (primary already loaded)</SelectItem>
              <SelectItem value="supplemental_awaiting">⚠ Supplemental — primary not yet uploaded</SelectItem>
              <SelectItem value="standalone">Standalone (no related contracts)</SelectItem>
            </SelectContent>
          </Select>

          {/* Awaiting primary alert */}
          {self?.awaiting_primary && primaries.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 mt-2 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-900">Primary contract missing</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    This contract was flagged as a supplemental/expansion. Upload or link the master contract so AI
                    extraction, ECL, and renewal logic see the full picture.
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => openAdd({ role: "this_is_child", linkType: "supplemental", title: "Link existing primary contract" })}
                >
                  Link existing primary
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link to="/contracts">
                    <Plus className="h-3 w-3 mr-1" /> Upload primary
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

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
              {primaries.length === 0 && !self?.awaiting_primary && <Crown className="h-3 w-3 text-amber-600" />}
              {primaries.length === 0 && !self?.awaiting_primary ? "This is the primary contract" : "Also linked"} · {children.length} related
            </p>
            {children.length === 0 && primaries.length === 0 && !self?.awaiting_primary && (
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

        {/* Rip-and-replace / supersede actions */}
        {!isSuperseded && (
          <div className="border-t pt-3 flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => openAdd({ role: "this_is_primary", linkType: "renewal", title: "Link renewal contract" })}
            >
              <Replace className="h-3 w-3 mr-1" /> Add renewal
            </Button>
            <ReplaceContractButton importId={importId} accountId={accountId} debtorId={debtorId} onDone={() => {
              qc.invalidateQueries({ queryKey: ["lc-self", importId] });
              qc.invalidateQueries({ queryKey: ["lc-links", importId] });
            }} />
          </div>
        )}
      </CardContent>

      <AddLinkDialog
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setAddPreset(null); }}
        importId={importId}
        accountId={accountId}
        debtorId={debtorId}
        excludeIds={[
          importId,
          ...links.map((l) => (l.direction === "out" ? l.linked_import_id : l.primary_import_id)),
        ]}
        preset={addPreset}
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

const ReplaceContractButton = ({
  importId,
  accountId,
  debtorId,
  onDone,
}: {
  importId: string;
  accountId: string;
  debtorId: string | null;
  onDone: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ["lc-replace-candidates", accountId, debtorId, query, importId],
    enabled: open && !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("live_contract_imports")
        .select("id, contract_name, file_name, contract_type, effective_date")
        .eq("account_id", accountId)
        .neq("id", importId)
        .is("superseded_by_id", null)
        .order("created_at", { ascending: false })
        .limit(40);
      if (debtorId) q = q.eq("debtor_id", debtorId);
      if (query.trim()) {
        const term = `%${query.trim()}%`;
        q = q.or(`contract_name.ilike.${term},file_name.ilike.${term}`);
      }
      const { data } = await q;
      return data || [];
    },
  });

  const apply = async () => {
    if (!pickedId) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not signed in");

      // 1) Mark old contract as superseded
      const { error: e1 } = await supabase
        .from("live_contract_imports")
        .update({
          superseded_by_id: pickedId,
          superseded_at: new Date().toISOString(),
          supersedes_reason: reason.trim() || "Replaced by newer contract",
        })
        .eq("id", importId);
      if (e1) throw e1;

      // 2) Create explicit supersedes link (new primary -> old contract)
      const { error: e2 } = await supabase.from("live_contract_links" as any).insert({
        account_id: accountId,
        primary_import_id: pickedId,
        linked_import_id: importId,
        link_type: "supersedes",
        notes: reason.trim() || null,
        created_by: uid,
      });
      if (e2 && (e2 as any).code !== "23505") throw e2;

      toast.success("Contract replaced and marked superseded");
      onDone();
      setOpen(false);
      setPickedId(null);
      setReason("");
      setQuery("");
    } catch (e: any) {
      toast.error(e?.message || "Replace failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 text-xs text-red-700 border-red-200 hover:bg-red-50" onClick={() => setOpen(true)}>
        <FileWarning className="h-3 w-3 mr-1" /> Rip & replace
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Replace this contract</DialogTitle>
            <DialogDescription>
              Mark this contract as <strong>superseded</strong> by a newer one. The prior agreement is voided for AI
              workflows and ECL calculations, but stays on file for audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Find replacement contract</label>
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
                  <p className="text-xs text-muted-foreground p-3">No matching contracts. Upload the replacement first.</p>
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
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Reason / notes</label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Master MSA replaces all prior order forms effective Jan 2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={apply} disabled={!pickedId || saving} className="bg-red-600 hover:bg-red-700">
              {saving ? "Replacing…" : "Mark as superseded"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AddLinkDialog = ({
  open,
  onOpenChange,
  importId,
  accountId,
  debtorId,
  excludeIds,
  preset,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  importId: string;
  accountId: string;
  debtorId: string | null;
  excludeIds: string[];
  preset: { role: "this_is_primary" | "this_is_child"; linkType: string; title?: string } | null;
  onAdded: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [role, setRole] = useState<"this_is_primary" | "this_is_child">(preset?.role ?? "this_is_primary");
  const [linkType, setLinkType] = useState(preset?.linkType ?? "supplemental");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-sync when preset changes
  useState(() => {
    if (preset) {
      setRole(preset.role);
      setLinkType(preset.linkType);
    }
  });

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

      // If user just linked an existing primary to this awaiting supplemental, clear the awaiting flag.
      if (role === "this_is_child") {
        await supabase.from("live_contract_imports").update({ awaiting_primary: false }).eq("id", importId);
      }

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
          <DialogTitle>{preset?.title || "Link a contract"}</DialogTitle>
          <DialogDescription>
            Connect supplemental, expansion, SOW, amendment, renewal, addendum, or replacement contracts to keep the
            full commercial picture in one workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Relationship</label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_is_primary">This is the primary — add a supplemental/expansion/renewal</SelectItem>
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
