import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Clock, Mail, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AgentScheduleCardsProps {
  selectedPersona?: string | null;
  onPersonaSelect?: (personaKey: string | null) => void;
}

const AgentScheduleCards = ({ selectedPersona, onPersonaSelect }: AgentScheduleCardsProps) => {
  // Fetch drafts data for persona schedule
  const { data: draftsData, isLoading } = useQuery({
    queryKey: ["agent-schedule-drafts"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id, subject, status, step_number,
          recommended_send_date, created_at, sent_at,
          days_past_due,
          invoices (
            id, invoice_number, due_date
          )
        `)
        .in("status", ["pending_approval", "approved"])
        .order("recommended_send_date", { ascending: true })
        .limit(250);

      if (error) throw error;
      return data || [];
    },
  });

  const personaSchedule = useMemo(() => {
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

      if (daysPastDue !== null && daysPastDue <= 0) return "sam";

      const persona = typeof daysPastDue === "number" ? getPersonaByDaysPastDue(daysPastDue) : null;
      return (persona?.name?.toLowerCase() as keyof typeof personaConfig) || null;
    };

    const upcoming = (draftsData || []).filter((d: any) => !d.sent_at);

    const byPersona: Record<string, { key: string; nextApproved: Date | null; nextAny: Date | null; approvedCount: number; pendingCount: number; total: number; }> = {};

    for (const key of Object.keys(personaConfig)) {
      byPersona[key] = {
        key,
        nextApproved: null,
        nextAny: null,
        approvedCount: 0,
        pendingCount: 0,
        total: 0,
      };
    }

    for (const draft of upcoming) {
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

    return Object.keys(personaConfig).map((key) => ({
      persona: personaConfig[key],
      ...byPersona[key],
    }));
  }, [draftsData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Collection Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
