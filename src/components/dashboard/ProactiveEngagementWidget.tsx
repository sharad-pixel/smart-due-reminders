import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Zap, AlertTriangle, Clock, Mail, ChevronDown, ChevronUp,
  Loader2, Send, FileText, TrendingUp, VolumeX
} from "lucide-react";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInDays, format } from "date-fns";
import { ProactiveDraftPreviewCard } from "./ProactiveDraftPreviewCard";

type ActionCategory = "due_soon" | "newly_past_due" | "gone_silent";

interface ProactiveItem {
  id: string;
  invoice_number: string;
  amount: number;
  amount_outstanding: number;
  due_date: string;
  status: string;
  debtor_id: string;
  debtor_name: string;
  company_name: string | null;
  category: ActionCategory;
  days_until_due?: number;
  days_past_due?: number;
  last_activity_days?: number;
  recommended_action: string;
  action_label: string;
  urgency: "low" | "medium" | "high";
}

export function ProactiveEngagementWidget() {
  const { effectiveAccountId } = useEffectiveAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedCategory, setExpandedCategory] = useState<ActionCategory | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState<string | null>(null);
  const [previewDraft, setPreviewDraft] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["proactive-engagement", effectiveAccountId],
    enabled: !!effectiveAccountId,
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch open invoices with debtors
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, amount, amount_outstanding, due_date, status, debtor_id,
          debtors!inner(id, name, company_name)
        `)
        .eq("user_id", effectiveAccountId!)
        .in("status", ["Open", "InPaymentPlan", "PartiallyPaid"])
        .order("due_date", { ascending: true });

      if (invError) throw invError;

      // Fetch recent collection activities (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activities } = await supabase
        .from("collection_activities")
        .select("debtor_id, created_at")
        .eq("user_id", effectiveAccountId!)
        .eq("direction", "outbound")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      // Build last activity map per debtor
      const lastActivityMap: Record<string, Date> = {};
      activities?.forEach((a) => {
        if (!lastActivityMap[a.debtor_id]) {
          lastActivityMap[a.debtor_id] = new Date(a.created_at);
        }
      });

      // Fetch existing pending/approved drafts to avoid duplicates
      const { data: existingDrafts } = await supabase
        .from("ai_drafts")
        .select("invoice_id, status")
        .eq("user_id", effectiveAccountId!)
        .in("status", ["pending_approval", "approved"]);

      const invoicesWithDrafts = new Set(
        existingDrafts?.map((d) => d.invoice_id).filter(Boolean) || []
      );

      const items: ProactiveItem[] = [];

      (invoices as any[])?.forEach((inv) => {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = differenceInDays(dueDate, today);
        const daysPastDue = Math.max(0, differenceInDays(today, dueDate));
        const debtorName = inv.debtors?.name || "Unknown";
        const companyName = inv.debtors?.company_name;
        const hasDraft = invoicesWithDrafts.has(inv.id);

        const lastActivity = lastActivityMap[inv.debtor_id];
        const daysSinceActivity = lastActivity
          ? differenceInDays(today, lastActivity)
          : null;

        // Category 1: Due within 7 days (not yet past due)
        if (daysUntilDue >= 0 && daysUntilDue <= 7) {
          items.push({
            id: inv.id,
            invoice_number: inv.invoice_number,
            amount: inv.amount,
            amount_outstanding: inv.amount_outstanding || inv.amount,
            due_date: inv.due_date,
            status: inv.status,
            debtor_id: inv.debtor_id,
            debtor_name: debtorName,
            company_name: companyName,
            category: "due_soon",
            days_until_due: daysUntilDue,
            recommended_action: hasDraft
              ? "Draft ready — review and send before due date"
              : daysUntilDue <= 2
                ? "Send a friendly payment reminder now"
                : "Generate a pre-due courtesy reminder",
            action_label: hasDraft ? "Review Draft" : "Generate Reminder",
            urgency: daysUntilDue <= 2 ? "medium" : "low",
          });
        }

        // Category 2: Newly past due (1-14 days)
        if (daysPastDue >= 1 && daysPastDue <= 14) {
          items.push({
            id: inv.id,
            invoice_number: inv.invoice_number,
            amount: inv.amount,
            amount_outstanding: inv.amount_outstanding || inv.amount,
            due_date: inv.due_date,
            status: inv.status,
            debtor_id: inv.debtor_id,
            debtor_name: debtorName,
            company_name: companyName,
            category: "newly_past_due",
            days_past_due: daysPastDue,
            recommended_action: hasDraft
              ? "Draft awaiting approval — send promptly"
              : "Generate first follow-up before account ages further",
            action_label: hasDraft ? "Send Now" : "Draft Follow-Up",
            urgency: daysPastDue >= 7 ? "high" : "medium",
          });
        }

        // Category 3: Gone silent (overdue 15+ days, no activity in 14+ days)
        if (daysPastDue >= 15 && (daysSinceActivity === null || daysSinceActivity >= 14)) {
          items.push({
            id: inv.id,
            invoice_number: inv.invoice_number,
            amount: inv.amount,
            amount_outstanding: inv.amount_outstanding || inv.amount,
            due_date: inv.due_date,
            status: inv.status,
            debtor_id: inv.debtor_id,
            debtor_name: debtorName,
            company_name: companyName,
            category: "gone_silent",
            days_past_due: daysPastDue,
            last_activity_days: daysSinceActivity ?? undefined,
            recommended_action: "Re-engage — no outreach activity in "
              + (daysSinceActivity ? `${daysSinceActivity} days` : "this account's history"),
            action_label: "Re-Engage",
            urgency: "high",
          });
        }
      });

      return items;
    },
  });

  const handleAction = async (item: ProactiveItem) => {
    setGeneratingDraft(item.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Please sign in to continue");
        return;
      }

      const { data: result, error } = await supabase.functions.invoke(
        "generate-outreach-draft",
        {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
          body: {
            invoice_id: item.id,
            step_number: 1,
            tone: item.category === "due_soon" ? "friendly" : item.category === "gone_silent" ? "firm" : "neutral",
            use_ai_generation: true,
          },
        }
      );

      if (error) throw error;

      // Show the draft preview card
      if (result?.email_draft) {
        setPreviewDraft({
          id: result.email_draft.id,
          subject: result.email_draft.subject,
          message_body: result.email_draft.message_body,
          channel: result.email_draft.channel || "email",
          invoice_id: item.id,
          invoice_number: item.invoice_number,
          company_name: item.company_name || item.debtor_name,
          category: item.category,
        });
        setShowPreview(true);
      } else {
        toast.success("Draft generated", { description: "Review in AI Workflows → Scheduled Outreach" });
      }
    } catch (err: any) {
      console.error("Proactive action error:", err);
      toast.error("Failed to generate draft", { description: err?.message });
    } finally {
      setGeneratingDraft(null);
    }
  };

  const categories: {
    key: ActionCategory;
    label: string;
    icon: React.ReactNode;
    description: string;
    color: string;
    badgeVariant: "default" | "secondary" | "destructive";
  }[] = [
    {
      key: "due_soon",
      label: "Due Soon",
      icon: <Clock className="h-4 w-4" />,
      description: "Invoices due within 7 days — send a courtesy reminder",
      color: "text-blue-600",
      badgeVariant: "default",
    },
    {
      key: "newly_past_due",
      label: "Newly Past Due",
      icon: <AlertTriangle className="h-4 w-4" />,
      description: "1–14 days overdue — act before they age further",
      color: "text-amber-600",
      badgeVariant: "secondary",
    },
    {
      key: "gone_silent",
      label: "Gone Silent",
      icon: <VolumeX className="h-4 w-4" />,
      description: "No outreach in 14+ days on overdue accounts",
      color: "text-destructive",
      badgeVariant: "destructive",
    },
  ];

  const groupedItems = categories.map((cat) => ({
    ...cat,
    items: data?.filter((d) => d.category === cat.key) || [],
  }));

  const totalActions = data?.length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">Scanning for proactive engagement opportunities...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalActions === 0) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.02]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-sm">All Clear</p>
              <p className="text-xs text-muted-foreground">No immediate engagement actions needed — your accounts are on track.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Proactive Engagement
            </CardTitle>
            <CardDescription>
              AI-recommended actions to engage accounts before they become harder to collect
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {totalActions} action{totalActions !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {groupedItems.map((group) => {
          if (group.items.length === 0) return null;
          const isExpanded = expandedCategory === group.key;
          const totalAmount = group.items.reduce(
            (sum, i) => sum + Number(i.amount_outstanding || i.amount || 0), 0
          );

          return (
            <div key={group.key} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : group.key)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className={cn("shrink-0", group.color)}>{group.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{group.label}</span>
                    <Badge variant={group.badgeVariant} className="text-[10px] h-5">
                      {group.items.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.description} · ${Math.round(totalAmount).toLocaleString()} at risk
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t divide-y">
                  {group.items.slice(0, 10).map((item) => (
                    <ProactiveItemRow
                      key={`${item.id}-${item.category}`}
                      item={item}
                      isGenerating={generatingDraft === item.id}
                      onAction={() => handleAction(item)}
                      onNavigate={() => navigate(`/invoices/${item.id}`)}
                    />
                  ))}
                  {group.items.length > 10 && (
                    <div className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/invoices")}
                        className="text-xs"
                      >
                        View all {group.items.length} invoices →
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProactiveItemRow({
  item,
  isGenerating,
  onAction,
  onNavigate,
}: {
  item: ProactiveItem;
  isGenerating: boolean;
  onAction: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {item.invoice_number || item.id.slice(0, 8)}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {item.company_name || item.debtor_name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-medium">
            ${Number(item.amount_outstanding || item.amount || 0).toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {item.category === "due_soon"
              ? `Due in ${item.days_until_due}d`
              : item.category === "newly_past_due"
                ? `${item.days_past_due}d overdue`
                : `${item.days_past_due}d overdue · silent ${item.last_activity_days ? `${item.last_activity_days}d` : "always"}`}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 italic">
          {item.recommended_action}
        </p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={item.urgency === "high" ? "default" : "outline"}
              className="shrink-0 text-xs gap-1.5 h-8"
              onClick={onAction}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : item.category === "gone_silent" ? (
                <Send className="h-3 w-3" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              {item.action_label}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-[200px]">
            AI will generate a personalized draft based on this invoice's context and aging
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
