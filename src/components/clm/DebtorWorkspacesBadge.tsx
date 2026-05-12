import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Briefcase, ExternalLink } from "lucide-react";

const useDebtorClmWorkspaces = (debtorId: string) =>
  useQuery({
    queryKey: ["debtor-clm-workspaces", debtorId],
    enabled: !!debtorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clm_instance_debtors")
        .select("instance_id, clm_template_instances(id, name, status, template_name_snapshot, created_at)")
        .eq("debtor_id", debtorId);
      if (error) return [];
      return (data ?? [])
        .map((r: any) => r.clm_template_instances)
        .filter(Boolean);
    },
  });

/**
 * Shows a compact "X CLM workspaces" badge on a debtor account.
 * Hover reveals each workspace with status + a deep link.
 */
export const DebtorWorkspacesBadge = ({ debtorId }: { debtorId: string }) => {
  const { data = [] } = useDebtorClmWorkspaces(debtorId);

  if (data.length === 0) return null;

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <Link to={`/contracts/instances/${data[0].id}`}>
          <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
            <Briefcase className="h-3 w-3" />
            {data.length} CLM {data.length === 1 ? "workspace" : "workspaces"}
          </Badge>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 p-2">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Active contract workspaces</p>
        <div className="space-y-1">
          {data.map((w: any) => (
            <Link
              key={w.id}
              to={`/contracts/instances/${w.id}`}
              className="flex items-center justify-between gap-2 rounded p-2 hover:bg-muted text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{w.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {w.template_name_snapshot ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {String(w.status ?? "draft").replace("_", " ")}
                </Badge>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export const DebtorWorkspacesCard = ({ debtorId }: { debtorId: string }) => {
  const { data = [] } = useDebtorClmWorkspaces(debtorId);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Contract Workspaces
            </CardTitle>
            <CardDescription>
              Prospect contracting workspaces linked to this account
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {data.length} {data.length === 1 ? "workspace" : "workspaces"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {data.map((w: any) => (
          <Link
            key={w.id}
            to={`/contracts/instances/${w.id}`}
            className="rounded-md border p-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{w.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {w.template_name_snapshot ?? "Workspace"}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                {String(w.status ?? "draft").replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 px-2 pointer-events-none">
                Open workspace <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
};
