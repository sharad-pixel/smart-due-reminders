import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Scan,
  Eye,
  Clock,
  Zap,
  BarChart3,
  Shield,
  Trash2,
} from "lucide-react";
import { Building2 } from "lucide-react";
import { GoogleDriveIcon, GoogleSheetsIcon } from "@/components/icons/GoogleIcons";
import { IngestionReviewQueue } from "./IngestionReviewQueue";
import { IngestionDashboard } from "./IngestionDashboard";
import { SheetTemplatesSection } from "./SheetTemplatesSection";
import { PendingSheetImports } from "../PendingSheetImports";
import { SheetBestPractices } from "./SheetBestPractices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { openFolderPicker } from "@/lib/googlePicker";

export function SmartIngestionSection() {
  const queryClient = useQueryClient();
  const [pickerOpening, setPickerOpening] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Count pending sheet imports for the tab badge
  const { data: pendingAccountCount = 0 } = useQuery({
    queryKey: ["pending-sheet-imports-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return 0;
      const { count } = await supabase
        .from("pending_sheet_imports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
  });

  // Check if user signed in with Google OAuth
  const { data: authProvider } = useQuery({
    queryKey: ["auth-provider"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;
      return user.app_metadata?.provider || user.app_metadata?.providers?.[0] || null;
    },
  });

  // Check for drive connection
  const { data: connection, isLoading: connectionLoading } = useQuery({
    queryKey: ["drive-connection"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;
      const { data } = await supabase
        .from("drive_connections")
        .select("*")
        .eq("user_id", accountId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  // Get scanned files stats
  const { data: scanStats } = useQuery({
    queryKey: ["ingestion-scan-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;
      const [pending, processed, errors, reviewPending] = await Promise.all([
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId).eq("processing_status", "pending"),
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId).eq("processing_status", "processed"),
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId).eq("processing_status", "error"),
        supabase.from("ingestion_review_queue").select("id", { count: "exact" }).eq("user_id", accountId).eq("review_status", "pending"),
      ]);
      return {
        pending: pending.count || 0,
        processed: processed.count || 0,
        errors: errors.count || 0,
        reviewPending: reviewPending.count || 0,
      };
    },
    enabled: !!connection,
  });

  // Get pending files for extraction
  const { data: _pendingFiles } = useQuery({
    queryKey: ["ingestion-pending-files"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return [];
      const { data } = await supabase
        .from("ingestion_scanned_files")
        .select("*")
        .eq("user_id", accountId)
        .eq("processing_status", "pending")
        .order("created_at", { ascending: true })
        .limit(50);
      return data || [];
    },
    enabled: !!connection,
  });

  // Connect to Google Drive
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (err: any) => toast.error("Connection failed", { description: err.message }),
  });

  // Disconnect / Disable Google Drive
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("drive_connections")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google Drive disconnected", { description: "Your connection has been disabled. You can reconnect anytime." });
      queryClient.invalidateQueries({ queryKey: ["drive-connection"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
      setDisconnectOpen(false);
    },
    onError: (err: any) => toast.error("Failed to disconnect", { description: err.message }),
  });

  // Scan folder
  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-drive-scan", {
        body: { action: "scan" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Folder scanned", {
        description: `Found ${data.new_files} new files (${data.already_tracked} already tracked)`,
      });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-pending-files"] });
    },
    onError: (err: any) => toast.error("Scan failed", { description: err.message }),
  });

  // Set folder (called after Google Picker returns a selection)
  const setFolderMutation = useMutation({
    mutationFn: async ({ folderId, folderName }: { folderId: string; folderName: string }) => {
      const { data, error } = await supabase.functions.invoke("google-drive-scan", {
        body: { action: "set_folder", folderId, folderName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Folder selected");
      queryClient.invalidateQueries({ queryKey: ["drive-connection"] });
    },
    onError: (err: any) => toast.error("Failed to set folder", { description: err.message }),
  });

  // Open the Google Picker so the user can grant per-folder access (drive.file scope)
  const handleOpenPicker = useCallback(async () => {
    setPickerOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-scan", {
        body: { action: "get_picker_token" },
      });
      if (error) throw error;
      if (!data?.access_token) throw new Error("Could not get a Google access token");
      if (!data?.api_key) {
        throw new Error(
          "Google Picker is not configured. Please contact support to enable folder selection."
        );
      }

      await openFolderPicker({
        accessToken: data.access_token,
        apiKey: data.api_key,
        appId: data.app_id,
        onPicked: (folder) => {
          setFolderMutation.mutate({ folderId: folder.id, folderName: folder.name });
        },
      });
    } catch (err: any) {
      toast.error("Could not open folder picker", { description: err.message });
    } finally {
      setPickerOpening(false);
    }
  }, [setFolderMutation]);

  // Extract single file
  const extractMutation = useMutation({
    mutationFn: async (scannedFileId: string) => {
      const { data, error } = await supabase.functions.invoke("extract-invoice-pdf", {
        body: { scannedFileId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-pending-files"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
    },
    onError: (err: any) => toast.error("Extraction failed", { description: err.message }),
  });

  // Batch extract
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });

  const handleBatchExtract = useCallback(async () => {
    setExtracting(true);
    setExtractProgress({ current: 0, total: 0 });

    // Step 1: Always scan first to identify new files and prevent duplicates
    toast.info("Scanning folder for new invoices...");
    try {
      const { data: scanResult, error: scanError } = await supabase.functions.invoke("google-drive-scan", {
        body: { action: "scan" },
      });
      if (scanError) throw scanError;
      toast.success(`Scan complete: ${scanResult.new_files} new, ${scanResult.already_tracked} already tracked`);
    } catch (err: any) {
      toast.error("Scan failed — aborting extraction", { description: err.message });
      setExtracting(false);
      return;
    }

    // Refresh pending files list after scan
    await queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
    await queryClient.invalidateQueries({ queryKey: ["ingestion-pending-files"] });

    // Re-fetch the latest pending files after scan
    const { data: { user } } = await supabase.auth.getUser();
    const { data: _eff } = user
      ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
      : { data: null };
    const accountId = (_eff as string | null) || user?.id;
    const { data: freshPending } = await supabase
      .from("ingestion_scanned_files")
      .select("*")
      .eq("user_id", user!.id)
      .eq("processing_status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    const filesToExtract = freshPending || [];
    if (filesToExtract.length === 0) {
      toast.info("No new files to extract");
      setExtracting(false);
      return;
    }

    // Step 2: Extract only the new pending files
    setExtractProgress({ current: 0, total: filesToExtract.length });
    toast.info(`Extracting ${filesToExtract.length} files...`);

    let skippedDuplicates = 0;
    let extracted = 0;

    for (let i = 0; i < filesToExtract.length; i++) {
      try {
        setExtractProgress({ current: i + 1, total: filesToExtract.length });
        const { data: result } = await supabase.functions.invoke("extract-invoice-pdf", {
          body: { scannedFileId: filesToExtract[i].id },
        });
        if (result?.skipped && result?.reason === 'duplicate') {
          skippedDuplicates++;
        } else {
          extracted++;
        }
        if (i < filesToExtract.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`Error extracting file ${filesToExtract[i].file_name}:`, err);
      }
    }

    setExtracting(false);
    const parts = [];
    if (extracted > 0) parts.push(`${extracted} extracted`);
    if (skippedDuplicates > 0) parts.push(`${skippedDuplicates} skipped (already exist)`);
    toast.success(`Batch complete: ${parts.join(', ') || 'No new invoices'}`);
    queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
    queryClient.invalidateQueries({ queryKey: ["ingestion-pending-files"] });
    queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
  }, [queryClient]);

  // Folder browsing has been replaced by the Google Picker (drive.file scope).

  if (connectionLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Token auto-refreshes server-side, so we only flag if there's no refresh token (truly broken)
  const isTokenExpired = connection && !connection.refresh_token;

  // Not connected state
  if (!connection) {
    const isGoogleUser = authProvider === "google";
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <GoogleDriveIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Connect Google Drive</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Connect your Google Drive to automatically scan any invoice PDF — digital exports, scanned paper invoices, or even phone photos — extract data with built-in OCR + AI, and import clean records into Recouply with full review control.
          </p>
          {isGoogleUser && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 max-w-md">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Signed in with Google — connection will use your existing Google session
              </p>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3 mb-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Read-only access</span>
            <span className="flex items-center gap-1"><Scan className="h-3 w-3" /> OCR for scanned PDFs</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Review before import</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> AI-powered extraction</span>
          </div>
          <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
            {connectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GoogleDriveIcon className="h-4 w-4 mr-2" />}
            {isGoogleUser ? "Connect with Your Google Account" : "Connect Google Drive"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status & Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isTokenExpired ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                <GoogleDriveIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Google Drive Connected
                  <Badge variant={isTokenExpired ? "destructive" : "default"} className="text-[10px]">
                    {isTokenExpired ? (
                      <><XCircle className="h-3 w-3 mr-1" /> Token Expired</>
                    ) : (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {connection.folder_name ? (
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" /> Monitoring: {connection.folder_name}
                    </span>
                  ) : (
                    "No folder selected — select a folder to start scanning"
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {isTokenExpired && (
                <Button variant="outline" size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reconnect
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleOpenPicker} disabled={pickerOpening}>
                {pickerOpening ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FolderOpen className="h-4 w-4 mr-1" />}
                {connection.folder_id ? "Change Folder" : "Select Folder"}
              </Button>
              {connection.folder_id && (
                <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
                  {scanMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Scan className="h-4 w-4 mr-1" />}
                  Scan Now
                </Button>
              )}
            </div>
          </div>

          {/* Connection Details Row */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" /> Provider: Google Drive
            </span>
            {connection.created_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Connected: {new Date(connection.created_at).toLocaleDateString()}
              </span>
            )}
            {connection.refresh_token && (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Token auto-refreshes
              </span>
            )}
            {connection.sync_frequency && (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Sync: {connection.sync_frequency}
              </span>
            )}
            <span className="ml-auto">
              <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                  onClick={() => setDisconnectOpen(true)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Disconnect
                </Button>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Disconnect Google Drive?</DialogTitle>
                    <DialogDescription>
                      This will disable the Google Drive connection. Your previously imported data will remain intact.
                      You can reconnect anytime.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setDisconnectOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                    >
                      {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                      Disconnect
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </span>
          </div>
        </CardHeader>
        {scanStats && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">{scanStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">{scanStats.processed}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{scanStats.reviewPending}</p>
                <p className="text-xs text-muted-foreground">Review Queue</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-destructive">{scanStats.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {scanStats.pending > 0 && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{scanStats.pending} files ready for extraction</p>
                    <p className="text-xs text-muted-foreground">AI will analyze each PDF and extract invoice data</p>
                  </div>
                  <Button size="sm" onClick={handleBatchExtract} disabled={extracting}>
                    {extracting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                    {extracting ? `Extracting ${extractProgress.current}/${extractProgress.total}` : "Extract All"}
                  </Button>
                </div>
                {extracting && (
                  <Progress value={(extractProgress.current / extractProgress.total) * 100} className="mt-2" />
                )}
              </div>
            )}

            {connection.last_sync_at && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last scanned: {new Date(connection.last_sync_at).toLocaleString()}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Tabs: Review Queue / Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto overflow-y-hidden no-scrollbar h-auto flex-nowrap justify-start">
          <TabsTrigger value="overview" className="gap-2">
            <FileText className="h-4 w-4" /> Scanned Files
          </TabsTrigger>
          <TabsTrigger value="sheets" className="gap-2">
            <GoogleSheetsIcon className="h-4 w-4" /> Sheet Templates
          </TabsTrigger>
          <TabsTrigger value="new-accounts" className="gap-2">
            <Building2 className="h-4 w-4" /> New Accounts
            {pendingAccountCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5">{pendingAccountCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <Eye className="h-4 w-4" /> Review Queue
            {scanStats && scanStats.reviewPending > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5">{scanStats.reviewPending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Ingestion Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" /> Scan History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ScannedFilesTable onExtract={(id) => extractMutation.mutate(id)} extracting={extractMutation.isPending} />
        </TabsContent>

        <TabsContent value="sheets">
          <SheetTemplatesSection />
        </TabsContent>

        <TabsContent value="new-accounts">
          <PendingSheetImports />
        </TabsContent>

        <TabsContent value="review">
          <IngestionReviewQueue />
        </TabsContent>

        <TabsContent value="dashboard">
          <IngestionDashboard />
        </TabsContent>

        <TabsContent value="history">
          <ScanHistoryLog />
        </TabsContent>
      </Tabs>

      {/* Best Practices & Schema Guide — always visible */}
      <SheetBestPractices />
    </div>
  );
}

// Scanned Files Table Component with pagination
function ScannedFilesTable({ onExtract, extracting }: { onExtract: (id: string) => void; extracting: boolean }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [archiving, setArchiving] = useState(false);
  const PAGE_SIZE = 15;
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ["ingestion-scanned-files-list"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return [];
      const { data } = await supabase
        .from("ingestion_scanned_files")
        .select("*")
        .eq("user_id", accountId)
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleArchiveAll = async () => {
    if (!files || files.length === 0) return;
    if (!confirm(`Archive all ${files.length} scanned files to Scan History? They'll be removed from this view.`)) return;
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // Create audit log entries for each file being archived
      const auditEntries = files.map((file: any) => ({
        user_id: accountId,
        scanned_file_id: file.id,
        event_type: "file_archived",
        event_details: {
          file_name: file.file_name,
          processing_status: file.processing_status,
          confidence_score: file.confidence_score,
          archived_at: now,
        },
      }));

      await supabase.from("ingestion_audit_log").insert(auditEntries);

      // Mark all files as archived
      const fileIds = files.map((f: any) => f.id);
      await supabase
        .from("ingestion_scanned_files")
        .update({ is_archived: true, archived_at: now })
        .in("id", fileIds);

      toast.success(`${files.length} files archived to Scan History`);
      queryClient.invalidateQueries({ queryKey: ["ingestion-scanned-files-list"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
      setCurrentPage(1);
    } catch (err: any) {
      toast.error("Failed to archive files", { description: err.message });
    } finally {
      setArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!files || files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No active scanned files. Check Scan History for archived records.</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: Clock },
    processing: { label: "Processing", color: "bg-blue-100 text-blue-800", icon: Loader2 },
    processed: { label: "Processed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
    error: { label: "Error", color: "bg-red-100 text-red-800", icon: XCircle },
  };

  const totalPages = Math.max(1, Math.ceil(files.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedFiles = files.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Scanned Files</CardTitle>
            <CardDescription>All PDF files detected in your connected folder ({files.length} total)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchiveAll}
            disabled={archiving}
            className="gap-2"
          >
            {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
            Archive All to History
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {paginatedFiles.map((file: any) => {
            const status = statusConfig[file.processing_status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Scanned {new Date(file.scan_timestamp || file.created_at).toLocaleDateString()}
                      {file.file_size && ` • ${(file.file_size / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {file.confidence_score != null && (
                    <Badge variant="outline" className="text-xs">
                      {file.confidence_score}% confidence
                    </Badge>
                  )}
                  <Badge className={`text-xs ${status.color}`}>
                    <StatusIcon className={`h-3 w-3 mr-1 ${file.processing_status === 'processing' ? 'animate-spin' : ''}`} />
                    {status.label}
                  </Badge>
                  {file.processing_status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onExtract(file.id)}
                      disabled={extracting}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Extract
                    </Button>
                  )}
                  {file.processing_status === "error" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onExtract(file.id)}
                      disabled={extracting}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, files.length)} of {files.length} files
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {safeCurrentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Scan History Log Component
function ScanHistoryLog() {
  const [currentPage, setCurrentPage] = useState(1);
  const [clearing, setClearing] = useState(false);
  const PAGE_SIZE = 15;
  const queryClient = useQueryClient();

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["ingestion-scan-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return [];
      const { data } = await supabase
        .from("ingestion_audit_log")
        .select("*")
        .eq("user_id", accountId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleClearHistory = async () => {
    if (!confirm("Clear all scan history and reset pending scanned files? This cannot be undone.")) return;
    setClearing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) throw new Error("Not authenticated");

      // Delete audit logs
      await supabase
        .from("ingestion_audit_log")
        .delete()
        .eq("user_id", accountId);

      // Delete pending/skipped scanned files (keep processed ones tied to approved invoices)
      await supabase
        .from("ingestion_scanned_files")
        .delete()
        .eq("user_id", accountId)
        .in("processing_status", ["pending", "skipped_duplicate", "error"]);

      toast.success("Scan history and pending files cleared");
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-pending-files"] });
      setCurrentPage(1);
    } catch (err: any) {
      toast.error("Failed to clear history", { description: err.message });
    } finally {
      setClearing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No scan history yet. Run a scan to see activity here.</p>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(auditLogs.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedLogs = auditLogs.slice(startIdx, startIdx + PAGE_SIZE);

  const eventIcons: Record<string, any> = {
    folder_scanned: Scan,
    file_extracted: Zap,
    file_approved: CheckCircle2,
    file_rejected: XCircle,
    extraction_error: XCircle,
    file_skipped_duplicate: Shield,
    file_archived: Clock,
  };

  const eventLabels: Record<string, string> = {
    folder_scanned: "Folder Scanned",
    file_extracted: "File Extracted",
    file_approved: "File Approved",
    file_rejected: "File Rejected",
    extraction_error: "Extraction Error",
    file_skipped_duplicate: "Skipped (Duplicate)",
    file_archived: "Archived to History",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Scan History</CardTitle>
            <CardDescription>Historical log of all ingestion activity ({auditLogs.length} events)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={clearing}
            className="gap-2 text-destructive hover:text-destructive"
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear History
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {paginatedLogs.map((log: any) => {
            const EventIcon = eventIcons[log.event_type] || Clock;
            const details = log.event_details || {};
            return (
              <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <EventIcon className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{eventLabels[log.event_type] || log.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                      {details.total_files != null && ` • ${details.total_files} files found`}
                      {details.new_files != null && ` • ${details.new_files} new`}
                      {details.skipped != null && details.skipped > 0 && ` • ${details.skipped} skipped`}
                      {details.file_name && ` • ${details.file_name}`}
                      {details.confidence_score != null && ` • ${details.confidence_score}% confidence`}
                    </p>
                  </div>
                </div>
                {details.skippedByName != null && details.skippedByName > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {details.skippedByName} filename duplicates
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, auditLogs.length)} of {auditLogs.length} events
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {safeCurrentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
