import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Mail, 
  Loader2, 
  MoreVertical, 
  Eye, 
  Send, 
  Copy, 
  Trash2,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

interface EmailBroadcast {
  id: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  status: string;
  total_recipients: number | null;
  sent_count: number | null;
  failed_count: number | null;
  sent_at: string | null;
  created_at: string;
  audience?: string | null;
}

interface BroadcastActionsCardProps {
  broadcasts: EmailBroadcast[];
  isLoading: boolean;
  onDelete: (ids: string[]) => void;
  onResend: (broadcast: EmailBroadcast) => void;
  onDuplicate: (broadcast: EmailBroadcast) => void;
  isDeleting?: boolean;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  completed: { variant: "default", label: "Sent" },
  sending: { variant: "secondary", label: "Sending" },
  failed: { variant: "destructive", label: "Failed" },
  draft: { variant: "outline", label: "Draft" },
  scheduled: { variant: "secondary", label: "Scheduled" },
};

export const BroadcastActionsCard = ({
  broadcasts,
  isLoading,
  onDelete,
  onResend,
  onDuplicate,
  isDeleting,
}: BroadcastActionsCardProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewBroadcast, setPreviewBroadcast] = useState<EmailBroadcast | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.length === broadcasts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(broadcasts.map(b => b.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    onDelete(selectedIds);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
  };

  const draftBroadcasts = broadcasts.filter(b => b.status === "draft");
  const sentBroadcasts = broadcasts.filter(b => b.status !== "draft");

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Broadcast Management</CardTitle>
              <CardDescription>
                Manage drafts, view sent campaigns, and track performance
              </CardDescription>
            </div>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No broadcasts yet. Create your first email campaign!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Drafts Section */}
              {draftBroadcasts.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Badge variant="outline">Drafts ({draftBroadcasts.length})</Badge>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIds.length === broadcasts.length && broadcasts.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftBroadcasts.map((broadcast) => (
                        <TableRow key={broadcast.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(broadcast.id)}
                              onCheckedChange={() => toggleSelect(broadcast.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {broadcast.subject || "(No subject)"}
                          </TableCell>
                          <TableCell>{broadcast.total_recipients || 0}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(broadcast.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setPreviewBroadcast(broadcast)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onResend(broadcast)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Send Now
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(broadcast)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedIds([broadcast.id]);
                                    setShowDeleteConfirm(true);
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Sent Section */}
              {sentBroadcasts.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Badge>Sent ({sentBroadcasts.length})</Badge>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIds.length === broadcasts.length && broadcasts.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentBroadcasts.map((broadcast) => {
                        const config = statusConfig[broadcast.status] || statusConfig.draft;
                        return (
                          <TableRow key={broadcast.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(broadcast.id)}
                                onCheckedChange={() => toggleSelect(broadcast.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium max-w-[250px] truncate">
                              {broadcast.subject}
                            </TableCell>
                            <TableCell>
                              <Badge variant={config.variant}>{config.label}</Badge>
                            </TableCell>
                            <TableCell className="text-green-600 font-medium">
                              {broadcast.sent_count || 0}
                            </TableCell>
                            <TableCell className="text-red-600">
                              {broadcast.failed_count || 0}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {broadcast.sent_at
                                ? format(new Date(broadcast.sent_at), "MMM d, h:mm a")
                                : format(new Date(broadcast.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setPreviewBroadcast(broadcast)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Content
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDuplicate(broadcast)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onResend(broadcast)}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Resend
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedIds([broadcast.id]);
                                      setShowDeleteConfirm(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broadcast{selectedIds.length > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.length} broadcast{selectedIds.length > 1 ? "s" : ""}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewBroadcast} onOpenChange={() => setPreviewBroadcast(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewBroadcast && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Subject:</p>
                <p className="font-medium">{previewBroadcast.subject}</p>
              </div>
              <div
                className="p-4 border rounded-lg bg-white prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewBroadcast.body_html }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
