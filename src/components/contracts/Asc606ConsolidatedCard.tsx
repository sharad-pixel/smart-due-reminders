import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileCheck2, Lock, ArrowRight, Loader2, CreditCard } from "lucide-react";
import { Asc606AssessmentDialog } from "@/components/contracts/Asc606AssessmentDialog";
import { Asc606ReferenceBanner } from "@/components/contracts/Asc606ReferenceBanner";

interface Props {
  contractId: string;
  accountId: string;
  contractTitle: string;
}

/**
 * Consolidated ASC 606 card that unifies the previous "AI Advisor" and
 * "Assessment" surfaces. Shows a summary + quick actions on the contract
 * detail page. Full report + AI prompts live on a dedicated details page,
 * available only once a paid assessment has been completed.
 */
export function Asc606ConsolidatedCard({ contractId, accountId, contractTitle }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: latest, isLoading } = useQuery({
    queryKey: ["asc606-latest-assessment", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("asc606_assessments")
        .select("id, status, risk_band, risk_score, completed_at, payment_method, report_jsonb")
        .eq("contract_id", contractId)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const hasPaidAssessment = !!latest?.id;

  return (
    <Card id="asc606">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            ASC 606 Compliance
            {latest?.risk_band && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                {latest.risk_band}
                {latest.risk_score != null ? ` · ${latest.risk_score}/100` : ""}
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-2">
            {hasPaidAssessment ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                  <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Re-run
                </Button>
                <Button size="sm" asChild>
                  <Link to={`/contracts/live/${contractId}/asc606`}>
                    Full report & AI advisor
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Run Assessment
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Asc606ReferenceBanner variant="inline" />

        {isLoading ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : hasPaidAssessment ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Last assessed {latest.completed_at ? new Date(latest.completed_at).toLocaleString() : ""}
              {latest.payment_method ? ` · paid via ${latest.payment_method}` : ""}
            </div>
            {latest.report_jsonb?.summary && (
              <p className="text-sm text-foreground/80 line-clamp-3">
                {latest.report_jsonb.summary}
              </p>
            )}
            <div className="text-xs text-muted-foreground pt-1 border-t">
              AI advisor prompts, key risks, missing evidence, and the full ASC 606 report
              are available on the{" "}
              <Link
                to={`/contracts/live/${contractId}/asc606`}
                className="text-primary hover:underline font-medium"
              >
                dedicated assessment page
              </Link>
              .
            </div>
          </div>
        ) : (
          <div className="border rounded-md p-4 bg-muted/30 flex items-start gap-3">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                Assessment & AI advisor are locked
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Purchase and run a paid ASC 606 assessment for this contract to unlock the
                full compliance report, missing-evidence audit, and AI Q&amp;A on revenue
                recognition, performance obligations, and risks.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Run ASC 606 Assessment
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/billing/asc606-credits">
                    <CreditCard className="h-3.5 w-3.5 mr-1" /> Buy credits
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Asc606AssessmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contractId={contractId}
        accountId={accountId}
        contractTitle={contractTitle}
      />
    </Card>
  );
}
