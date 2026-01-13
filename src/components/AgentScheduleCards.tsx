import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Clock, Mail, CheckCircle, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import nicolasAvatar from "@/assets/personas/nicolas.png";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

interface AgentScheduleCardsProps {
  selectedPersona?: string | null;
  onPersonaSelect?: (personaKey: string | null) => void;
}

const AgentScheduleCards = ({ selectedPersona, onPersonaSelect }: AgentScheduleCardsProps) => {
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  
  // Fetch drafts data for persona schedule
  const { data: draftsData, isLoading } = useQuery({
    queryKey: ["agent-schedule-drafts", effectiveAccountId],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !accountLoading && !!effectiveAccountId,
    queryFn: async () => {
      if (!effectiveAccountId) return [];

      // Fetch all unsent drafts (pending or approved) - no limit to get accurate counts
      // Use same user_id filter as ScheduledOutreachPanel for consistency
      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id, status, step_number,
          recommended_send_date, created_at, sent_at,
          days_past_due, invoice_id,
          invoices (
            id, due_date, status
          )
        `)
        .eq("user_id", effectiveAccountId)
        .in("status", ["pending_approval", "approved"])
        .is("sent_at", null)
        .order("recommended_send_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { personaSchedule, accountLevelStats } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const safeScheduledDateTime = (recommendedSendDate?: string | null) => {
      if (!recommendedSendDate) return null;
      const isoLike = recommendedSendDate.includes("T")
        ? recommendedSendDate
        : `${recommendedSendDate}T09:00:00`;
      const dt = new Date(isoLike);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const getDraftPersonaKey = (draft: any): keyof typeof personaConfig | null => {
      const invoice = draft.invoices as any;
      const dueDateRaw = invoice?.due_date as string | undefined;

      let daysPastDue: number | null = typeof draft.days_past_due === "number" ? draft.days_past_due : null;
      if (daysPastDue === null && dueDateRaw) {
        const dueDate = new Date(dueDateRaw);
        if (!Number.isNaN(dueDate.getTime())) {
          daysPastDue = differenceInCalendarDays(today, dueDate);
        }
      }

      // Handle current/pre-due invoices - assign to Sam (0-30 DPD agent)
      if (daysPastDue !== null && daysPastDue <= 0) return "sam";
      
      // Handle past due invoices by finding matching persona bucket
      if (daysPastDue !== null && daysPastDue > 0) {
        // Find the persona that matches this DPD range
        for (const [key, config] of Object.entries(personaConfig)) {
          if (config.bucketMax === null) {
            if (daysPastDue >= config.bucketMin) return key as keyof typeof personaConfig;
          } else {
            if (daysPastDue >= config.bucketMin && daysPastDue <= config.bucketMax) {
              return key as keyof typeof personaConfig;
            }
          }
        }
      }

      return null;
    };

    // Inactive invoice statuses to exclude from outreach (same as ScheduledOutreachPanel)
    const excludedInvoiceStatuses = ['Paid', 'Canceled', 'Voided', 'WrittenOff', 'Credited'];
    
    const upcoming = (draftsData || []).filter((d: any) => {
      if (d.sent_at) return false;
      // For invoice-level drafts, filter out inactive invoices
      if (d.invoice_id && d.invoices) {
        const invoiceStatus = d.invoices.status;
        if (excludedInvoiceStatuses.includes(invoiceStatus)) return false;
      }
      return true;
    });

    const byPersona: Record<string, { key: string; nextApproved: Date | null; nextAny: Date | null; approvedCount: number; pendingCount: number; total: number; }> = {};

    // Exclude nicolas from persona cards - he has a dedicated account-level card
    const invoicePersonaKeys = Object.keys(personaConfig).filter(key => key !== 'nicolas');
    
    for (const key of invoicePersonaKeys) {
      byPersona[key] = {
        key,
        nextApproved: null,
        nextAny: null,
        approvedCount: 0,
        pendingCount: 0,
        total: 0,
      };
    }

    // Account level stats (invoice_id is null)
    let accountApproved = 0;
    let accountPending = 0;
    let accountNextApproved: Date | null = null;
    let accountNextAny: Date | null = null;

    for (const draft of upcoming) {
      // Check if this is an account-level draft (invoice_id is null)
      if (draft.invoice_id === null) {
        const scheduled = safeScheduledDateTime(draft.recommended_send_date) || safeScheduledDateTime(draft.created_at);
        if (scheduled) {
          if (draft.status === "approved") {
            accountApproved += 1;
            if (!accountNextApproved || scheduled < accountNextApproved) {
              accountNextApproved = scheduled;
            }
          } else if (draft.status === "pending_approval") {
            accountPending += 1;
          }
          if (!accountNextAny || scheduled < accountNextAny) {
            accountNextAny = scheduled;
          }
        }
        continue;
      }

      const personaKey = getDraftPersonaKey(draft);
      if (!personaKey || !byPersona[personaKey]) continue;

      const scheduled = safeScheduledDateTime(draft.recommended_send_date) || safeScheduledDateTime(draft.created_at);
      if (!scheduled) continue;

      byPersona[personaKey].total += 1;
      if (draft.status === "approved") {
        byPersona[personaKey].approvedCount += 1;
        if (!byPersona[personaKey].nextApproved || scheduled < byPersona[personaKey].nextApproved) {
          byPersona[personaKey].nextApproved = scheduled;
        }
      } else if (draft.status === "pending_approval") {
        byPersona[personaKey].pendingCount += 1;
      }

      if (!byPersona[personaKey].nextAny || scheduled < byPersona[personaKey].nextAny) {
        byPersona[personaKey].nextAny = scheduled;
      }
    }

    return {
      // Only include invoice-level personas (exclude nicolas)
      personaSchedule: invoicePersonaKeys.map((key) => ({
        persona: personaConfig[key],
        ...byPersona[key],
      })),
      accountLevelStats: {
        approvedCount: accountApproved,
        pendingCount: accountPending,
        total: accountApproved + accountPending,
        nextApproved: accountNextApproved,
        nextAny: accountNextAny,
      },
    };
  }, [draftsData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Collection Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCardClick = (personaKey: string) => {
    if (!onPersonaSelect) return;
    
    // Toggle - if already selected, clear selection
    if (selectedPersona === personaKey) {
      onPersonaSelect(null);
    } else {
      onPersonaSelect(personaKey);
    }
  };

  // Special handler for account level (nicolas)
  const handleAccountLevelClick = () => {
    if (!onPersonaSelect) return;
    
    // Toggle - if already selected, clear selection
    if (selectedPersona === 'nicolas') {
      onPersonaSelect(null);
    } else {
      onPersonaSelect('nicolas');
    }
  };

  const accountNext = accountLevelStats.nextApproved || accountLevelStats.nextAny;
  const accountNextLabel = accountLevelStats.nextApproved ? "Next approved" : accountLevelStats.nextAny ? "Next pending" : "No upcoming";
  const isAccountSelected = selectedPersona === 'nicolas';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          AI Collection Agents - Scheduled Outreach
          {onPersonaSelect && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (Click to filter)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Account Level Outreach Card (Nicolas) */}
          <div 
            className={cn(
              "rounded-lg border p-3 bg-gradient-to-br from-purple-50 to-background dark:from-purple-950/30 dark:to-background transition-all",
              "border-purple-200 dark:border-purple-800",
              onPersonaSelect && "cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/30",
              isAccountSelected && "ring-2 ring-purple-500 bg-purple-100/50 dark:bg-purple-900/30"
            )}
            onClick={handleAccountLevelClick}
          >
            <div className="flex items-center gap-3">
              <Avatar className={cn(
                "h-10 w-10 ring-2 ring-offset-2 ring-offset-background ring-purple-500"
              )}>
                <AvatarImage src={nicolasAvatar} alt="Nicolas - Account Level Agent" />
                <AvatarFallback className="bg-purple-500 text-white">
                  <Building2 className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">Nicolas</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                    Account
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  Account Summary Agent
                </p>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                {accountLevelStats.approvedCount > 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>{accountLevelStats.approvedCount} ready</span>
                  </div>
                )}
                {accountLevelStats.pendingCount > 0 && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <Clock className="h-3 w-3" />
                    <span>{accountLevelStats.pendingCount} pending</span>
                  </div>
                )}
                {accountLevelStats.total === 0 && (
                  <span className="text-muted-foreground">No outreach queued</span>
                )}
              </div>
              {accountNext && (
                <Badge variant="secondary" className="text-[10px]">
                  {format(accountNext, "MMM d h:mm a")}
                </Badge>
              )}
            </div>
          </div>

          {/* Persona Cards */}
          {personaSchedule.map((row) => {
            const next = row.nextApproved || row.nextAny;
            const nextLabel = row.nextApproved ? "Next approved" : row.nextAny ? "Next pending" : "No upcoming";
            const isSelected = selectedPersona === row.key;
            
            return (
              <div 
                key={row.key} 
                className={cn(
                  "rounded-lg border p-3 bg-card transition-all",
                  onPersonaSelect && "cursor-pointer hover:bg-accent/30",
                  isSelected && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => handleCardClick(row.key)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className={cn(
                    "h-10 w-10 ring-2 ring-offset-2 ring-offset-background",
                    isSelected && "ring-primary"
                  )} style={{ 
                    '--tw-ring-color': isSelected ? undefined : row.persona.color 
                  } as React.CSSProperties}>
                    <AvatarImage src={row.persona.avatar} alt={`${row.persona.name} persona`} />
                    <AvatarFallback style={{ backgroundColor: row.persona.color }}>
                      {row.persona.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{row.persona.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {row.persona.bucketMin}-{row.persona.bucketMax || '∞'} DPD
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {row.persona.description}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    {row.approvedCount > 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>{row.approvedCount} ready</span>
                      </div>
                    )}
                    {row.pendingCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Clock className="h-3 w-3" />
                        <span>{row.pendingCount} pending</span>
                      </div>
                    )}
                    {row.total === 0 && (
                      <span className="text-muted-foreground">No outreach queued</span>
                    )}
                  </div>
                  {next && (
                    <Badge variant="secondary" className="text-[10px]">
                      {format(next, "MMM d h:mm a")}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentScheduleCards;
