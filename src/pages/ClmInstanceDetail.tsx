import { useParams, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Loader2, FileSignature } from "lucide-react";
import { useClmInstance, useUpdateInstanceStatus } from "@/hooks/useClmInstance";
import { InstanceAccountPicker } from "@/components/clm/InstanceAccountPicker";
import { SectionCommentsPanel } from "@/components/clm/SectionCommentsPanel";
import SEO from "@/components/seo/SEO";

const Inner = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useClmInstance(id);
  const updateStatus = useUpdateInstanceStatus(id ?? "");

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const { instance, sections, debtors, contacts, comments } = data as any;
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

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" /> {instance.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Based on{" "}
            {sourceTemplateLink ? (
              <Link className="underline" to={sourceTemplateLink}>{sourceTemplateName}</Link>
            ) : (
              <span>{sourceTemplateName}</span>
            )}
            {!sourceTemplateLink && <span className="ml-1 italic">(template removed — workspace uses its own copy)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
          <InstanceAccountPicker instanceId={id!} linkedDebtors={debtors} />
        </div>
      </div>
    </div>
  );
};

export default function ClmInstanceDetail() {
  return <Layout><RequireClmAccess><Inner /></RequireClmAccess></Layout>;
}
