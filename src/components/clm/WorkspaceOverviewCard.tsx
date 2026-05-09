import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { getBusinessProfile } from "@/lib/clm/businessProfiles";
import { LifecycleStatusChip } from "./LifecycleStatusChip";

interface Props {
  instance: any;
  debtors: any[];
}

export const WorkspaceOverviewCard = ({ instance, debtors }: Props) => {
  const linked = debtors[0];
  const debtor = linked?.debtors;
  const profileId = (instance?.business_profile as string) ?? "general";
  const profile = getBusinessProfile(profileId);
  const profileMeta = (instance?.profile_metadata ?? {}) as Record<string, any>;
  const lifecycle = (instance?.lifecycle_label as string) ?? "internal_draft";
  const metaPreview = Object.entries(profileMeta).filter(([, v]) => v !== "" && v !== null && v !== undefined).slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Workspace Overview</CardTitle>
          <CardDescription>Audit trail snapshot of this engagement</CardDescription>
        </div>
        <LifecycleStatusChip status={lifecycle} />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-2 rounded border p-3 bg-muted/30">
            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Associated Account
              </p>
              {debtor ? (
                <>
                  <p className="text-sm font-medium truncate">{debtor.company_name ?? debtor.name ?? "—"}</p>
                  {debtor.email && <p className="text-xs text-muted-foreground truncate">{debtor.email}</p>}
                  {linked.role && (
                    <Badge variant="outline" className="mt-1 text-[10px] capitalize">{linked.role}</Badge>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No account linked</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded border p-3 bg-muted/30">
            <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Business Profile
              </p>
              <p className="text-sm font-medium truncate">{profile.label}</p>
              {metaPreview.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {metaPreview.map(([k, v]) => {
                    const fieldDef = profile.fields.find((f) => f.key === k);
                    const label = fieldDef?.label ?? k;
                    const display = fieldDef?.type === "boolean" ? (v ? "Yes" : "No") : String(v);
                    return (
                      <Badge key={k} variant="outline" className="text-[10px]">
                        {label}: {display}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No commercial details captured</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded border p-3 bg-muted/30">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Workspace Created
              </p>
              <p className="text-sm font-medium">{format(new Date(instance.created_at), "PPP")}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(instance.created_at), "p")}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
