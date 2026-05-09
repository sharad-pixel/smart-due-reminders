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
import { KurtChatDrawer } from "@/components/clm/KurtChatDrawer";
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

const SectionsList = ({
  instanceId, sections, comments, contacts,
}: { instanceId: string; sections: any[]; comments: any[]; contacts: any[] }) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  // index revisions per section_id
  const revsBySection = (revisions as any[]).reduce((m, r) => {
    const arr = m.get(r.section_id) ?? [];
    arr.push(r);
    m.set(r.section_id, arr);
    return m;
  }, new Map<string, any[]>());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sections</CardTitle>
        <CardDescription>Discuss each clause, track every change, and route revisions for approval.</CardDescription>
      </CardHeader>
      <CardContent>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading sections from template…</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {sections.map((s: any) => {
              const sectionRevs = (revsBySection.get(s.id) ?? [])
                .sort((a: any, b: any) => (b.version_number ?? 0) - (a.version_number ?? 0));
              const latest = sectionRevs[0];
              const currentVersion = latest?.version_number ?? 1;
              const pendingCount = sectionRevs.filter((r: any) => r.approval_status === "pending").length;
              const commentCount = comments.filter((c: any) => c.section_key === s.section_key).length;

              return (
                <AccordionItem key={s.id} value={s.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2 flex-wrap text-left">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px] h-5">v{currentVersion}</Badge>
                      {pendingCount > 0 ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5">
                          <Clock className="h-2.5 w-2.5 mr-1" />{pendingCount} pending
                        </Badge>
                      ) : latest?.approval_status === "approved" ? (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] h-5">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Approved
                        </Badge>
                      ) : null}
                      {commentCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          <MessageSquare className="h-2.5 w-2.5 mr-1" />{commentCount}
                        </Badge>
                      )}
                      {latest && (
                        <span className="text-[11px] text-muted-foreground ml-1">
                          · {latest.edited_by_name || "Edited"} {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {s.ai_summary && (
                      <div className="rounded bg-primary/5 border border-primary/20 p-3 mb-3">
                        <p className="text-sm">{s.ai_summary}</p>
                      </div>
                    )}
                    {s.body && (
                      <div className="rounded border p-3 bg-muted/30 mb-3">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.body}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="text-[11px] text-muted-foreground">
                        {sectionRevs.length} version{sectionRevs.length === 1 ? "" : "s"} on record
                      </div>
                      <div className="flex gap-1">
                        <SectionVersionHistoryDialog
                          instanceId={instanceId}
                          section={s}
                          trigger={
                            <Button size="sm" variant="ghost">
                              <History className="h-3.5 w-3.5 mr-1" /> History
                            </Button>
                          }
                        />
                        <SectionEditDialog instanceId={instanceId} section={s} currentVersion={currentVersion} contacts={contacts} />
                      </div>
                    </div>
                    <SectionCommentsPanel instanceId={instanceId} sectionKey={s.section_key} comments={comments} />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
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
            <KurtChatDrawer instanceId={id!} instanceName={instance.name} />
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
        <SectionsList instanceId={id!} sections={sections} comments={comments} contacts={contacts} />


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
