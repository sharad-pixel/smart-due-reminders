import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Plus, 
  Settings,
  Loader2,
  Users,
  DollarSign,
  Link2,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataCenterSourcesTab } from "@/components/data-center/DataCenterSourcesTab";
import { DataCenterUploadsTab } from "@/components/data-center/DataCenterUploadsTab";
import { DataCenterUploadWizard } from "@/components/data-center/DataCenterUploadWizard";
import { CreateSourceModal } from "@/components/data-center/CreateSourceModal";
import { DataRetentionBanner } from "@/components/data-center/DataRetentionBanner";
import { QuickBooksSyncSection } from "@/components/data-center/QuickBooksSyncSection";
import { StripeSyncSection } from "@/components/data-center/StripeSyncSection";
import { SyncHealthDashboard } from "@/components/data-center/SyncHealthDashboard";
import { SyncActivityLog } from "@/components/data-center/SyncActivityLog";
import * as XLSX from "xlsx";

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

  const handleExportAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { data: accounts, error } = await supabase
        .from("debtors")
        .select("reference_id, company_name, name, email, phone, type, external_customer_id, crm_account_id_external, industry, address_line1, address_line2, city, state, postal_code, country")
        .eq("user_id", user.id)
        .order("company_name");

      if (error) throw error;

      if (!accounts || accounts.length === 0) {
        toast.info("No accounts to export", {
          description: "Create some accounts first before exporting."
        });
        return;
      }

      const exportData = accounts.map(acc => ({
        "Recouply Account ID (RAID)": acc.reference_id,
        "Company Name": acc.company_name,
        "Contact Name": acc.name,
        "Contact Email": acc.email,
        "Contact Phone": acc.phone || "",
        "Account Type": acc.type || "",
        "External Customer ID": acc.external_customer_id || "",
        "CRM Account ID": acc.crm_account_id_external || "",
        "Industry": acc.industry || "",
        "Address Line 1": acc.address_line1 || "",
        "Address Line 2": acc.address_line2 || "",
        "City": acc.city || "",
        "State": acc.state || "",
        "Postal Code": acc.postal_code || "",
        "Country": acc.country || ""
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Accounts");
      XLSX.writeFile(wb, `recouply_accounts_export_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Accounts exported", {
        description: `Exported ${accounts.length} accounts with Recouply Account IDs for invoice mapping.`
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error.message || "Could not export accounts"
      });
    }
  };

  const handleExportInvoices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      // Paginate to get all invoices
      const PAGE_SIZE = 1000;
      let allInvoices: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await supabase
          .from("invoices")
          .select("reference_id, external_invoice_id, invoice_number, amount, currency, issue_date, due_date, status, source_system, product_description, payment_terms, notes, debtors(name, email, reference_id)")
          .eq("user_id", user.id)
          .eq("is_archived", false)
          .order("due_date", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) {
          hasMore = false;
        } else {
          allInvoices = [...allInvoices, ...page];
          offset += PAGE_SIZE;
          if (page.length < PAGE_SIZE) hasMore = false;
        }
      }

      if (allInvoices.length === 0) {
        toast.info("No invoices to export", {
          description: "Create some invoices first before exporting."
        });
        return;
      }

      const exportData = allInvoices.map(inv => {
        const daysPastDue = Math.max(
          0,
          Math.ceil((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
        );
        let aging_bucket = "Current";
        if (daysPastDue > 0 && daysPastDue <= 30) aging_bucket = "0-30";
        else if (daysPastDue <= 60) aging_bucket = "31-60";
        else if (daysPastDue <= 90) aging_bucket = "61-90";
        else if (daysPastDue <= 120) aging_bucket = "91-120";
        else if (daysPastDue > 120) aging_bucket = "121+";

        return {
          "Recouply Invoice ID": inv.reference_id || "",
          "External Invoice ID": inv.external_invoice_id || "",
          "Invoice Number": inv.invoice_number || "",
          "Account Name": inv.debtors?.name || "",
          "Account Email": inv.debtors?.email || "",
          "Account RAID": inv.debtors?.reference_id || "",
          "Amount": inv.amount,
          "Currency": inv.currency || "USD",
          "Issue Date": inv.issue_date || "",
          "Due Date": inv.due_date || "",
          "Status": inv.status || "",
          "Aging Bucket": aging_bucket,
          "Source System": inv.source_system || "manual",
          "Product Description": inv.product_description || "",
          "Payment Terms": inv.payment_terms || "",
          "Notes": inv.notes || "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoices");
      XLSX.writeFile(wb, `recouply_invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Invoices exported", {
        description: `Exported ${allInvoices.length} invoices.`
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: error.message || "Could not export invoices"
      });
    }
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
              Manage all your data sources and integrations in one place
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

        {/* Sync Health Dashboard */}
        <SyncHealthDashboard />

        {/* Connected Integrations - Enterprise Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Connected Integrations
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <StripeSyncSection />
            <QuickBooksSyncSection />
          </div>
        </div>

        {/* Export Callouts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Export Accounts with RAIDs</p>
                  <p className="text-xs text-muted-foreground">
                    Download accounts list with Recouply Account IDs
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleExportAccounts}>
                <Download className="h-4 w-4" />
                Export Accounts
              </Button>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Export All Invoices</p>
                  <p className="text-xs text-muted-foreground">
                    Download all invoices with account details and aging data
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleExportInvoices}>
                <Download className="h-4 w-4" />
                Export Invoices
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Data Import Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Data Import
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {/* CSV/Excel Upload Card */}
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">CSV/Excel Upload</CardTitle>
                    <CardDescription className="text-xs">
                      Import invoices & customers from files
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => handleStartUpload("accounts")}
                  >
                    <Users className="h-3 w-3" />
                    Accounts
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => handleStartUpload("invoice_aging")}
                  >
                    <FileText className="h-3 w-3" />
                    Invoices
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => handleStartUpload("payments")}
                  >
                    <DollarSign className="h-3 w-3" />
                    Payments
                  </Button>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={handleExportAccounts}
                >
                  <Download className="h-3 w-3" />
                  Export Accounts with RAIDs
                </Button>
              </CardContent>
            </Card>

            {/* API Connection Card - Coming Soon */}
            <Card className="border-dashed opacity-75">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      API Connection
                      <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Connect custom systems via REST API
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Build custom integrations with our API to sync data from any system.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Stats */}
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
              <Button size="sm" variant="outline" onClick={() => handleStartUpload("invoice_aging")}>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
              <Button size="sm" variant="secondary" onClick={handleExportAccounts}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sync Activity Log */}
        <SyncActivityLog />

        {/* Tabs for Uploads and Sources */}
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
