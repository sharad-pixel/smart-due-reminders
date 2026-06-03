import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Info, Layers, Columns3 } from "lucide-react";
import {
  getCatalogEntry,
  type TemplateColumnConfig,
} from "@/lib/dataCenter/templateColumnCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateType: string;
  templateLabel: string;
  initialConfig: TemplateColumnConfig;
}

export function TemplateColumnsDialog({
  open,
  onOpenChange,
  templateId,
  templateType,
  templateLabel,
  initialConfig,
}: Props) {
  const queryClient = useQueryClient();
  const entry = useMemo(() => getCatalogEntry(templateType), [templateType]);

  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Record<string, Set<string>>>({});

  // Hydrate state when dialog opens
  useEffect(() => {
    if (!open || !entry) return;
    const objs = new Set<string>(
      initialConfig?.objects && initialConfig.objects.length > 0
        ? initialConfig.objects
        : entry.objects.map((o) => o.key),
    );
    // Required objects always included
    entry.objects.forEach((o) => { if (o.required) objs.add(o.key); });

    const cols: Record<string, Set<string>> = {};
    for (const obj of entry.objects) {
      const configCols = initialConfig?.columns?.[obj.key];
      const set = new Set<string>(
        configCols && configCols.length > 0 ? configCols : obj.columns.map((c) => c.key),
      );
      // Required columns always included
      obj.columns.forEach((c) => { if (c.required) set.add(c.key); });
      cols[obj.key] = set;
    }
    setSelectedObjects(objs);
    setSelectedColumns(cols);
  }, [open, entry, initialConfig]);

  const toggleObject = (key: string, required?: boolean) => {
    if (required) return;
    setSelectedObjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleColumn = (objectKey: string, colKey: string, required?: boolean) => {
    if (required) return;
    setSelectedColumns((prev) => {
      const cur = new Set(prev[objectKey] ?? []);
      if (cur.has(colKey)) cur.delete(colKey);
      else cur.add(colKey);
      return { ...prev, [objectKey]: cur };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!entry) return;
      const config: TemplateColumnConfig = {
        objects: Array.from(selectedObjects),
        columns: Object.fromEntries(
          Object.entries(selectedColumns).map(([k, v]) => [k, Array.from(v)]),
        ),
      };
      const { error } = await supabase
        .from("google_sheet_templates")
        .update({ column_config: config as any })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template fields saved", {
        description: "Click Push to refresh the sheet with the new layout, or delete and recreate the template.",
      });
      queryClient.invalidateQueries({ queryKey: ["sheet-templates"] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error("Save failed", { description: err.message }),
  });

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns3 className="h-4 w-4 text-primary" />
            Configure fields — {templateLabel}
          </DialogTitle>
          <DialogDescription>{entry.description}</DialogDescription>
        </DialogHeader>

        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Pick which sub-sheets and columns appear when this template is pushed to Google Sheets.
            Required identifiers stay locked so syncs continue to match rows correctly.
          </AlertDescription>
        </Alert>

        <ScrollArea className="flex-1 -mx-2 pr-2">
          <div className="space-y-5 px-2 py-2">
            {entry.objects.map((obj) => {
              const objIncluded = selectedObjects.has(obj.key) || !!obj.required;
              const cols = selectedColumns[obj.key] ?? new Set<string>();

              // Group columns visually
              const grouped: Record<string, typeof obj.columns> = {};
              for (const c of obj.columns) {
                const g = c.group ?? "Fields";
                if (!grouped[g]) grouped[g] = [];
                grouped[g].push(c);
              }

              return (
                <div key={obj.key} className={`rounded-lg border ${objIncluded ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3 p-3 border-b bg-muted/30">
                    <div className="flex items-start gap-2 min-w-0">
                      <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{obj.label}</p>
                          {obj.required && (
                            <Badge variant="outline" className="text-[10px]">Required</Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {cols.size}/{obj.columns.length} cols
                          </Badge>
                        </div>
                        {obj.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{obj.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Google Sheet tab: <span className="font-mono">{obj.sheetTitle}</span>
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      checked={objIncluded}
                      disabled={!!obj.required}
                      onCheckedChange={() => toggleObject(obj.key, obj.required)}
                    />
                  </div>

                  {objIncluded && (
                    <div className="p-3 space-y-3">
                      {Object.entries(grouped).map(([groupName, list]) => (
                        <div key={groupName}>
                          {Object.keys(grouped).length > 1 && (
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                              {groupName}
                            </p>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {list.map((c) => {
                              const checked = cols.has(c.key) || !!c.required;
                              return (
                                <label
                                  key={c.key}
                                  className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-muted/40 ${c.required ? "cursor-not-allowed" : ""}`}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={!!c.required}
                                    onCheckedChange={() => toggleColumn(obj.key, c.key, c.required)}
                                  />
                                  <span className="truncate">{c.label}</span>
                                  {c.required && (
                                    <Badge variant="outline" className="text-[9px] ml-auto shrink-0">req</Badge>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          {groupName !== Object.keys(grouped).at(-1) && <Separator className="mt-2" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
            ) : (
              "Save field selection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
