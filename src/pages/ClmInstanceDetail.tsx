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
import { EngagementOverviewCard } from "@/components/clm/EngagementOverviewCard";
import { ApprovalWorkspace } from "@/components/clm/approvals/ApprovalWorkspace";
import { SignatureReadyButton } from "@/components/clm/approvals/SignatureReadyButton";
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
      <SEO title={`${instance.name} | Contract Workspace`} description="Contract Intelligence collaboration workspace" />
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
            <SignatureReadyButton instanceId={id!} onClick={() => setPkgOpen(true)} />
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
      <EngagementOverviewCard instanceId={id!} />

      <div className="mt-6">
        <DraftSubmissionBar instanceId={id!} contacts={contacts} externalAccess={externalAccess as any[]} />
      </div>

      <Tabs defaultValue="documents" className="mt-6">
        <TabsList className="grid grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Documents</TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Review</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Approvals</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-3.5 w-3.5" /> Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
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
        </TabsContent>

        <TabsContent value="review" className="mt-4 space-y-6">
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
          <RevisionHistoryPanel
            instanceId={id!}
            contacts={contacts}
            externalAccess={externalAccess as any[]}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <ApprovalWorkspace
            instanceId={id!}
            instanceStatus={instance.status}
            contacts={contacts}
            externalAccess={externalAccess as any[]}
            myRole={myRoleInfo?.role}
            myUserId={myRoleInfo?.userId}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogPanel instanceId={id!} />
        </TabsContent>
      </Tabs>

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
