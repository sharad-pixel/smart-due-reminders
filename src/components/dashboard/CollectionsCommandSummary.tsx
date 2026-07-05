import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { formatCurrency } from "@/lib/formatters";
import {
  Brain,
  Wallet,
  AlertTriangle,
  ListChecks,
  Clock,
  ArrowRight,
  Inbox,
} from "lucide-react";

const DAY = 24 * 60 * 60 * 1000;

export const CollectionsCommandSummary = () => {
  const navigate = useNavigate();
  const { accountId } = useAccountId();

  const { data: invoices } = useQuery({
    enabled: !!accountId,
    queryKey: ["hub-coll-invoices", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,amount,balance_due,due_date,status,currency")
        .eq("account_id", accountId!)
        .neq("status", "paid")
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    enabled: !!accountId,
    queryKey: ["hub-coll-tasks", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select("id,status")
        .eq("account_id", accountId!)
        .neq("status", "completed")
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const m = useMemo(() => {
    const list = invoices ?? [];
    const now = Date.now();
    const outstanding = list.reduce(
      (s: number, i: any) => s + (Number(i.balance_due ?? i.amount) || 0),
      0,
    );
    const overdue = list.filter((i: any) => {
      if (!i.due_date) return false;
      const t = new Date(i.due_date).getTime();
      return !Number.isNaN(t) && t < now;
    });
    const overdueAmt = overdue.reduce(
      (s: number, i: any) => s + (Number(i.balance_due ?? i.amount) || 0),
      0,
    );
    const dpd =
      overdue.length === 0
        ? 0
        : Math.round(
            overdue.reduce(
              (s: number, i: any) => s + Math.max(0, (now - new Date(i.due_date).getTime()) / DAY),
              0,
            ) / overdue.length,
          );
    const currency = (list[0] as any)?.currency || "USD";
    return {
      outstanding,
      overdueAmt,
      overdueCount: overdue.length,
      openTasks: (tasks ?? []).length,
      dpd,
      currency,
    };
  }, [invoices, tasks]);

  if (!accountId) return null;

  return (
    <Card className="border-l-4 border-l-accent bg-gradient-to-br from-accent/5 via-transparent to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent" /> Collections Command
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Live receivables, overdue exposure, and open collection tasks
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/tasks")}>
              <Inbox className="h-3.5 w-3.5 mr-1.5" /> Tasks
            </Button>
            <Button size="sm" onClick={() => navigate("/dashboard")}>
              Open Collections Hub <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            icon={<Wallet className="h-4 w-4 text-emerald-500" />}
            label="Outstanding AR"
            value={formatCurrency(m.outstanding, m.currency)}
            sub={`${(invoices ?? []).length} open invoices`}
          />
          <Kpi
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            label="Overdue Balance"
            value={formatCurrency(m.overdueAmt, m.currency)}
            sub={`${m.overdueCount} overdue`}
          />
          <Kpi
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            label="Avg Days Past Due"
            value={String(m.dpd)}
            sub={
              <Badge variant="outline" className="text-[10px]">
                weighted
              </Badge>
            }
          />
          <Kpi
            icon={<ListChecks className="h-4 w-4 text-primary" />}
            label="Open Tasks"
            value={String(m.openTasks)}
            sub="collector actions"
          />
        </div>
      </CardContent>
    </Card>
  );
};

const Kpi = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) => (
  <div className="rounded-lg border bg-card p-3">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1.5 text-xl font-semibold tracking-tight truncate">{value}</div>
    <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
  </div>
);

export default CollectionsCommandSummary;
