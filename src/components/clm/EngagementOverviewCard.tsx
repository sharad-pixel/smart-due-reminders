import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, FileText, Users, Building2, Sparkles } from "lucide-react";
import { useEngagementProfile } from "@/hooks/useEngagementProfile";
import {
  INDUSTRIES, ENGAGEMENT_TYPES, BUSINESS_MODELS, APPROVER_LABELS, RISK_BADGE,
} from "@/lib/clm/engagementConfig";

interface Props { instanceId: string; }

const labelOf = <T extends { id: string; label: string }>(arr: T[], id?: string | null) =>
  arr.find((x) => x.id === id)?.label ?? null;

export const EngagementOverviewCard = ({ instanceId }: Props) => {
  const { data, isLoading } = useEngagementProfile(instanceId);
  if (isLoading || !data?.profile) return null;

  const { profile, documents, compliance, approvals } = data;
  const totalDocs = documents.length;
  const completedDocs = documents.filter((d) => d.status === "complete").length;
  const docPct = totalDocs ? (completedDocs / totalDocs) * 100 : 0;
  const risk = RISK_BADGE[profile.risk_level];

  return (
    <Card className="mt-4 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Engagement Overview
          </CardTitle>
          <Badge variant="outline" className={risk.className}>{risk.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3" /> Industries
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.industries.length ? profile.industries.map((id) => (
                <Badge key={id} variant="secondary" className="font-normal">
                  {labelOf(INDUSTRIES, id) ?? id}
                </Badge>
              )) : <span className="text-muted-foreground">—</span>}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Engagement type</div>
            <div className="font-medium">{labelOf(ENGAGEMENT_TYPES, profile.engagement_type) ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Business model</div>
            <div className="font-medium">{labelOf(BUSINESS_MODELS, profile.business_model) ?? "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Required documents
              </span>
              <span className="font-medium">{completedDocs}/{totalDocs}</span>
            </div>
            <Progress value={docPct} className="h-1.5" />
            <div className="flex flex-wrap gap-1 mt-2">
              {documents.slice(0, 5).map((d) => (
                <Badge key={d.id} variant={d.status === "complete" ? "default" : "outline"}
                  className="text-xs font-normal">
                  {d.document_type}
                </Badge>
              ))}
              {documents.length > 5 && (
                <Badge variant="outline" className="text-xs font-normal">+{documents.length - 5}</Badge>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <ShieldCheck className="h-3 w-3" /> Compliance ({compliance.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {compliance.length ? compliance.map((c) => (
                <Badge key={c.id} variant="outline" className="text-xs font-normal bg-emerald-50">
                  {c.label}
                </Badge>
              )) : <span className="text-xs text-muted-foreground">No flags</span>}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Users className="h-3 w-3" /> Approval routing
            </div>
            <div className="flex flex-wrap gap-1">
              {approvals.length ? approvals.map((a) => (
                <Badge key={a.id} variant="outline" className="text-xs font-normal">
                  {APPROVER_LABELS[a.approver_role] ?? a.approver_role}
                </Badge>
              )) : <span className="text-xs text-muted-foreground">None</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
