import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BookmarkPlus, Library, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  updated_at: string;
}

interface Props {
  onPick: (prompt: string) => void;
  currentDraft?: string;
}

export function NicolasPromptLibrary({ onPick, currentDraft }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("nicolas_prompt_templates")
      .select("id,title,prompt,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Couldn't load prompt library");
    else setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const openNew = (seed?: string) => {
    setEditing(null);
    setTitle("");
    setPrompt(seed || "");
    setShowEditor(true);
  };
  const openEdit = (t: PromptTemplate) => {
    setEditing(t);
    setTitle(t.title);
    setPrompt(t.prompt);
    setShowEditor(true);
  };

  const save = async () => {
    const t = title.trim();
    const p = prompt.trim();
    if (!t || !p) {
      toast.error("Give your prompt a title and body");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (editing) {
        const { error } = await supabase
          .from("nicolas_prompt_templates")
          .update({ title: t, prompt: p })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Prompt updated");
      } else {
        const { error } = await supabase
          .from("nicolas_prompt_templates")
          .insert({ title: t, prompt: p, user_id: user.id });
        if (error) throw error;
        toast.success("Prompt saved");
      }
      setShowEditor(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save prompt");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this prompt?")) return;
    const { error } = await supabase.from("nicolas_prompt_templates").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete prompt");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast.success("Prompt deleted");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
            title="Prompt library"
          >
            <Library className="h-3.5 w-3.5 mr-1" />
            Prompts
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[360px] p-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Library className="h-3.5 w-3.5 text-primary" /> Prompt library
            </div>
            <div className="flex items-center gap-1">
              {currentDraft && currentDraft.trim() && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => openNew(currentDraft)}
                  title="Save current draft as template"
                >
                  <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                  Save draft
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openNew()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No saved prompts yet.
                <div className="mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNew()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create your first
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((t) => (
                  <li key={t.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-muted/50">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(t.prompt);
                        setOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.prompt}</div>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit prompt" : "Save new prompt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly collections review"
                maxLength={120}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Write the prompt Nicolas should run when you pick this template…"
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Save changes" : "Save prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
