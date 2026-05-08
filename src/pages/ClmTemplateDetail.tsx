import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { RequireClmAccess } from "@/components/clm/RequireClmAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertTriangle, RefreshCw, Sparkles, Play } from "lucide-react";
import { useClmTemplate, useResectionalize } from "@/hooks/useClmTemplates";
import { TemplateActionsMenu } from "@/components/clm/TemplateActionsMenu";
import { TemplateAssessmentPanel } from "@/components/clm/TemplateAssessmentPanel";
import { ContractDocumentViewer } from "@/components/clm/ContractDocumentViewer";
import { ClmBrandedHeader } from "@/components/clm/ClmBrandedHeader";
import { UseTemplateDialog } from "@/components/clm/UseTemplateDialog";
import SEO from "@/components/seo/SEO";

const Inner = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data, isLoading } = useClmTemplate(id);
  const resect = useResectionalize();
  const [useOpen, setUseOpen] = useState(false);

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const { template, sections } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SEO title={`${template.name} | Template`} description="CLM template breakdown" />
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/contracts"><ArrowLeft className="h-4 w-4 mr-1" />Back to Contracts</Link>
      </Button>

      <ClmBrandedHeader
        title={template.name}
        subtitle={template.description ?? undefined}
        meta={template.source_file_name ?? undefined}
        rightSlot={
          <>
            <Badge variant={template.status === "ready" ? "default" : template.status === "failed" ? "destructive" : "secondary"}>
              {template.status === "parsing" ? "Sectionalizing…" : template.status}
            </Badge>
            {template.status === "ready" && (
              <Button onClick={() => setUseOpen(true)}><Play className="h-4 w-4 mr-1" />Use Template</Button>
            )}
            {template.status === "failed" && (
              <Button variant="outline" onClick={() => resect.mutate(template.id)}>
                <RefreshCw className="h-4 w-4 mr-1" />Retry
              </Button>
            )}
            <TemplateActionsMenu template={template} redirectOnDelete inline />
          </>
        }
      />

      {template.status === "parsing" && (
        <Card className="mb-4">
          <CardContent className="py-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">AI is breaking down your contract into standard sections. This usually takes 10–30 seconds…</p>
          </CardContent>
        </Card>
      )}

      {template.parse_error && (
        <Card className="mb-4 border-destructive">
          <CardContent className="py-4 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" /> {template.parse_error}
          </CardContent>
        </Card>
      )}

      <div className="mb-4">
        <TemplateAssessmentPanel template={template} />
      </div>

      <div className="mb-4">
        <ContractDocumentViewer
          rawText={(template as any).raw_text}
          keyRisks={(template.assessment as any)?.key_risks ?? []}
          ignoredIndices={Array.isArray(template.assessment_ignored_risks) ? template.assessment_ignored_risks : []}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Sectionalization</CardTitle>
          <CardDescription>{sections.length} sections extracted</CardDescription>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {template.status === "ready" ? "No sections found." : "Waiting for AI extraction…"}
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {sections.map((s) => (
                <AccordionItem key={s.id} value={s.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-medium">{s.title}</span>
                      {Array.isArray(s.risk_flags) && s.risk_flags.length > 0 && (
                        <Badge variant="destructive" className="text-xs">{s.risk_flags.length} flag{s.risk_flags.length > 1 ? "s" : ""}</Badge>
                      )}
                      {!s.body && <Badge variant="outline" className="text-xs">empty</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {s.ai_summary && (
                        <div className="rounded bg-primary/5 border border-primary/20 p-3">
                          <p className="text-xs font-semibold text-primary mb-1">AI Summary</p>
                          <p className="text-sm">{s.ai_summary}</p>
                        </div>
                      )}
                      {Array.isArray(s.risk_flags) && s.risk_flags.length > 0 && (
                        <div className="rounded bg-destructive/5 border border-destructive/20 p-3">
                          <p className="text-xs font-semibold text-destructive mb-1">Risk Flags</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {s.risk_flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                      {s.body && (
                        <div className="rounded border p-3 bg-muted/30">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Section Text</p>
                          <p className="text-sm whitespace-pre-wrap">{s.body}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <UseTemplateDialog
        open={useOpen}
        onOpenChange={setUseOpen}
        primaryTemplateId={template.id}
        primaryTemplateName={template.name}
        onCreated={(instanceId) => nav(`/contracts/instances/${instanceId}`)}
      />
    </div>
  );
};

export default function ClmTemplateDetail() {
  return <Layout><RequireClmAccess><Inner /></RequireClmAccess></Layout>;
}
