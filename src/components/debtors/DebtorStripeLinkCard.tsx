import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Link2, Link2Off, Search, Plus, ExternalLink } from "lucide-react";
import { useStripeConnected } from "@/hooks/useStripeConnected";

interface Props {
  debtorId: string;
  debtorName: string;
  debtorEmail?: string | null;
  stripeCustomerId?: string | null;
  onChanged?: () => void;
}

interface Candidate {
  id: string;
  email: string | null;
  name: string | null;
  taken_by: string | null;
}

export function DebtorStripeLinkCard({
  debtorId,
  debtorName,
  debtorEmail,
  stripeCustomerId,
  onChanged,
}: Props) {
  const { connected, loading: stripeLoading } = useStripeConnected();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(debtorEmail || debtorName || "");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (stripeLoading) return null;
  if (!connected) return null;

  const invoke = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("link-debtor-to-stripe", {
      body: { debtor_id: debtorId, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const runSearch = async () => {
    setSearching(true);
    try {
      const data = await invoke({ action: "search", query });
      setCandidates(data.candidates || []);
      if (!data.candidates?.length) toast.info("No Stripe customers matched");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const linkExisting = async (id: string) => {
    setBusyId(id);
    try {
      await invoke({ action: "link", stripe_customer_id: id });
      toast.success("Linked to Stripe customer");
      setOpen(false);
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link failed");
    } finally {
      setBusyId(null);
    }
  };

  const createNew = async (force = false) => {
    setCreating(true);
    try {
      const data = await invoke({
        action: "create",
        email: debtorEmail,
        name: debtorName,
        force_create: force,
      });
      if (data?.duplicate && !force) {
        const proceed = window.confirm(
          `A Stripe customer already exists with this email (${data.candidate.email}). Link that customer instead? Click Cancel to create a duplicate anyway.`,
        );
        if (proceed) {
          await linkExisting(data.candidate.id);
        } else {
          await createNew(true);
        }
        return;
      }
      toast.success("Stripe customer created and linked");
      setOpen(false);
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm("Unlink this account from its Stripe customer?")) return;
    try {
      await invoke({ action: "unlink" });
      toast.success("Unlinked");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlink failed");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Stripe Customer
            </span>
            {stripeCustomerId ? (
              <Badge variant="secondary">Linked</Badge>
            ) : (
              <Badge variant="outline">Not linked</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stripeCustomerId ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <code className="px-2 py-1 rounded bg-muted">{stripeCustomerId}</code>
              <a
                href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open in Stripe <ExternalLink className="h-3 w-3" />
              </a>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={unlink}>
                <Link2Off className="h-4 w-4 mr-1" /> Unlink
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Link this account to a Stripe customer to sync invoices and prevent duplicates.
              </p>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Link2 className="h-4 w-4 mr-1" /> Link Stripe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link to Stripe Customer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by email, name, or cus_… id"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              <Button onClick={runSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Search for an existing Stripe customer, or create a new one below.
                </div>
              ) : (
                candidates.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name || "(no name)"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.email || "no email"} · {c.id}
                      </div>
                      {c.taken_by && (
                        <div className="text-xs text-amber-600 mt-1">
                          Already linked to “{c.taken_by}”
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={c.taken_by ? "outline" : "default"}
                      disabled={!!c.taken_by || busyId === c.id}
                      onClick={() => linkExisting(c.id)}
                    >
                      {busyId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Link"
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Duplicates are prevented by email match and per-account uniqueness.
            </div>
            <Button variant="secondary" onClick={() => createNew(false)} disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create new in Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
