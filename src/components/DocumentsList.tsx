import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  MoreVertical,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Trash2,
  Globe,
} from "lucide-react";
import { useDocuments, useUpdateDocumentStatus, useDeleteDocument, useDocumentUrl } from "@/hooks/useDocuments";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface DocumentsListProps {
  organizationId?: string;
  debtorId?: string;
  isParentAccount?: boolean;
}

const STATUS_CONFIG = {
  uploaded: { label: "Uploaded", icon: Clock, color: "bg-blue-100 text-blue-800" },
  pending_review: { label: "Pending Review", icon: AlertCircle, color: "bg-yellow-100 text-yellow-800" },
  verified: { label: "Verified", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  expired: { label: "Expired", icon: XCircle, color: "bg-red-100 text-red-800" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-800" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ACH: "ACH Form",
  WIRE: "Wire Instructions",
  W9: "W-9 Tax Form",
  EIN: "EIN Letter",
  PROOF_OF_BUSINESS: "Proof of Business",
  CONTRACT: "Contract",
  BANKING_INFO: "Banking Info",
  TAX_DOCUMENT: "Tax Document",
  w9: "W-9 Form",
  ach_authorization: "ACH Authorization",
  wire_instructions: "Wire Instructions",
  compliance: "Compliance Document",
  contract: "Contract",
  insurance: "Insurance Certificate",
  other: "Other Document",
  OTHER: "Other",
};

export default function DocumentsList({ organizationId, debtorId, isParentAccount = true }: DocumentsListProps) {
  const queryClient = useQueryClient();
  const { data: documents, isLoading } = useDocuments(organizationId, debtorId);
  const updateStatusMutation = useUpdateDocumentStatus();
  const deleteMutation = useDeleteDocument();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");

  const { data: previewUrl } = useDocumentUrl(selectedDocument?.file_url);

  // Toggle public visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ documentId, visible }: { documentId: string; visible: boolean }) => {
      const { error } = await supabase
        .from("documents")
        .update({ public_visible: visible })
        .eq("id", documentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document visibility updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update visibility: ${error.message}`);
    },
  });

  const handleStatusChange = async () => {
    if (!selectedDocument || !newStatus) return;

    await updateStatusMutation.mutateAsync({
      documentId: selectedDocument.id,
      status: newStatus,
      notes: statusNotes,
    });

    setStatusDialogOpen(false);
    setNewStatus("");
    setStatusNotes("");
  };

  const handleDelete = async (documentId: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await deleteMutation.mutateAsync(documentId);
    }
  };

  const handleDownload = (document: any) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${document.file_url}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return <div>Loading documents...</div>;
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No documents uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc: any) => {
          const StatusIcon = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.icon || Clock;
          const statusColor = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.color || "bg-gray-100 text-gray-800";

          return (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-8 h-8 text-primary mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium truncate">{doc.file_name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </Badge>
                        {doc.public_visible && (
                          <Badge variant="secondary" className="text-xs">
                            <Globe className="w-3 h-3 mr-1" />
                            Public
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                        <span>v{doc.version}</span>
                        <span>•</span>
                        <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                        {doc.file_size && (
                          <>
                            <span>•</span>
                            <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${statusColor} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]?.label || doc.status}
                        </Badge>
                        {doc.metadata?.analysis?.issues && (
                          <Badge variant="outline" className="text-xs">
                            {doc.metadata.analysis.issues.length} issues found
                          </Badge>
                        )}
                      </div>
                      {doc.notes && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {doc.notes}
                        </p>
                      )}
                      
                      {/* Public Visibility Toggle - Only for Parent Accounts and Verified Documents */}
                      {isParentAccount && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Switch
                            checked={doc.public_visible || false}
                            onCheckedChange={(checked) => 
                              toggleVisibilityMutation.mutate({ documentId: doc.id, visible: checked })
                            }
                            disabled={toggleVisibilityMutation.isPending || doc.status !== 'verified'}
                          />
                          <span className="text-sm text-muted-foreground">
                            Visible on Public AR Page
                            {doc.status !== 'verified' && (
                              <span className="text-xs text-warning ml-1">(Verify document first)</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedDocument(doc)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedDocument(doc);
                          setStatusDialogOpen(true);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Update Status
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(doc.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!selectedDocument && !statusDialogOpen} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedDocument?.file_type.startsWith("image/") ? (
              <img src={previewUrl} alt={selectedDocument.file_name} className="w-full" />
            ) : selectedDocument?.file_type === "application/pdf" ? (
              <iframe src={previewUrl} className="w-full h-[600px]" />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Preview not available for this file type</p>
                <Button onClick={() => handleDownload(selectedDocument)} className="mt-4">
                  <Download className="w-4 h-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Document Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">New Status</label>
              <select
                className="w-full p-2 border rounded-md"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="">Select status</option>
                <option value="pending_review">Pending Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                placeholder="Add notes about this status change..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStatusChange}
                disabled={!newStatus || updateStatusMutation.isPending}
              >
                Update Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}