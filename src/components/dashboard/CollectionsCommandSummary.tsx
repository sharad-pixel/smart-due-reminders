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
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id,amount,amount_outstanding,due_date,status,currency")
        .eq("user_id", accountId!)
        .not("status", "in", "(Paid,Settled,Canceled,Voided,WrittenOff)")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: tasks } = useQuery({
    enabled: !!accountId,
    queryKey: ["hub-coll-tasks", accountId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("collection_tasks")
        .select("id,status")
        .eq("user_id", accountId!)
        .neq("status", "completed")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const m = useMemo(() => {
    const list = invoices ?? [];
    const now = Date.now();
    const outstanding = list.reduce(
      (s: number, i: any) => s + (Number(i.amount_outstanding ?? i.amount) || 0),
      0,
    );
    const overdue = list.filter((i: any) => {
      if (!i.due_date) return false;
      const t = new Date(i.due_date).getTime();
      return !Number.isNaN(t) && t < now;
    });
    const overdueAmt = overdue.reduce(
      (s: number, i: any) => s + (Number(i.amount_outstanding ?? i.amount) || 0),
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
    <Card className="border shadow-none">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Collections Command
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/tasks")}>
              <Inbox className="h-3.5 w-3.5 mr-1.5" /> Tasks
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate("/dashboard")}>
              Open Collections Hub <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
          <Kpi
            label="Outstanding AR"
            value={formatCurrency(m.outstanding, m.currency)}
            sub={`${(invoices ?? []).length} open invoices`}
          />
          <Kpi
            label="Overdue Balance"
            value={formatCurrency(m.overdueAmt, m.currency)}
            sub={`${m.overdueCount} overdue`}
          />
          <Kpi
            label="Avg Days Past Due"
            value={String(m.dpd)}
            sub="weighted"
          />
          <Kpi
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
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) => (
  <div className="px-5 py-4">
    <div className="text-[11px] font-medium text-muted-foreground tracking-wide truncate">
      {label}
    </div>
    <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground truncate">
      {value}
    </div>
    {sub && <div className="mt-1 text-[11px] text-muted-foreground truncate">{sub}</div>}
  </div>
);

export default CollectionsCommandSummary;
