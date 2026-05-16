import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BellRing, CalendarClock, Loader2, RefreshCw, CheckCircle2, Send, Mail } from "lucide-react";
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
  notify_channel?: string | null;
  notify_emails?: string[] | null;
};

interface Props {
  importId: string;
  dates: KeyDate[];
}

const LABEL_MAP: Record<string, string> = {
  term_start: "Term Start",
  effective_date: "Effective Date",
  signed_date: "Signed Date",
  term_end: "Term End",
  renewal: "Renewal Date",
  opt_out_deadline: "Opt-out Deadline",
  non_renewal_notice_start: "Non-renewal Notice Window Opens",
  poc_start: "POC Start",
  poc_end: "POC End",
};

const labelFor = (t: string) =>
  LABEL_MAP[t] || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Cfg = { enabled: boolean; lead: number; channel: "in_app" | "email" | "both"; emails: string };

export const KeyDatesNotificationsPanel = ({ importId, dates }: Props) => {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<Record<string, Cfg>>({});

  useEffect(() => {
    const init: Record<string, Cfg> = {};
    dates.forEach((d) => {
      init[d.id] = {
        enabled: !!d.alert_enabled,
        lead: d.alert_lead_days || 30,
        channel: (["in_app", "email", "both"] as const).includes(d.notify_channel as any)
          ? (d.notify_channel as any)
          : "in_app",
        emails: Array.isArray(d.notify_emails) ? d.notify_emails.join(", ") : "",
      };
    });
    setCfg(init);
  }, [dates]);

  const sorted = useMemo(
    () => [...dates].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [dates]
  );

  const parseEmails = (s: string) =>
    s.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);

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
      const payload = Object.entries(cfg).map(([id, v]) => {
        const emails = parseEmails(v.emails);
        const invalid = emails.filter((e) => !EMAIL_RE.test(e));
        if (invalid.length) {
          throw new Error(`Invalid email${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`);
        }
        return { id, enabled: v.enabled, lead_days: v.lead, channel: v.channel, emails };
      });
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

  const sendTest = async (dateId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "send_test_notification", dateId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const er = data?.emailResult;
      if (er?.sent) {
        toast.success(`Test sent to ${er.sent} recipient${er.sent === 1 ? "" : "s"}.`);
      } else if (er?.error) {
        toast.error(`Email failed: ${er.error}`);
      } else {
        toast.success("In-app test notification fired.");
      }
    } catch (e: any) {
      toast.error(e.message || "Test failed");
    }
  };

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
              Term Start, Term End, Renewal, Non-renewal Notice Window and Opt-out — choose who
              gets reminded and how.
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
              const c = cfg[d.id] || { enabled: false, lead: 30, channel: "in_app" as const, emails: "" };
              const daysUntil = Math.ceil(
                (new Date(d.due_date).getTime() - today) / 86400000
              );
              const isPast = daysUntil < 0;
              const urgent = !isPast && daysUntil <= 30;
              const wantsEmail = c.channel === "email" || c.channel === "both";
              return (
                <div
                  key={d.id}
                  className="p-3 rounded-lg border bg-background text-sm space-y-2"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
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
                    <Select
                      value={c.channel}
                      onValueChange={(v: any) => setCfg({ ...cfg, [d.id]: { ...c, channel: v } })}
                      disabled={!c.enabled}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_app">In-app</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={c.enabled}
                      onCheckedChange={(v) =>
                        setCfg({ ...cfg, [d.id]: { ...c, enabled: v } })
                      }
                    />
                  </div>
                  {c.enabled && wantsEmail && (
                    <div className="flex items-center gap-2 pl-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="teammate@company.com, finance@company.com"
                        value={c.emails}
                        onChange={(e) =>
                          setCfg({ ...cfg, [d.id]: { ...c, emails: e.target.value } })
                        }
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => sendTest(d.id)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
