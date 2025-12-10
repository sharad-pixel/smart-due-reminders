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
  Users,
  DollarSign,
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
  const [selectedFileType, setSelectedFileType] = useState<"invoice_aging" | "payments" | "accounts">("invoice_aging");

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

  const handleStartUpload = (fileType: "invoice_aging" | "payments" | "accounts") => {
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
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleStartUpload("accounts")}>
                <Users className="h-4 w-4 mr-1" />
                Accounts
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStartUpload("invoice_aging")}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Invoices
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStartUpload("payments")}>
                <DollarSign className="h-4 w-4 mr-1" />
                Payments
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* How to Prepare Data Guide */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            How to Prepare Your Data
          </h3>
          
          <div className="grid gap-4 md:grid-cols-3">
            {/* Accounts Guide */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Accounts
                </CardTitle>
                <CardDescription className="text-xs">Import your customer/company records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="font-medium text-foreground mb-1">Required Fields:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li><strong>Customer Name</strong> - Company or customer name</li>
                    <li><strong>Customer Email</strong> - Primary contact email</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Recommended Fields:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li>Contact Name, Customer Phone</li>
                    <li>External Customer ID, CRM Account ID</li>
                    <li>Industry, Account Type</li>
                    <li>Billing Address</li>
                  </ul>
                </div>
                <div className="pt-2 border-t flex items-start gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">
                    Recouply Account ID (RAID) is auto-generated. Import accounts first for best matching.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Invoices Guide */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                  Invoices
                </CardTitle>
                <CardDescription className="text-xs">Import your AR aging or invoice data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="font-medium text-foreground mb-1">Required Fields:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li><strong>Recouply Account ID</strong> - Links to existing account (RAID)</li>
                    <li><strong>Invoice Number</strong> - Your invoice identifier</li>
                    <li><strong>Original Amount</strong> - Invoice total amount</li>
                    <li><strong>Invoice Date</strong> - Date invoice was issued</li>
                    <li><strong>Due Date</strong> - Payment due date</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Recommended Fields:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li>Outstanding Amount, Currency</li>
                    <li>Invoice Status, External Invoice ID</li>
                    <li>Product/Service Description</li>
                  </ul>
                </div>
                <div className="pt-2 border-t flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">
                    Export accounts first to get Recouply Account IDs for linking invoices.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payments Guide */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Payments
                </CardTitle>
                <CardDescription className="text-xs">Import payments to reconcile invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="font-medium text-foreground mb-1">Required Fields:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li><strong>Recouply Invoice ID</strong> - Primary match key (RINV)</li>
                    <li><strong>Invoice Number</strong> - Fallback match key</li>
                    <li><strong>Payment Amount</strong> - Amount paid</li>
                    <li><strong>Payment Date</strong> - Date payment received</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Recommended Fields:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li>Payment Method (check, wire, ACH)</li>
                    <li>Payment Reference / Check Number</li>
                    <li>Payment Notes</li>
                  </ul>
                </div>
                <div className="pt-2 border-t flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">
                    Export invoices first to get Recouply Invoice IDs for accurate payment matching.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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
