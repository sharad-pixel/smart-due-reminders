import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Database, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Plus, 
  Settings,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Loader2,
  Info,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataCenterSourcesTab } from "@/components/data-center/DataCenterSourcesTab";
import { DataCenterUploadsTab } from "@/components/data-center/DataCenterUploadsTab";
import { DataCenterUploadWizard } from "@/components/data-center/DataCenterUploadWizard";
import { CreateSourceModal } from "@/components/data-center/CreateSourceModal";
import { DataRetentionBanner } from "@/components/data-center/DataRetentionBanner";

const DataCenter = () => {
  const [uploadWizardOpen, setUploadWizardOpen] = useState(false);
  const [createSourceOpen, setCreateSourceOpen] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<"invoice_aging" | "payments">("invoice_aging");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["data-center-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [sourcesRes, uploadsRes, pendingRes] = await Promise.all([
        supabase.from("data_center_sources").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("data_center_uploads").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("data_center_uploads").select("id", { count: "exact" }).eq("user_id", user.id).eq("status", "needs_review"),
      ]);

      return {
        sources: sourcesRes.count || 0,
        uploads: uploadsRes.count || 0,
        pending: pendingRes.count || 0,
      };
    },
  });

  const handleStartUpload = (fileType: "invoice_aging" | "payments") => {
    // Force user to create a source first if none exist
    if (!stats?.sources || stats.sources === 0) {
      toast.info("Create a data source first", {
        description: "You need to set up a data source before uploading files."
      });
      setCreateSourceOpen(true);
      return;
    }
    setSelectedFileType(fileType);
    setUploadWizardOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Data Retention Banner */}
        <DataRetentionBanner />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Data Center
            </h1>
            <p className="text-muted-foreground">
              Import, map, and manage your AR data with AI-powered field detection
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreateSourceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Source
            </Button>
            <Button onClick={() => handleStartUpload("invoice_aging")}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Data Sources</CardDescription>
              <CardTitle className="text-2xl">
                {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.sources || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Configured mapping profiles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Uploads</CardDescription>
              <CardTitle className="text-2xl">
                {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.uploads || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Files processed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Needs Review</CardDescription>
              <CardTitle className="text-2xl text-amber-600">
                {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.pending || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Pending matches</p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardDescription>Quick Actions</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleStartUpload("invoice_aging")}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Invoices
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStartUpload("payments")}>
                <Download className="h-4 w-4 mr-1" />
                Payments
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Payment Matching Guide */}
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Payment Matching Requirements</AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p>
              To successfully match payments to invoices, your payment files <strong>must include the Recouply Invoice ID</strong> (starts with <code className="px-1 py-0.5 bg-muted rounded text-xs">INV-</code>).
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              <div className="p-3 bg-background rounded-lg border">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Primary Match (Recommended)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Use <strong>Recouply Invoice ID</strong> field. This is the unique identifier assigned to each invoice in Recouply.ai. 
                  Export your invoices from the Invoices page to get this ID.
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Fallback Match
                </h4>
                <p className="text-xs text-muted-foreground">
                  If Recouply Invoice ID is not available, the system will attempt to match using your <strong>Invoice Number</strong>. 
                  This may result in lower match confidence.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Tip: Export your invoices first, then use the Recouply Invoice ID column when preparing payment data.
              </span>
            </div>
          </AlertDescription>
        </Alert>

        {/* Main Tabs */}
        <Tabs defaultValue="uploads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="uploads" className="gap-2">
              <Upload className="h-4 w-4" />
              Recent Uploads
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Settings className="h-4 w-4" />
              Sources & Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="uploads">
            <DataCenterUploadsTab onStartUpload={handleStartUpload} />
          </TabsContent>

          <TabsContent value="sources">
            <DataCenterSourcesTab onCreateSource={() => setCreateSourceOpen(true)} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <DataCenterUploadWizard
        open={uploadWizardOpen}
        onClose={() => setUploadWizardOpen(false)}
        fileType={selectedFileType}
      />

      <CreateSourceModal
        open={createSourceOpen}
        onClose={() => setCreateSourceOpen(false)}
      />
    </Layout>
  );
};

export default DataCenter;
