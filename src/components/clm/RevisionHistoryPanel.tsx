import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch } from "lucide-react";
import { useInstanceRevisions, useClmInstance } from "@/hooks/useClmInstance";
import { useMyClmRole } from "@/hooks/useMyClmRole";
import { RevisionChangeCard } from "./RevisionChangeCard";

interface Props {
  instanceId: string;
  contacts?: any[];
  externalAccess?: any[];
}

export const RevisionHistoryPanel = ({ instanceId, contacts = [], externalAccess = [] }: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  const { data: instanceData } = useClmInstance(instanceId);
  const instance = (instanceData as any)?.instance;
  const ctx = contacts.length ? contacts : (instanceData as any)?.contacts ?? [];
  const ext = externalAccess;
  const { data: me } = useMyClmRole(instanceId, ctx, ext, instance);

  const [filter, setFilter] = useState<"all" | "pending" | "tagged">("all");

  const mentionables = useMemo(() => {
    const map = new Map<string, { email: string; name?: string | null; role?: string | null }>();
    ctx.forEach((c: any) => {
      if (c.email) map.set(c.email.toLowerCase(), { email: c.email.toLowerCase(), name: c.name, role: c.role });
    });
    ext.forEach((e: any) => {
      if (e.email && !e.revoked_at) {
        map.set(e.email.toLowerCase(), { email: e.email.toLowerCase(), name: e.name, role: e.role });
      }
    });
    return Array.from(map.values());
  }, [ctx, ext]);

  const myEmail = me?.email ?? "";
  const taggedForMe = (revisions as any[]).filter((r) =>
    (r.requested_reviewers ?? []).includes(myEmail)
  );

  const filtered =
    filter === "pending" ? (revisions as any[]).filter((r) => r.approval_status === "pending") :
    filter === "tagged"  ? taggedForMe :
    revisions as any[];

  const pendingCount = (revisions as any[]).filter((r) => r.approval_status === "pending").length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-3 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Change Tracking & Approvals
          </CardTitle>
          <CardDescription>
            Every edit is logged. Approve, revert, tag reviewers, or thread a discussion on any change.
          </CardDescription>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
            Pending {pendingCount > 0 && <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>}
          </Button>
          <Button size="sm" variant={filter === "tagged" ? "default" : "outline"} onClick={() => setFilter("tagged")}>
            Tagged me {taggedForMe.length > 0 && <Badge variant="secondary" className="ml-1">{taggedForMe.length}</Badge>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {filter === "tagged" ? "No changes are waiting on you." : "No changes yet."}
          </p>
        ) : (
          filtered.map((r: any) => (
            <RevisionChangeCard
              key={r.id}
              instanceId={instanceId}
              revision={r}
              myRole={me?.role}
              myUserId={me?.userId}
              mentionables={mentionables}
              defaultOpen={r.approval_status === "pending" && filter !== "all"}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};
