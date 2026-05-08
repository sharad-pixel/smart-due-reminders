import { useState } from "react";
import { MoreVertical, Archive, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useArchiveInstance,
  useDeleteInstance,
  useReopenInstance,
} from "@/hooks/useClmInstance";

interface Props {
  instanceId: string;
  status: string;
  name: string;
}

export const WorkspaceActionsMenu = ({ instanceId, status, name }: Props) => {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archive = useArchiveInstance();
  const reopen = useReopenInstance();
  const del = useDeleteInstance();

  const isClosed = ["executed", "archived"].includes(status);
  const busy = archive.isPending || del.isPending || reopen.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => e.stopPropagation()}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {!isClosed ? (
            <DropdownMenuItem onClick={() => setConfirmArchive(true)}>
              <Archive className="h-4 w-4 mr-2" /> Close & archive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => reopen.mutate(instanceId)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reopen workspace
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close & archive "{name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The workspace and its attached documents will be archived. You can reopen it later
              from the Closed engagements section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archive.mutate(instanceId)}>
              Close & archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the workspace, its collaborators, attached documents, and
              all section revisions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate(instanceId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
