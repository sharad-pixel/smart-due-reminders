import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FileText, Check } from "lucide-react";
import { useClmTemplates } from "@/hooks/useClmTemplates";
import { useAddTemplateToInstance } from "@/hooks/useClmInstance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  primaryTemplateId: string | null;
  attachedTemplateIds: string[];
}

export const AddTemplateToWorkspaceDialog = ({
  open, onOpenChange, instanceId, primaryTemplateId, attachedTemplateIds,
}: Props) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data: templates = [] } = useClmTemplates();
  const add = useAddTemplateToInstance(instanceId);

  const taken = useMemo(
    () => new Set([primaryTemplateId, ...attachedTemplateIds].filter(Boolean) as string[]),
    [primaryTemplateId, attachedTemplateIds]
  );

  const filtered = templates.filter((t) => {
    if (t.status !== "ready") return false;
    if (taken.has(t.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
  });

  const handleAdd = async () => {
    if (!selected) return;
    await add.mutateAsync(selected);
    setSelected(null);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add template to workspace</DialogTitle>
          <DialogDescription>
            Bundle an additional template into this workspace. Its sections will be copied in for negotiation.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded border divide-y">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {templates.length === 0 ? "No templates available" : "No templates match — all ready templates may already be attached"}
            </p>
          ) : filtered.map((t) => {
            const isSel = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className={`w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between gap-2 ${isSel ? "bg-muted" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                  {isSel && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
