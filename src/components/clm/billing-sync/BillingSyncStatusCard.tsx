import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDateShort } from "@/lib/formatters";
import type { BillingSyncRow, BillingSyncStatus } from "@/hooks/useContractBillingSync";

const STATUS_META: Record<BillingSyncStatus, { label: string; variant: any; icon: any }> = {
  not_connected: { label: "Not Connected", variant: "secondary", icon: AlertTriangle },
  ready: { label: "Ready to Sync", variant: "default", icon: CheckCircle2 },
  pending_review: { label: "Pending Review", variant: "outline", icon: AlertTriangle },
  ready_for_stripe: { label: "Ready for Stripe", variant: "default", icon: CheckCircle2 },
  synchronized: { label: "Synchronized", variant: "default", icon: CheckCircle2 },
  error: { label: "Sync Error", variant: "destructive", icon: AlertTriangle },
  needs_attention: { label: "Needs Attention", variant: "outline", icon: AlertTriangle },
};

interface Props {
  sync: BillingSyncRow | null | undefined;
  stripeAccount?: string | null;
  onRecompute: () => void;
  onSync: () => void;
  computing: boolean;
  syncing: boolean;
}

export function BillingSyncStatusCard({ sync, stripeAccount, onRecompute, onSync, computing, syncing }: Props) {
  const status = (sync?.status ?? "not_connected") as BillingSyncStatus;
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const score = sync?.readiness_score ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" /> Stripe Billing Sync
          </span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground">Readiness Score</div>
            <div className="text-lg font-semibold">{score}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Last Sync</div>
            <div className="font-medium">{sync?.last_sync_at ? formatDateShort(sync.last_sync_at) : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Stripe Account</div>
            <div className="font-mono text-[11px] truncate">{stripeAccount ?? "—"}</div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onRecompute} disabled={computing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${computing ? "animate-spin" : ""}`} />
            Recompute Readiness
          </Button>
          <Button size="sm" onClick={onSync} disabled={syncing || score < 80}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Sync to Stripe
          </Button>
        </div>
        {sync?.last_error && (
          <div className="text-xs rounded border border-destructive/40 bg-destructive/5 p-2 text-destructive">
            {typeof sync.last_error === "string" ? sync.last_error : JSON.stringify(sync.last_error)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
