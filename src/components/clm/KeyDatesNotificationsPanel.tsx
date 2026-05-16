import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BellRing, CalendarClock, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatters";

type KeyDate = {
  id: string;
  date_type: string;
  due_date: string;
  risk_level?: string | null;
  alert_enabled?: boolean | null;
  alert_lead_days?: number | null;
  last_alerted_at?: string | null;
};

interface Props {
  importId: string;
  dates: KeyDate[];
}

const labelFor = (t: string) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const KeyDatesNotificationsPanel = ({ importId, dates }: Props) => {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<Record<string, { enabled: boolean; lead: number }>>({});

  useEffect(() => {
    const init: Record<string, { enabled: boolean; lead: number }> = {};
    dates.forEach((d) => {
      init[d.id] = { enabled: !!d.alert_enabled, lead: d.alert_lead_days || 30 };
    });
    setCfg(init);
  }, [dates]);

  const sorted = useMemo(
    () => [...dates].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [dates]
  );

  const recalc = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "recalculate_dates" },
      });
      if (error) throw new Error(error.message || "Recalculate failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Recalculated ${d.count} key date${d.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(cfg).map(([id, v]) => ({
        id,
        enabled: v.enabled,
        lead_days: v.lead,
      }));
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "set_alerts", dates: payload },
      });
      if (error) throw new Error(error.message || "Save failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(
        `Notifications saved${d.fired ? ` · ${d.fired} alert${d.fired === 1 ? "" : "s"} fired now` : ""}`
      );
      qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const today = Date.now();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Key Dates & Notifications
            </CardTitle>
            <CardDescription>
              Recalculate milestones from extracted terms and choose which ones to be notified about.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => recalc.mutate()}
              disabled={recalc.isPending}
            >
              {recalc.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Recalculate Key Dates
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || sorted.length === 0}>
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <BellRing className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save notifications
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No key dates yet. Click <strong>Recalculate Key Dates</strong> to derive them from the
            contract's effective date, term end, renewal terms, and notice period.
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map((d) => {
              const c = cfg[d.id] || { enabled: false, lead: 30 };
              const daysUntil = Math.ceil(
                (new Date(d.due_date).getTime() - today) / 86400000
              );
              const isPast = daysUntil < 0;
              const urgent = !isPast && daysUntil <= 30;
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-background text-sm flex-wrap sm:flex-nowrap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {labelFor(d.date_type)}
                      {urgent && (
                        <Badge className="bg-amber-600 text-white text-[10px]">URGENT</Badge>
                      )}
                      {isPast && (
                        <Badge variant="outline" className="text-[10px]">Past</Badge>
                      )}
                      {d.last_alerted_at && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> alert sent
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateShort(d.due_date)}
                      {" · "}
                      {isPast
                        ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago`
                        : daysUntil === 0
                          ? "Today"
                          : `In ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Notify</span>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={c.lead}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          [d.id]: { ...c, lead: Number(e.target.value) || 30 },
                        })
                      }
                      className="h-7 w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={!c.enabled}
                    />
                    <span className="text-muted-foreground">days before</span>
                  </div>
                  <Switch
                    checked={c.enabled}
                    onCheckedChange={(v) =>
                      setCfg({ ...cfg, [d.id]: { ...c, enabled: v } })
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
