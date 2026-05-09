import { useMemo } from "react";
import { ApprovalSidebar } from "./ApprovalSidebar";
import { ApprovalGroupedList } from "./ApprovalGroupedList";
import { ApprovalTimeline } from "./ApprovalTimeline";
import { FinalizationPanel } from "./FinalizationPanel";
import { ApprovalsPanel } from "@/components/clm/ApprovalsPanel";
import { VersionTimelinePanel } from "@/components/clm/VersionTimelinePanel";

interface Props {
  instanceId: string;
  instanceStatus: string;
  contacts: any[];
  externalAccess: any[];
  myRole?: string | null;
  myUserId?: string | null;
}

export const ApprovalWorkspace = ({
  instanceId, instanceStatus, contacts, externalAccess, myRole, myUserId,
}: Props) => {
  const mentionables = useMemo(() => {
    const list: { email: string; name?: string | null; role?: string | null }[] = [];
    for (const c of contacts) {
      if (c?.email) list.push({ email: c.email, name: c.name ?? null, role: c.role ?? null });
    }
    for (const e of externalAccess) {
      if (e?.email && !list.find((x) => x.email === e.email)) {
        list.push({ email: e.email, name: e.name ?? null, role: e.role ?? "external" });
      }
    }
    return list;
  }, [contacts, externalAccess]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      <div className="space-y-4 min-w-0">
        <FinalizationPanel instanceId={instanceId} />
        <ApprovalGroupedList
          instanceId={instanceId}
          myRole={myRole}
          myUserId={myUserId}
          mentionables={mentionables}
        />
        <ApprovalsPanel instanceId={instanceId} contacts={contacts} externalAccess={externalAccess} />
        <ApprovalTimeline instanceId={instanceId} instanceStatus={instanceStatus} />
        <VersionTimelinePanel instanceId={instanceId} myRole={myRole} />
      </div>
      <aside className="space-y-3">
        <ApprovalSidebar instanceId={instanceId} />
      </aside>
    </div>
  );
};
