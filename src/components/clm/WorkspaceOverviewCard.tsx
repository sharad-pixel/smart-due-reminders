import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import DocumentsList from "@/components/documents/DocumentsList";

interface Props {
  instance: any;
  debtors: any[];
}

export const WorkspaceOverviewCard = ({ instance, debtors }: Props) => {
  const linked = debtors[0];
  const debtor = linked?.debtors;
  const debtorId = linked?.debtor_id ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace Overview</CardTitle>
        <CardDescription>Audit trail snapshot of this engagement</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded border p-3 bg-muted/30">
            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Associated Account
              </p>
              {debtor ? (
                <>
                  <p className="text-sm font-medium truncate">{debtor.company_name ?? debtor.name ?? "—"}</p>
                  {debtor.email && (
                    <p className="text-xs text-muted-foreground truncate">{debtor.email}</p>
                  )}
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
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Workspace Created
              </p>
              <p className="text-sm font-medium">
                {format(new Date(instance.created_at), "PPP")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(instance.created_at), "p")}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Associated Documents</p>
          </div>
          {debtorId ? (
            <DocumentsList debtorId={debtorId} isParentAccount={false} />
          ) : (
            <p className="text-xs text-muted-foreground italic px-1 py-2">
              Link an account to surface its documents.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
