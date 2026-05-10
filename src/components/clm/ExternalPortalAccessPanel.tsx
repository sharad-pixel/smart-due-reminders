import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, RefreshCw, Trash2, Copy, Plus, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface Props {
  instanceId: string;
}

const PORTAL_BASE = "https://recouply.ai/clm-portal";

export const ExternalPortalAccessPanel = ({ instanceId }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("editor_approver");
  const [duration, setDuration] = useState("30d"); // 1h | 12h | 24h (session) | 7d | 14d | 30d | 60d | 90d
  const [busy, setBusy] = useState(false);

  const durationToBody = (d: string): { expires_in_hours?: number; expires_in_days?: number } => {
    if (d.endsWith("h")) return { expires_in_hours: Number(d.slice(0, -1)) };
    return { expires_in_days: Number(d.slice(0, -1)) };
  };

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["clm-external-access", instanceId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("clm_external_access" as any) as any)
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["clm-external-access", instanceId] });

  const invite = async () => {
    const t = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return toast.error("Enter a valid email");
    setBusy(true);
    const { error } = await supabase.functions.invoke("clm-invite-external", {
      body: { action: "invite", instance_id: instanceId, email: t, name: name.trim() || null, role, ...durationToBody(duration) },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Secure portal link emailed to ${t}`);
    setEmail(""); setName(""); setRole("editor_approver"); setDuration("30d"); setOpen(false);
    refresh();
  };

  const renew = async (id: string) => {
    const { error } = await supabase.functions.invoke("clm-invite-external", {
      body: { action: "renew", id, expires_in_days: 30 },
    });
    if (error) return toast.error(error.message);
    toast.success("Token rotated and re-sent");
    refresh();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this access? The portal link will stop working immediately.")) return;
    const { error } = await supabase.functions.invoke("clm-invite-external", {
      body: { action: "revoke", id },
    });
    if (error) return toast.error(error.message);
    toast.success("Access revoked");
    refresh();
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${PORTAL_BASE}?token=${token}`);
    toast.success("Portal link copied");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> External Portal Access
        </CardTitle>
        <CardDescription>
          Issue secure, expiring portal tokens for outside parties (legal, counterparty). They access this workspace through a magic-link email — no account needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-2">No portal invites issued yet.</p>
        ) : (
          <div className="space-y-1.5">
            {tokens.map((t: any) => {
              const expired = new Date(t.expires_at) < new Date();
              const status = t.revoked_at ? "revoked" : expired ? "expired" : "active";
              const tone =
                status === "active"
                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                  : status === "expired"
                  ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-700 border-rose-500/30";
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium truncate">{t.name || t.email}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{t.role}</Badge>
                      <Badge variant="outline" className={`text-[10px] capitalize ${tone}`}>{status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.email} · expires {format(new Date(t.expires_at), "MMM d")}
                      {t.last_used_at && <> · last used {formatDistanceToNow(new Date(t.last_used_at), { addSuffix: true })}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!t.revoked_at && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(t.token)} title="Copy link">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => renew(t.id)} title="Renew (rotate token)">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    {!t.revoked_at && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => revoke(t.id)} title="Revoke">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!open ? (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
            <KeyRound className="h-3.5 w-3.5 mr-1" /> Invite via secure portal
          </Button>
        ) : (
          <div className="rounded border p-3 space-y-2 bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor_approver">Editor / Approver</SelectItem>
                    <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                    <SelectItem value="signer">Signer (after finalization)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link expires</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hour (high security)</SelectItem>
                    <SelectItem value="12h">12 hours</SelectItem>
                    <SelectItem value="24h">Session — 24 hours</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="14d">14 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="60d">60 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Short-lived links (≤24h) show a live countdown to the recipient.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={invite} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Send invite</>}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
