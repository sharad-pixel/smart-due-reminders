import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ImportJob {
  id: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  mode: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export function ImportJobHistory() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("invoice_import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load import history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const downloadErrorReport = async (jobId: string) => {
    try {
      const { data: errors, error } = await supabase
        .from("invoice_import_errors")
        .select("*")
        .eq("import_job_id", jobId);

      if (error) throw error;

      if (!errors || errors.length === 0) {
        toast.info("No errors to download");
        return;
      }

      // Generate CSV
      const headers = ["Row Number", "Error Message", "Raw Data"];
      const rows = errors.map(e => [
        e.row_number,
        `"${e.error_message}"`,
        `"${JSON.stringify(e.raw_row_json)}"`,
      ]);

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `import-errors-${jobId}.csv`;
      a.click();

      toast.success("Error report downloaded");
    } catch (error: any) {
      console.error("Error downloading report:", error);
      toast.error("Failed to download error report");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      COMPLETED: "default",
      PROCESSING: "secondary",
      FAILED: "destructive",
      PENDING: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading import history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Recent Import Jobs</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchJobs}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No import history yet
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{job.file_name}</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {job.success_count} success, {job.error_count} errors • {job.mode} •{" "}
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </div>
                </div>
                {job.error_count > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadErrorReport(job.id)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Errors
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
