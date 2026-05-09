import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, PenLine, FileText, MessageSquare, ShieldCheck, History } from "lucide-react";
import { useClmInstance, useUpdateInstanceStatus } from "@/hooks/useClmInstance";
import { WorkspaceOverviewCard } from "@/components/clm/WorkspaceOverviewCard";
import { ApprovalsPanel } from "@/components/clm/ApprovalsPanel";
import { TrackChangesAndCollaborators } from "@/components/clm/TrackChangesAndCollaborators";
import { WorkspaceTemplateTabs } from "@/components/clm/WorkspaceTemplateTabs";
import { PrepareSignaturePackageDialog } from "@/components/clm/PrepareSignaturePackageDialog";
import { DraftSubmissionBar } from "@/components/clm/DraftSubmissionBar";
import { RevisionHistoryPanel } from "@/components/clm/RevisionHistoryPanel";
import { AuditLogPanel } from "@/components/clm/AuditLogPanel";
import { RoleCapabilitiesDialog } from "@/components/clm/RoleCapabilitiesDialog";
import { VersionTimelinePanel } from "@/components/clm/VersionTimelinePanel";
import { VersionPill } from "@/components/clm/VersionPill";
import { useMyClmRole } from "@/hooks/useMyClmRole";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { KurtChatDrawer } from "@/components/clm/KurtChatDrawer";
import { PushToGoogleDocsButton } from "@/components/clm/PushToGoogleDocsButton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/seo/SEO";

const useExternalAccess = (instanceId: string | undefined) =>
  useQuery({
    queryKey: ["clm-external-access", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data } = await (supabase.from("clm_external_access" as any) as any)
        .select("email, name, role, revoked_at, expires_at")
        .eq("instance_id", instanceId!);
      return data ?? [];
    },
  });

const Inner = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useClmInstance(id);
  const updateStatus = useUpdateInstanceStatus(id ?? "");
  const { data: externalAccess = [] } = useExternalAccess(id);
  const contactsForRole = ((data as any)?.contacts ?? []) as any[];
  const { data: myRoleInfo } = useMyClmRole(id, contactsForRole, externalAccess as any[], (data as any)?.instance);
  const [pkgOpen, setPkgOpen] = useState(false);

  const instance = (data as any)?.instance;
  const extraTemplates = (data as any)?.extraTemplates ?? [];

  const templatesForPackage = useMemo(() => {
    const list: { template_id: string; template_name: string; is_primary: boolean }[] = [];
    if (!instance) return list;
    if (instance.template_id) {
      list.push({
        template_id: instance.template_id,
        template_name: instance.clm_templates?.name ?? instance.template_name_snapshot ?? "Primary template",
        is_primary: true,
      });
    }
    extraTemplates.forEach((t: any) => list.push({
      template_id: t.template_id,
      template_name: t.template_name_snapshot ?? t.clm_templates?.name ?? "—",
      is_primary: false,
    }));
    return list;
  }, [instance, extraTemplates]);

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const { sections, debtors, contacts, comments } = data as any;
  const sourceTemplateName = instance.clm_templates?.name ?? instance.template_name_snapshot ?? "template";
  const sourceTemplateLink = instance.clm_templates?.id ? `/contracts/templates/${instance.clm_templates.id}` : null;
  const debtorId = debtors[0]?.debtor_id ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={`${instance.name} | CLM Workspace`} description="CLM collaboration workspace" />
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/contracts"><ArrowLeft className="h-4 w-4 mr-1" />Back to Contracts</Link>
      </Button>

      <ClmBrandedHeader
        title={instance.name}
        subtitle={
          sourceTemplateLink
            ? `Based on ${sourceTemplateName}`
            : `Based on ${sourceTemplateName} (template removed — workspace uses its own copy)`
        }
        rightSlot={
          <>
            <Button size="sm" onClick={() => setPkgOpen(true)} className="gap-1">
              <PenLine className="h-3.5 w-3.5" /> Prepare for signature
            </Button>
            <PushToGoogleDocsButton
              instanceId={id!}
              gdocUrl={(instance as any).gdoc_url}
              gdocSyncedAt={(instance as any).gdoc_synced_at}
            />
            <RoleCapabilitiesDialog myRole={myRoleInfo?.role} />
            <KurtChatDrawer instanceId={id!} instanceName={instance.name} />
            <VersionPill instanceId={id!} />
            <Badge variant="outline" className="capitalize">{instance.status.replace("_", " ")}</Badge>
            <Select value={instance.status} onValueChange={(v) => updateStatus.mutate(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="executed">Executed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <WorkspaceOverviewCard instance={instance} debtors={debtors} />

      <div className="mt-6">
        <DraftSubmissionBar instanceId={id!} contacts={contacts} externalAccess={externalAccess as any[]} />
      </div>

      {/* Top bar: Collaborators + Track changes & comments — moved above templates */}
      <div className="mt-6">
        <TrackChangesAndCollaborators
          instanceId={id!}
          instance={instance}
          contacts={contacts}
          externalAccess={externalAccess as any[]}
          debtors={debtors}
          comments={comments}
          sections={sections}
          myRole={myRoleInfo?.role}
        />
      </div>

      {/* Full-width templates */}
      <div className="mt-6">
        <WorkspaceTemplateTabs
          instanceId={id!}
          primaryTemplateId={instance.template_id ?? null}
          primaryTemplateName={instance.clm_templates?.name ?? instance.template_name_snapshot ?? "Primary template"}
          extraTemplates={extraTemplates}
          sections={sections}
          comments={comments}
          contacts={contacts}
          externalAccess={externalAccess as any[]}
          debtorId={debtorId}
          myRole={myRoleInfo?.role}
        />
      </div>

      <div className="mt-6">
        <ApprovalsPanel instanceId={id!} contacts={contacts} externalAccess={externalAccess as any[]} />
      </div>

      <div className="mt-6 space-y-6">
        <VersionTimelinePanel instanceId={id!} myRole={myRoleInfo?.role} />
        <RevisionHistoryPanel
          instanceId={id!}
          contacts={contacts}
          externalAccess={externalAccess as any[]}
        />
        <AuditLogPanel instanceId={id!} />
      </div>

      <PrepareSignaturePackageDialog
        open={pkgOpen}
        onOpenChange={setPkgOpen}
        instanceId={id!}
        templates={templatesForPackage}
        sections={sections}
        contacts={contacts}
        externalAccess={externalAccess as any[]}
      />
    </div>
  );
};

export default function ClmInstanceDetail() {
  return <Layout><RequireClmAccess><Inner /></RequireClmAccess></Layout>;
}
