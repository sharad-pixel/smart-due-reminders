import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileSpreadsheet, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

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
};

export const DataCenterUploadsTab = ({ onStartUpload }: DataCenterUploadsTabProps) => {
  const { data: uploads, isLoading, refetch } = useQuery({
    queryKey: ["data-center-uploads"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_center_uploads")
        .select(`
          *,
          source:data_center_sources(source_name, system_type)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Recent Uploads</CardTitle>
          <CardDescription>
            Track and manage your data imports
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {uploads && uploads.length > 0 ? (
          <div className="space-y-3">
            {uploads.map((upload: any) => {
              const statusConfig = STATUS_CONFIG[upload.status] || STATUS_CONFIG.uploaded;
              const StatusIcon = statusConfig.icon;
              const isProcessing = upload.status === "processing" || upload.status === "mapping";

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
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    )}
                    {upload.status === "error" && (
                      <Button size="sm" variant="outline" className="text-destructive">
                        View Error
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
