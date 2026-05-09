import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, RefreshCw, Scale, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import kurtAvatar from "@/assets/personas/kurt.png";
import { toast } from "sonner";
import { useState } from "react";

type Rec = {
  id: string;
  recommendation: "approve" | "request_changes" | "reject";
  confidence: number;
  summary: string;
  key_changes: string[];
  risks: string[];
  suggested_edits: string[];
  created_at: string;
};

const recMeta = {
  approve: { label: "Recommend: Approve", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
  request_changes: { label: "Recommend: Request changes", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30", Icon: AlertTriangle },
  reject: { label: "Recommend: Reject", tone: "bg-rose-500/15 text-rose-700 border-rose-500/30", Icon: XCircle },
} as const;

export const KurtRecommendationCard = ({ revisionId }: { revisionId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: rec, isLoading } = useQuery<Rec | null>({
    queryKey: ["kurt-rec", revisionId],
    queryFn: async () => {
      const { data } = await (supabase.from("clm_kurt_recommendations" as any) as any)
        .select("*")
        .eq("revision_id", revisionId)
        .maybeSingle();
      return (data as Rec) ?? null;
    },
    refetchInterval: (q) => (q.state.data ? false : 5000),
  });

  const requestReview = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("clm-kurt-review", { body: { revisionId } });
      await qc.invalidateQueries({ queryKey: ["kurt-rec", revisionId] });
      toast.success("Kurt is reviewing…");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't reach Kurt");
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!rec) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center gap-3">
          <img src={kurtAvatar} alt="Kurt" className="h-9 w-9 rounded-full object-cover ring-2 ring-indigo-200" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Kurt — General Counsel</p>
            <p className="text-[11px] text-muted-foreground">Hasn't weighed in yet on this amendment.</p>
          </div>
          <Button size="sm" variant="outline" onClick={requestReview} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Ask Kurt
          </Button>
        </CardContent>
      </Card>
    );
  }

  const meta = recMeta[rec.recommendation];
  const Icon = meta.Icon;

  return (
    <Card className="border-indigo-200/60 bg-indigo-50/30 dark:bg-indigo-950/10">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-3">
          <img src={kurtAvatar} alt="Kurt" className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-300 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold flex items-center gap-1">
                <Scale className="h-3 w-3" /> Kurt — General Counsel
              </span>
              <Badge variant="outline" className={`${meta.tone} text-[10px]`}>
                <Icon className="h-3 w-3 mr-1" />{meta.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {Math.round((rec.confidence ?? 0) * 100)}% confidence
              </span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed">{rec.summary}</p>
          </div>
        </div>

        {(rec.key_changes.length || rec.risks.length || rec.suggested_edits.length) ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] w-full justify-between">
                <span>Why? Show details</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
              {rec.key_changes.length > 0 && (
                <Section title="Key changes" items={rec.key_changes} icon={Lightbulb} tone="text-foreground/80" />
              )}
              {rec.risks.length > 0 && (
                <Section title="Risks" items={rec.risks} icon={AlertTriangle} tone="text-amber-700" />
              )}
              {rec.suggested_edits.length > 0 && (
                <Section title="Suggested edits" items={rec.suggested_edits} icon={Scale} tone="text-indigo-700" />
              )}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
};

const Section = ({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: any; tone: string }) => (
  <div className="rounded border bg-background p-2">
    <p className={`text-[11px] font-semibold mb-1 flex items-center gap-1 ${tone}`}>
      <Icon className="h-3 w-3" /> {title}
    </p>
    <ul className="space-y-0.5 text-[11px] text-foreground/80">
      {items.map((it, i) => <li key={i} className="leading-snug">• {it}</li>)}
    </ul>
  </div>
);
