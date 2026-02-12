import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  FileText,
  Shield,
  Clock,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DataCenterSourcesTab } from "@/components/data-center/DataCenterSourcesTab";
import { DataCenterUploadsTab } from "@/components/data-center/DataCenterUploadsTab";
import { DataCenterUploadWizard } from "@/components/data-center/DataCenterUploadWizard";
import { CreateSourceModal } from "@/components/data-center/CreateSourceModal";
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
      if (!user) { toast.error("Not authenticated"); return; }

      const { data: accounts, error } = await supabase
        .from("debtors")
        .select("reference_id, company_name, name, email, phone, type, external_customer_id, crm_account_id_external, industry, address_line1, address_line2, city, state, postal_code, country")
        .eq("user_id", user.id)
        .order("company_name");

      if (error) throw error;
      if (!accounts || accounts.length === 0) {
        toast.info("No accounts to export", { description: "Create some accounts first before exporting." });
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
      toast.success("Accounts exported", { description: `Exported ${accounts.length} accounts with Recouply Account IDs.` });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Export failed", { description: error.message || "Could not export accounts" });
    }
  };

  const handleExportInvoices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); return; }

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
        if (!page || page.length === 0) { hasMore = false; } 
        else {
          allInvoices = [...allInvoices, ...page];
          offset += PAGE_SIZE;
          if (page.length < PAGE_SIZE) hasMore = false;
        }
      }

      if (allInvoices.length === 0) {
        toast.info("No invoices to export", { description: "Create some invoices first before exporting." });
        return;
      }

      const exportData = allInvoices.map(inv => {
        const daysPastDue = Math.max(0, Math.ceil((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)));
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
      toast.success("Invoices exported", { description: `Exported ${allInvoices.length} invoices.` });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Export failed", { description: error.message || "Could not export invoices" });
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Data Center
            </h1>
            <p className="text-muted-foreground">
              Your central hub for integrations, data imports, exports, and retention management
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

        {/* Quick Stats Bar */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">Data Sources</CardDescription>
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
              <CardDescription className="text-xs uppercase tracking-wide">Total Uploads</CardDescription>
              <CardTitle className="text-2xl">
                {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.uploads || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Files processed to date</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wide">Needs Review</CardDescription>
              <CardTitle className="text-2xl text-amber-600">
                {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.pending || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Pending reconciliation matches</p>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: CONNECTED INTEGRATIONS (Stripe & QuickBooks)       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Connected Integrations</h2>
              <p className="text-xs text-muted-foreground">
                Sync customers, invoices, and payments automatically from your billing systems
              </p>
            </div>
          </div>

          <SyncHealthDashboard />

          <div className="grid gap-4 md:grid-cols-2">
            <StripeSyncSection />
            <QuickBooksSyncSection />
          </div>

          <SyncActivityLog />
        </section>

        <Separator />

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: FILE UPLOADS (CSV / Excel)                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">File Uploads</h2>
              <p className="text-xs text-muted-foreground">
                Import data from CSV or Excel files — max 5,000 rows per upload
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="group hover:border-primary/40 transition-colors cursor-pointer" onClick={() => handleStartUpload("accounts")}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Accounts</CardTitle>
                    <CardDescription className="text-xs">Customer / debtor records</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Import company names, contacts, addresses, and external IDs. Each account gets a unique Recouply Account ID (RAID).
                </p>
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  Upload accounts <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:border-primary/40 transition-colors cursor-pointer" onClick={() => handleStartUpload("invoice_aging")}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Invoices</CardTitle>
                    <CardDescription className="text-xs">AR aging & invoice data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Import invoice numbers, amounts, dates, and statuses. Duplicates are auto-detected by external invoice ID.
                </p>
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  Upload invoices <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:border-primary/40 transition-colors cursor-pointer" onClick={() => handleStartUpload("payments")}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Payments</CardTitle>
                    <CardDescription className="text-xs">Payment & remittance data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Import payment records. Auto-matched against open invoices by customer name and amount after upload.
                </p>
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  Upload payments <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload History & Source Templates */}
          <Tabs defaultValue="uploads" className="space-y-4">
            <TabsList>
              <TabsTrigger value="uploads" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload History
              </TabsTrigger>
              <TabsTrigger value="sources" className="gap-2">
                <Settings className="h-4 w-4" />
                Source Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="uploads">
              <DataCenterUploadsTab onStartUpload={handleStartUpload} />
            </TabsContent>

            <TabsContent value="sources">
              <DataCenterSourcesTab onCreateSource={() => setCreateSourceOpen(true)} />
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: EXPORTS & DATASETS                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Exports & Datasets</h2>
              <p className="text-xs text-muted-foreground">
                Download your data as XLSX files for reporting, auditing, or backup
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/20">
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Accounts Export</p>
                    <p className="text-xs text-muted-foreground">
                      All customers with RAIDs, contacts, and addresses
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 w-full" onClick={handleExportAccounts}>
                  <Download className="h-4 w-4" />
                  Download Accounts (.xlsx)
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Invoices Export</p>
                    <p className="text-xs text-muted-foreground">
                      All invoices with aging buckets, statuses, and account data
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 w-full" onClick={handleExportInvoices}>
                  <Download className="h-4 w-4" />
                  Download Invoices (.xlsx)
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Payment Reconciliation</p>
                    <p className="text-xs text-muted-foreground">
                      View matched payments, edit details, and reconcile records
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
                  <a href="/payments">
                    <DollarSign className="h-4 w-4" />
                    Go to Payments
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: DATA RETENTION POLICY                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Data Retention Policy</h2>
              <p className="text-xs text-muted-foreground">
                How your uploaded data is stored, archived, and automatically deleted
              </p>
            </div>
          </div>

          <Card className="border-muted">
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Upload & Process</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Files are parsed and imported immediately. Raw upload data is available for review for <span className="font-semibold text-foreground">24 hours</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Auto-Archive</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      After 24 hours, uploads are archived. You'll receive a <span className="font-semibold text-foreground">7-day warning</span> before permanent deletion.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Permanent Deletion</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Archived uploads and failed import job logs are permanently deleted after <span className="font-semibold text-foreground">14 days</span>. Download your data and audit trails beforehand.
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Your processed data is safe.</span> Imported accounts, invoices, and payments remain in your database permanently — only raw upload staging files and import job error logs are subject to the 14-day retention window. Integration sync data (Stripe, QuickBooks) is retained indefinitely. Account deletion removes all data per our GDPR compliance policy.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
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
