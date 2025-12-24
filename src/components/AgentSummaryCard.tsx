import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { personaConfig, getPersonaByDaysPastDue } from "@/lib/personaConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar } from "lucide-react";

const AgentSummaryCard = () => {
  // Fetch drafts for schedule calculation
  const { data: draftsData, isLoading } = useQuery({
    queryKey: ["agent-schedule-drafts"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ai_drafts")
        .select(`
          id, status, step_number, recommended_send_date, created_at, sent_at, days_past_due,
          invoices (due_date)
        `)
        .in("status", ["pending_approval", "approved"])
        .is("sent_at", null)
        .limit(500);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate schedule per persona
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

    const byPersona: Record<string, { 
      key: string; 
      nextApproved: Date | null; 
      nextAny: Date | null; 
      approvedCount: number; 
      pendingCount: number; 
      total: number; 
    }> = {};

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

    (draftsData || []).forEach((draft: any) => {
      const personaKey = getDraftPersonaKey(draft);
      if (!personaKey || !byPersona[personaKey]) return;

      const scheduled = safeScheduledDateTime(draft.recommended_send_date) || safeScheduledDateTime(draft.created_at);
      if (!scheduled) return;

      byPersona[personaKey].total += 1;
      if (draft.status === "approved") {
        byPersona[personaKey].approvedCount += 1;
        if (!byPersona[personaKey].nextApproved || scheduled < byPersona[personaKey].nextApproved!) {
          byPersona[personaKey].nextApproved = scheduled;
        }
      } else if (draft.status === "pending_approval") {
        byPersona[personaKey].pendingCount += 1;
      }

      if (!byPersona[personaKey].nextAny || scheduled < byPersona[personaKey].nextAny!) {
        byPersona[personaKey].nextAny = scheduled;
      }
    });

    return Object.keys(personaConfig).map((key) => ({
      persona: personaConfig[key],
      ...byPersona[key],
    })).filter(row => row.total > 0);
  }, [draftsData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Schedule Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (personaSchedule.length === 0) {
    return null; // Don't render if no scheduled outreach
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Next Scheduled Outreach by Agent
        </CardTitle>
        <CardDescription>
          Overview of upcoming collection emails by AI agent persona.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {personaSchedule.map((row) => {
            const next = row.nextApproved || row.nextAny;
            const nextLabel = row.nextApproved ? "Next approved" : row.nextAny ? "Next pending" : "No upcoming";
            
            return (
              <div key={row.key} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={row.persona.avatar} alt={`${row.persona.name} persona`} />
                    <AvatarFallback style={{ backgroundColor: row.persona.color }}>
                      {row.persona.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{row.persona.name}</p>
                      <Badge variant="secondary">{row.total}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.persona.description}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-muted-foreground">Approved</p>
                    <p className="font-medium">{row.approvedCount}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-muted-foreground">Pending</p>
                    <p className="font-medium">{row.pendingCount}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{nextLabel}</p>
                  <p className="text-xs font-medium">
                    {next ? format(next, "MMM d, yyyy") : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentSummaryCard;
