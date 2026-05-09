import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ShieldCheck, X, Building2, Briefcase, Users as UsersIcon, KeyRound, ChevronDown, ChevronUp } from "lucide-react";
import { ContributorsPanel } from "./ContributorsPanel";
import { ExternalPortalAccessPanel } from "./ExternalPortalAccessPanel";
import { useRemoveInstanceContact } from "@/hooks/useClmInstance";
import { CAPABILITY_LABEL, getRoleMeta, type ClmCapabilities } from "@/lib/clmRoles";

interface Member {
  key: string;
  name: string;
  email?: string;
  title?: string;
  role: string;
  source: "internal" | "external" | "portal";
  contactId?: string; // for delete
  ownerOf?: boolean;
}

interface Props {
  instanceId: string;
  instance: any;
  contacts: any[];
  externalAccess?: any[];
  debtors: any[];
}

export const AccessSidebar = ({ instanceId, instance, contacts, externalAccess = [], debtors }: Props) => {
  const [showInvite, setShowInvite] = useState(false);
  const remove = useRemoveInstanceContact(instanceId);

  const members = useMemo<Member[]>(() => {
    const list: Member[] = [];
    const seen = new Set<string>();

    // Owner — workspace creator
    if (instance.created_by) {
      list.push({
        key: `owner-${instance.created_by}`,
        name: "Workspace owner",
        email: undefined,
        role: "owner",
        source: "internal",
        ownerOf: true,
      });
    }

    contacts.forEach((c) => {
      const email = (c.is_internal ? c.email : c.debtor_contacts?.email ?? c.email) || "";
      const name = (c.is_internal ? c.name : c.debtor_contacts?.name ?? c.name) || email || "—";
      const title = c.is_internal ? c.title : c.debtor_contacts?.title ?? c.title;
      const k = (email || c.id).toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push({
        key: c.id,
        name,
        email,
        title,
        role: c.role || (c.is_internal ? "reviewer" : "reviewer"),
        source: c.is_internal ? "internal" : "external",
        contactId: c.id,
      });
    });

    externalAccess.forEach((a: any) => {
      if (a.revoked_at) return;
      const k = (a.email || a.id || "").toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      list.push({
        key: `portal-${a.email || a.id}`,
        name: a.name || a.email,
        email: a.email,
        role: a.role || "reviewer",
        source: "portal",
      });
    });

    return list;
  }, [contacts, externalAccess, instance.created_by]);

  const internalCount = members.filter((m) => m.source === "internal").length;
  const externalCount = members.filter((m) => m.source !== "internal").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Access ({members.length})
            </CardTitle>
            <CardDescription>Who can see this workspace and what they can do.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowInvite((v) => !v)} className="shrink-0">
            {showInvite ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            Invite
          </Button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{internalCount} internal</span>
          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{externalCount} external</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">No collaborators yet.</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <MemberRow
                key={m.key}
                member={m}
                onRemove={m.contactId && !m.ownerOf ? () => remove.mutate(m.contactId!) : undefined}
              />
            ))}
          </div>
        )}

        {showInvite && (
          <div className="pt-3 border-t mt-3 space-y-3">
            <Tabs defaultValue="internal">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="internal" className="text-xs"><Briefcase className="h-3 w-3 mr-1" />Internal</TabsTrigger>
                <TabsTrigger value="external" className="text-xs"><Building2 className="h-3 w-3 mr-1" />External</TabsTrigger>
                <TabsTrigger value="portal" className="text-xs"><KeyRound className="h-3 w-3 mr-1" />Portal link</TabsTrigger>
              </TabsList>
              <TabsContent value="internal" className="mt-3">
                <ContributorsPanel instanceId={instanceId} contacts={contacts} debtors={debtors} />
              </TabsContent>
              <TabsContent value="external" className="mt-3">
                <ContributorsPanel instanceId={instanceId} contacts={contacts} debtors={debtors} />
              </TabsContent>
              <TabsContent value="portal" className="mt-3">
                <ExternalPortalAccessPanel instanceId={instanceId} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MemberRow = ({ member, onRemove }: { member: Member; onRemove?: () => void }) => {
  const meta = getRoleMeta(member.role);
  const Icon = meta.icon;
  const initial = (member.name || member.email || "?").trim().charAt(0).toUpperCase();
  const enabledCaps = (Object.keys(meta.caps) as (keyof ClmCapabilities)[]).filter((k) => meta.caps[k] && k !== "view");

  return (
    <div className="rounded border p-2 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{member.name}</p>
            <Badge variant="outline" className={`${meta.tone} text-[10px] h-4 px-1.5`}>
              <Icon className="h-2.5 w-2.5 mr-0.5" />{meta.label}
            </Badge>
            {member.source === "portal" && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-dashed">Portal</Badge>
            )}
            {member.ownerOf && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-dashed">You</Badge>
            )}
          </div>
          {member.email && (
            <p className="text-[11px] text-muted-foreground truncate">{member.email}{member.title ? ` · ${member.title}` : ""}</p>
          )}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {enabledCaps.length === 0 ? (
              <span className="text-[10px] text-muted-foreground italic">View only</span>
            ) : enabledCaps.map((c) => (
              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                {CAPABILITY_LABEL[c].short}
              </span>
            ))}
          </div>
        </div>
        {onRemove && (
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
