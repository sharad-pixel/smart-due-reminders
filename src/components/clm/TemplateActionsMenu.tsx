import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { useUpdateClmTemplate, useDeleteClmTemplate, type ClmTemplate } from "@/hooks/useClmTemplates";
import { useNavigate } from "react-router-dom";

interface Props {
  template: ClmTemplate;
  /** When true, redirect to /contracts after deletion (for use on the detail page) */
  redirectOnDelete?: boolean;
  /** Render as inline buttons instead of a dropdown */
  inline?: boolean;
}

export const TemplateActionsMenu = ({ template, redirectOnDelete, inline }: Props) => {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const update = useUpdateClmTemplate();
  const del = useDeleteClmTemplate();
  const nav = useNavigate();

  const handleSave = async () => {
    if (!name.trim()) return;
    await update.mutateAsync({ id: template.id, name: name.trim(), description: description.trim() || null });
    setEditOpen(false);
  };

  const handleDelete = async () => {
    await del.mutateAsync({ id: template.id, storagePath: template.source_storage_path });
    setDeleteOpen(false);
    if (redirectOnDelete) nav("/contracts");
  };

  // stop propagation so clicks don't trigger parent <Link>
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div onClick={stop}>
      {inline ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />Delete
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stop}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={stop}>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />Edit name
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={stop}>
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>Active collaborations keep their own snapshot — edits only affect future workspaces.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || update.isPending}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              The source file and AI sections will be removed. Existing collaboration workspaces created from this template will keep working — they each hold their own copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
