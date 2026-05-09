import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Loader2, FileText, Users } from "lucide-react";
import { useClmInstance, useUpdateInstanceStatus } from "@/hooks/useClmInstance";
import { ContributorsPanel } from "@/components/clm/ContributorsPanel";
import { WorkspaceOverviewCard } from "@/components/clm/WorkspaceOverviewCard";
import { SectionCommentsPanel } from "@/components/clm/SectionCommentsPanel";
import { SectionEditDialog } from "@/components/clm/SectionEditDialog";
import { SectionVersionHistoryDialog } from "@/components/clm/SectionVersionHistoryDialog";
import { ApprovalsPanel } from "@/components/clm/ApprovalsPanel";
import { ExternalPortalAccessPanel } from "@/components/clm/ExternalPortalAccessPanel";
import { useInstanceRevisions } from "@/hooks/useClmInstance";
import { formatDistanceToNow } from "date-fns";
import { History, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { TemplateCollaboratorsDialog } from "@/components/clm/TemplateCollaboratorsDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/seo/SEO";

const ApprovalsPanelWithAccess = ({ instanceId, contacts }: { instanceId: string; contacts: any[] }) => {
  const { data: externalAccess = [] } = useQuery({
    queryKey: ["clm-external-access", instanceId],
    queryFn: async () => {
      const { data } = await (supabase.from("clm_external_access" as any) as any)
        .select("email, name, role, revoked_at, expires_at")
        .eq("instance_id", instanceId);
      return data ?? [];
    },
  });
  return <ApprovalsPanel instanceId={instanceId} contacts={contacts} externalAccess={externalAccess} />;
};

const WorkspaceTemplateRow = ({
  instanceId, templateId, templateName, isPrimary, debtorId, contacts,
}: {
  instanceId: string; templateId: string; templateName: string;
  isPrimary?: boolean; debtorId: string | null; contacts: any[];
}) => {
  const [open, setOpen] = useState(false);
  const count = contacts.filter((c: any) => c.template_id === templateId).length;
  return (
    <>
      <div className="flex items-center justify-between rounded border p-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">{templateName}</span>
          {isPrimary
            ? <Badge variant="default" className="text-[10px]">Primary</Badge>
            : <Badge variant="outline" className="text-[10px]">Bundled</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
          <Users className="h-3.5 w-3.5 mr-1" />
          {count > 0 ? `${count} collab.` : "Invite"}
        </Button>
      </div>
      <TemplateCollaboratorsDialog
        open={open}
        onOpenChange={setOpen}
        instanceId={instanceId}
        templateId={templateId}
        templateName={templateName}
        debtorId={debtorId}
        allLinkedContacts={contacts}
      />
    </>
  );
};

const Inner = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useClmInstance(id);
  const updateStatus = useUpdateInstanceStatus(id ?? "");

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const { instance, sections, debtors, contacts, comments, extraTemplates = [] } = data as any;
  const sourceTemplateName = instance.clm_templates?.name ?? instance.template_name_snapshot ?? "template";
  const sourceTemplateLink = instance.clm_templates?.id
    ? `/contracts/templates/${instance.clm_templates.id}`
    : null;

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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] mt-6">
        <SectionsList instanceId={id!} sections={sections} comments={comments} />


        <div className="space-y-4">
          <ApprovalsPanelWithAccess instanceId={id!} contacts={contacts} />
          <ExternalPortalAccessPanel instanceId={id!} />
          <ContributorsPanel instanceId={id!} contacts={contacts} debtors={debtors} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Templates in this workspace</CardTitle>
              <CardDescription>Click a template to invite collaborators specific to that contract.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {instance.template_id && (
                <WorkspaceTemplateRow
                  instanceId={id!}
                  templateId={instance.template_id}
                  templateName={instance.clm_templates?.name ?? instance.template_name_snapshot ?? "Primary template"}
                  isPrimary
                  debtorId={debtors[0]?.debtor_id ?? null}
                  contacts={contacts.filter((c: any) => !c.is_internal)}
                />
              )}
              {extraTemplates.map((t: any) => (
                <WorkspaceTemplateRow
                  key={t.id}
                  instanceId={id!}
                  templateId={t.template_id}
                  templateName={t.template_name_snapshot ?? t.clm_templates?.name ?? "—"}
                  debtorId={debtors[0]?.debtor_id ?? null}
                  contacts={contacts.filter((c: any) => !c.is_internal)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default function ClmInstanceDetail() {
  return <Layout><RequireClmAccess><Inner /></RequireClmAccess></Layout>;
}
