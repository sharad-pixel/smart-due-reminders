import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  FileSpreadsheet, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Loader2,
  RefreshCw,
  Archive,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, addHours, addDays, differenceInHours, differenceInDays, isPast } from "date-fns";
import { toast } from "sonner";

// Calculate expiration info for an upload
const getExpirationInfo = (upload: any) => {
  const createdAt = new Date(upload.created_at);
  const archivedAt = upload.archived_at ? new Date(upload.archived_at) : null;
  
  if (upload.status === "archived" && archivedAt) {
    // Archived uploads are permanently deleted 30 days after archiving
    const deletionDate = addDays(archivedAt, 30);
    const daysRemaining = differenceInDays(deletionDate, new Date());
    const isExpired = isPast(deletionDate);
    
    return {
      type: "deletion" as const,
      date: deletionDate,
      remaining: daysRemaining,
      isExpired,
      label: isExpired ? "Pending deletion" : `Deletes in ${daysRemaining}d`,
      urgent: daysRemaining <= 7
    };
  } else {
    // Non-archived uploads are auto-archived 24 hours after creation
    const archiveDate = addHours(createdAt, 24);
    const hoursRemaining = differenceInHours(archiveDate, new Date());
    const isExpired = isPast(archiveDate);
    
    return {
      type: "archive" as const,
      date: archiveDate,
      remaining: hoursRemaining,
      isExpired,
      label: isExpired ? "Auto-archiving soon" : `Archives in ${hoursRemaining}h`,
      urgent: hoursRemaining <= 6
    };
  }
};

interface DataCenterUploadsTabProps {
  onStartUpload: (fileType: "invoice_aging" | "payments") => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploaded: { label: "Uploaded", icon: Clock, variant: "secondary" },
  mapping: { label: "Mapping", icon: RefreshCw, variant: "secondary" },
  mapped: { label: "Mapped", icon: CheckCircle, variant: "outline" },
  processing: { label: "Processing", icon: Loader2, variant: "secondary" },
  processed: { label: "Completed", icon: CheckCircle, variant: "default" },
  error: { label: "Error", icon: AlertCircle, variant: "destructive" },
  needs_review: { label: "Needs Review", icon: Eye, variant: "outline" },
  archived: { label: "Archived", icon: Archive, variant: "secondary" },
};

export const DataCenterUploadsTab = ({ onStartUpload }: DataCenterUploadsTabProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  
  const { data: uploads, isLoading, refetch } = useQuery({
    queryKey: ["data-center-uploads", showArchived, statusFilter, fileTypeFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("data_center_uploads")
        .select(`
          *,
          source:data_center_sources(source_name, system_type)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Filter by archived status
      if (!showArchived) {
        query = query.neq("status", "archived");
      }

      // Filter by status
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Filter by file type
      if (fileTypeFilter !== "all") {
        query = query.eq("file_type", fileTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const archiveUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from("data_center_uploads")
        .update({ status: "archived" })
        .eq("id", uploadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-center-uploads"] });
      toast.success("Upload archived");
    },
    onError: () => {
      toast.error("Failed to archive upload");
    },
  });

  const restoreUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from("data_center_uploads")
        .update({ status: "needs_review" })
        .eq("id", uploadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-center-uploads"] });
      toast.success("Upload restored");
    },
    onError: () => {
      toast.error("Failed to restore upload");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Uploads</CardTitle>
            <CardDescription>
              Track and manage your data imports
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-sm text-muted-foreground">Status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="mapping">Mapping</SelectItem>
                <SelectItem value="mapped">Mapped</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="processed">Completed</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="type-filter" className="text-sm text-muted-foreground">Type:</Label>
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger id="type-filter" className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="invoice_aging">Invoices</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Switch 
              id="show-archived" 
              checked={showArchived} 
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
              Show archived
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {uploads && uploads.length > 0 ? (
          <div className="space-y-3">
            {uploads.map((upload: any) => {
              const statusConfig = STATUS_CONFIG[upload.status] || STATUS_CONFIG.uploaded;
              const StatusIcon = statusConfig.icon;
              const isProcessing = upload.status === "processing" || upload.status === "mapping";

              const expirationInfo = getExpirationInfo(upload);

              return (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${upload.file_type === "invoice_aging" ? "bg-blue-100" : "bg-green-100"}`}>
                      {upload.file_type === "invoice_aging" ? (
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      ) : (
                        <DollarSign className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{upload.file_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{upload.file_type === "invoice_aging" ? "Invoice Aging" : "Payments"}</span>
                        {upload.source && (
                          <>
                            <span>•</span>
                            <span>{upload.source.source_name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Expiration Counter */}
                    <div 
                      className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                        expirationInfo.urgent 
                          ? "bg-destructive/10 text-destructive" 
                          : "bg-muted text-muted-foreground"
                      }`}
                      title={`${expirationInfo.type === "deletion" ? "Permanent deletion" : "Auto-archive"}: ${expirationInfo.date.toLocaleDateString()}`}
                    >
                      <Clock className="h-3 w-3" />
                      {expirationInfo.label}
                    </div>
                    {upload.row_count > 0 && (
                      <div className="text-sm text-muted-foreground text-right">
                        <p>{upload.processed_count}/{upload.row_count} rows</p>
                        <p className="text-xs">{upload.matched_count} matched</p>
                      </div>
                    )}
                    <Badge variant={statusConfig.variant} className="gap-1">
                      <StatusIcon className={`h-3 w-3 ${isProcessing ? "animate-spin" : ""}`} />
                      {statusConfig.label}
                    </Badge>
                    {upload.status === "needs_review" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/data-center/review/${upload.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    )}
                    {upload.status === "error" && (
                      <Button size="sm" variant="outline" className="text-destructive">
                        View Error
                      </Button>
                    )}
                    {upload.status === "archived" ? (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => restoreUpload.mutate(upload.id)}
                        disabled={restoreUpload.isPending}
                        title="Restore upload"
                      >
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => archiveUpload.mutate(upload.id)}
                        disabled={archiveUpload.isPending}
                        title="Archive upload"
                      >
                        <Archive className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No uploads yet</p>
            <p className="text-sm mb-4">Start by uploading your AR aging data or payments</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => onStartUpload("invoice_aging")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Upload Invoices
              </Button>
              <Button variant="outline" onClick={() => onStartUpload("payments")}>
                <DollarSign className="h-4 w-4 mr-2" />
                Upload Payments
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
