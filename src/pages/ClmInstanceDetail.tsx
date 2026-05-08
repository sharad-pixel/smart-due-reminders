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
import { InstanceAccountPicker } from "@/components/clm/InstanceAccountPicker";
import { InternalCollaboratorsPanel } from "@/components/clm/InternalCollaboratorsPanel";
import { SectionCommentsPanel } from "@/components/clm/SectionCommentsPanel";
import { SectionEditDialog } from "@/components/clm/SectionEditDialog";
import { RevisionHistoryPanel } from "@/components/clm/RevisionHistoryPanel";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { TemplateCollaboratorsDialog } from "@/components/clm/TemplateCollaboratorsDialog";
import SEO from "@/components/seo/SEO";

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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <CardDescription>Discuss each clause with your team and counterparty</CardDescription>
          </CardHeader>
          <CardContent>
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading sections from template…</p>
            ) : (
              <Accordion type="multiple" className="w-full">
                {sections.map((s) => {
                  const count = comments.filter((c: any) => c.section_key === s.section_key).length;
                  return (
                    <AccordionItem key={s.id} value={s.id}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.title}</span>
                          {count > 0 && <Badge variant="secondary" className="text-xs">{count}</Badge>}
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
                            <p className="text-sm whitespace-pre-wrap">{s.body}</p>
                          </div>
                        )}
                        <div className="flex justify-end mb-2">
                          <SectionEditDialog instanceId={id!} section={s} />
                        </div>
                        <SectionCommentsPanel instanceId={id!} sectionKey={s.section_key} comments={comments} />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <RevisionHistoryPanel instanceId={id!} />
          <InstanceAccountPicker instanceId={id!} linkedDebtors={debtors} linkedContacts={contacts.filter((c: any) => !c.is_internal)} />
          <InternalCollaboratorsPanel instanceId={id!} contacts={contacts} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Templates in this workspace</CardTitle>
              <CardDescription>Click a template to invite collaborators specific to that contract.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Primary */}
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
