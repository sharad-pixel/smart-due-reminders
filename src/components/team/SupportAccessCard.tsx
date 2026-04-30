import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Shield, Clock, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useSupportAccess } from "@/hooks/useSupportAccess";
import { formatDistanceToNow } from "date-fns";

interface Props {
  accountId: string;
  canManage: boolean;
}

export const SupportAccessCard = ({ accountId, canManage }: Props) => {
  const { activeGrant, history, loading, grantAccess, revokeAccess } = useSupportAccess(accountId);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duration, setDuration] = useState("168"); // hours: 24/168/720
  const [scope, setScope] = useState<"read" | "write">("read");
  const [reason, setReason] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const handleGrant = async () => {
    if (!authorized) return;
    setSubmitting(true);
    try {
      await grantAccess({ durationHours: Number(duration), scope, reason: reason || undefined });
      setOpen(false);
      setReason("");
      setAuthorized(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Recouply Support Access</CardTitle>
              <CardDescription className="mt-1">
                Grant the Recouply.ai support and solutions team time-limited, audited access to your workspace
                to help with setup, troubleshoot issues, or test functionality.
              </CardDescription>
            </div>
          </div>
          {activeGrant ? (
            <Badge variant="default" className="gap-1 bg-accent text-accent-foreground">
              <ShieldCheck className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" /> Not granted
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeGrant ? (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                Expires <strong>{formatDistanceToNow(new Date(activeGrant.expires_at), { addSuffix: true })}</strong>
                {" · "}
                {activeGrant.scope === "write" ? "Full access" : "View only"}
              </span>
            </div>
            {activeGrant.reason && (
              <p className="text-sm text-muted-foreground italic">"{activeGrant.reason}"</p>
            )}
            {canManage && (
              <Button variant="destructive" size="sm" onClick={() => revokeAccess(activeGrant.id)}>
                Revoke now
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active support access. Grant access whenever you need help — it's fully audited and revocable in one click.
          </p>
        )}

        {canManage && !activeGrant && (
          <Button onClick={() => setOpen(true)} disabled={loading}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Grant Support Access
          </Button>
        )}

        {history.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recent grants</h4>
            <ul className="space-y-1.5 text-sm">
              {history.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {new Date(g.created_at).toLocaleDateString()} · {g.scope}
                  </span>
                  <Badge variant={g.revoked_at ? "outline" : new Date(g.expires_at) < new Date() ? "secondary" : "default"} className="text-[10px]">
                    {g.revoked_at ? "Revoked" : new Date(g.expires_at) < new Date() ? "Expired" : "Active"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Support Access</DialogTitle>
            <DialogDescription>
              The Recouply.ai support team will be able to access your workspace for the duration you choose.
              Access auto-expires and you can revoke it at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="168">7 days (recommended)</SelectItem>
                  <SelectItem value="720">30 days (max)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Access level</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "read" | "write")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">View only — support can see but not change anything</SelectItem>
                  <SelectItem value="write">Full access — support can make changes (e.g. setup, fixes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Help configuring QuickBooks sync"
                rows={2}
                maxLength={500}
              />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={authorized} onCheckedChange={(c) => setAuthorized(!!c)} className="mt-0.5" />
              <span>
                I authorize Recouply support staff to access my workspace for the selected duration.
                A persistent banner will be visible while access is active.
              </span>
            </label>
            {scope === "write" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Full access means support can edit your data. Every action is logged in the audit trail.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={!authorized || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
