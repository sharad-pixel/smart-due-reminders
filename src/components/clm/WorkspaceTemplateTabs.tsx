import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, X, Users, Loader2, GitBranch, Rows3, FileText as FileIcon } from "lucide-react";
import { TemplateCollaboratorsDialog } from "./TemplateCollaboratorsDialog";
import { AddTemplateToWorkspaceDialog } from "./AddTemplateToWorkspaceDialog";
import { SectionsList } from "./SectionsList";
import { FullDocumentView } from "./FullDocumentView";
import { useInstanceRevisions, useRemoveTemplateFromInstance } from "@/hooks/useClmInstance";

interface TabItem {
  templateId: string;
  templateName: string;
  isPrimary: boolean;
}

interface Props {
  instanceId: string;
  primaryTemplateId: string | null;
  primaryTemplateName: string;
  extraTemplates: any[];
  sections: any[];
  comments: any[];
  contacts: any[];
  debtorId: string | null;
}

export const WorkspaceTemplateTabs = ({
  instanceId, primaryTemplateId, primaryTemplateName, extraTemplates,
  sections, comments, contacts, debtorId,
}: Props) => {
  const [addOpen, setAddOpen] = useState(false);
  const [collabOpenFor, setCollabOpenFor] = useState<TabItem | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TabItem | null>(null);
  const remove = useRemoveTemplateFromInstance(instanceId);
  const { data: revisions = [] } = useInstanceRevisions(instanceId);

  const tabs = useMemo<TabItem[]>(() => {
    const list: TabItem[] = [];
    if (primaryTemplateId) {
      list.push({ templateId: primaryTemplateId, templateName: primaryTemplateName, isPrimary: true });
    }
    extraTemplates.forEach((t: any) => {
      list.push({
        templateId: t.template_id,
        templateName: t.template_name_snapshot ?? t.clm_templates?.name ?? "—",
        isPrimary: false,
      });
    });
    // Fallback: sections without source_template_id grouped under primary; nothing extra to add.
    return list;
  }, [primaryTemplateId, primaryTemplateName, extraTemplates]);

  const [active, setActive] = useState<string | null>(tabs[0]?.templateId ?? null);
  useEffect(() => {
    if (!active && tabs.length > 0) setActive(tabs[0].templateId);
    if (active && !tabs.find((t) => t.templateId === active)) setActive(tabs[0]?.templateId ?? null);
  }, [tabs, active]);

  const sectionsForTab = (templateId: string | null, isPrimary: boolean) => {
    if (!templateId) return sections;
    return sections.filter((s: any) => {
      // Sections explicitly tagged with this template's id
      if (s.source_template_id === templateId) return true;
      // Untagged legacy sections fall under the primary tab
      if (isPrimary && !s.source_template_id) return true;
      return false;
    });
  };

  const tabStats = (templateId: string, isPrimary: boolean) => {
    const tplSections = sectionsForTab(templateId, isPrimary);
    const ids = new Set(tplSections.map((s: any) => s.id));
    const tplRevs = (revisions as any[]).filter((r) => ids.has(r.section_id));
    const pending = tplRevs.filter((r) => r.approval_status === "pending").length;
    const approvedCount = tplRevs.filter((r) => r.approval_status === "approved").length;
    const version = approvedCount + 1; // v1 baseline + approved revisions
    return { pending, version, sectionCount: tplSections.length };
  };

  const activeTab = tabs.find((t) => t.templateId === active) ?? tabs[0];
  const activeSections = activeTab ? sectionsForTab(activeTab.templateId, activeTab.isPrimary) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap border-b pb-2">
        {tabs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-2 py-1">No templates attached.</p>
        ) : tabs.map((t) => {
          const isActive = active === t.templateId;
          const stats = tabStats(t.templateId, t.isPrimary);
          return (
            <button
              key={t.templateId}
              type="button"
              onClick={() => setActive(t.templateId)}
              className={`group flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "border-primary text-foreground font-medium bg-muted/30"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[180px] truncate">{t.templateName}</span>
              <Badge variant="outline" className="text-[10px] font-mono h-4 px-1">v{stats.version}</Badge>
              {stats.pending > 0 && (
                <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-4 px-1">
                  {stats.pending}
                </Badge>
              )}
              {t.isPrimary && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 hidden md:inline-flex">Primary</Badge>
              )}
              {!t.isPrimary && isActive && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setConfirmRemove(t); }}
                  className="opacity-60 hover:opacity-100 hover:text-destructive ml-0.5"
                  aria-label="Remove template"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add template
          </Button>
        </div>
      </div>

      {activeTab && (
        <div className="flex items-center gap-2 px-1">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{activeTab.templateName}</span>
            {" "}· {tabStats(activeTab.templateId, activeTab.isPrimary).sectionCount} sections
            {" "}· version {tabStats(activeTab.templateId, activeTab.isPrimary).version}
          </span>
          <div className="ml-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={() => setCollabOpenFor(activeTab)}>
                    <Users className="h-3.5 w-3.5 mr-1" />
                    Template-specific collaborators
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Invite reviewers scoped to just this template</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {activeTab && (
        <SectionsList
          instanceId={instanceId}
          sections={activeSections}
          comments={comments}
          contacts={contacts}
          emptyText="No sections in this template yet."
        />
      )}

      <AddTemplateToWorkspaceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        instanceId={instanceId}
        primaryTemplateId={primaryTemplateId}
        attachedTemplateIds={extraTemplates.map((t: any) => t.template_id)}
      />

      {collabOpenFor && (
        <TemplateCollaboratorsDialog
          open={!!collabOpenFor}
          onOpenChange={(o) => { if (!o) setCollabOpenFor(null); }}
          instanceId={instanceId}
          templateId={collabOpenFor.templateId}
          templateName={collabOpenFor.templateName}
          debtorId={debtorId}
          allLinkedContacts={contacts.filter((c: any) => !c.is_internal)}
        />
      )}

      {confirmRemove && (
        <Dialog open={!!confirmRemove} onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Remove "{confirmRemove.templateName}"?</DialogTitle>
              <DialogDescription>
                This removes the bundled template and deletes its sections from this workspace.
                Revisions and comments tied to those sections will also be removed. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await remove.mutateAsync(confirmRemove.templateId);
                  setConfirmRemove(null);
                }}
              >
                {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Remove template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
