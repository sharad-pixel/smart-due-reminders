import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import IngestionBalanceCard from "@/components/ingestion/IngestionBalanceCard";
import SEO from "@/components/seo/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { openFolderPicker } from "@/lib/googlePicker";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FolderPlus, RefreshCw, Upload, FileText, Sparkles, AlertTriangle, CalendarClock,
  CheckCircle2, XCircle, FileSearch, Building2, DollarSign, Receipt, Loader2,
  ShieldAlert, Clock, ClipboardList, BellRing, Wand2, ExternalLink, Trash2, RotateCw, Info,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ------- Status helpers -------
// Lifecycle: Scanned → Under Review → Extracted
const STATUS_LABEL: Record<string, string> = {
  found: "Scanned",
  queued: "Scanned",
  scanning: "Scanned",
  ocr_processing: "Scanned",
  ai_extracting: "Scanned",
  processing: "Scanned",
  extracting: "Scanned",
  needs_review: "Under Review",
  approved: "Extracted",
  imported: "Extracted",
  duplicate: "Duplicate",
  failed: "Failed",
  rejected: "Rejected",
  archived: "Archived",
};
const STATUS_VARIANT = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["imported", "approved"].includes(s)) return "default";
  if (["failed", "rejected"].includes(s)) return "destructive";
  if (["needs_review"].includes(s)) return "outline";
  return "secondary";
};

const SCANNING_STATUSES = ["found", "queued", "scanning", "ocr_processing", "ai_extracting", "processing", "extracting"];

async function throwFunctionError(error: any, fallback: string) {
  if (!error) return;
  let message = error.message || fallback;
  const context = error.context;
  if (context?.json) {
    try {
      const body = await context.json();
      message = body?.error || body?.message || message;
    } catch {
      // Keep the SDK-provided message when the response body has already been read.
    }
  }
  throw new Error(message);
}

// ------- Hooks -------
function useFolders() {
  return useQuery({
    queryKey: ["lc-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_contract_drive_folders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useImports() {
  return useQuery({
    queryKey: ["lc-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_contract_imports")
        .select("*, debtor:debtors(id, company_name, name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    // Poll while any contract is still mid-flight so the list reflects
    // Scanned → Under Review → Extracted progression without a manual refresh.
    refetchInterval: (q) => {
      const rows: any[] = (q.state.data as any[]) || [];
      const inFlight = rows.some((r) =>
        SCANNING_STATUSES.includes(r.status)
      );
      return inFlight ? 3000 : false;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}

function useReviewItem(importId: string | null) {
  return useQuery({
    enabled: !!importId,
    queryKey: ["lc-review", importId],
    queryFn: async () => {
      const [imp, fields, matches, dates, schedules, flags, poc] = await Promise.all([
        supabase.from("live_contract_imports").select("*").eq("id", importId!).maybeSingle(),
        supabase.from("live_contract_extracted_fields").select("*").eq("import_id", importId!),
        supabase.from("contract_customer_matches").select("*").eq("import_id", importId!).order("match_score", { ascending: false }),
        supabase.from("contract_critical_dates").select("*").eq("import_id", importId!).order("due_date"),
        supabase.from("contract_invoice_schedules").select("*").eq("import_id", importId!).order("scheduled_date"),
        supabase.from("contract_risk_flags").select("*").eq("import_id", importId!),
        supabase.from("contract_poc_details").select("*").eq("import_id", importId!).maybeSingle(),
      ]);
      return {
        imp: imp.data, fields: fields.data || [], matches: matches.data || [],
        dates: dates.data || [], schedules: schedules.data || [], flags: flags.data || [], poc: poc.data,
      };
    },
  });
}

function useAuditLog() {
  return useQuery({
    queryKey: ["lc-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });
}

// ------- Dashboard widgets -------
function DashboardWidgets({ imports }: { imports: any[] }) {
  const stats = useMemo(() => {
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 86400000);
    return {
      scanned: imports.length,
      review: imports.filter((i) => i.status === "needs_review").length,
      imported: imports.filter((i) => i.status === "imported").length,
      failed: imports.filter((i) => i.status === "failed").length,
      duplicate: imports.filter((i) => i.status === "duplicate").length,
      upcomingRenewals: imports.filter((i) => i.term_end_date && new Date(i.term_end_date) <= in30 && new Date(i.term_end_date) >= today).length,
    };
  }, [imports]);

  const tile = (icon: any, label: string, value: number, color: string) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-md ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tile(<FileSearch className="h-4 w-4" />, "Scanned", stats.scanned, "bg-muted")}
      {tile(<ClipboardList className="h-4 w-4" />, "Needs Review", stats.review, "bg-amber-100 text-amber-700")}
      {tile(<CheckCircle2 className="h-4 w-4" />, "Imported", stats.imported, "bg-emerald-100 text-emerald-700")}
      {tile(<CalendarClock className="h-4 w-4" />, "Renewals ≤30d", stats.upcomingRenewals, "bg-blue-100 text-blue-700")}
      {tile(<XCircle className="h-4 w-4" />, "Failed", stats.failed, "bg-red-100 text-red-700")}
      {tile(<AlertTriangle className="h-4 w-4" />, "Duplicates", stats.duplicate, "bg-slate-100 text-slate-700")}
    </div>
  );
}

function RecentScansCard({ imports }: { imports: any[] }) {
  const recent = useMemo(() => {
    return [...imports]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 10);
  }, [imports]);

  if (recent.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-primary" /> Recently Scanned (AI Smart Ingestion)
            </CardTitle>
            <CardDescription>Last 10 contracts processed by Contract Intelligence.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Scanned</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((i) => (
                <TableRow
                  key={i.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { window.location.href = `/ai-ingestion/${i.id}`; }}
                >
                  <TableCell className="max-w-[280px]">
                    <div className="font-medium text-sm truncate">{i.contract_name || i.file_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {i.debtor?.company_name || i.debtor?.name || i.source}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{i.contract_type || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT(i.status)}>{STATUS_LABEL[i.status] || i.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{i.confidence ? `${Math.round(i.confidence)}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.created_at ? new Date(i.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/ai-ingestion/${i.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ------- Folders tab -------
function FoldersTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: folders = [], isLoading } = useFolders();
  const [pickerOpening, setPickerOpening] = useState(false);

  const addFolder = useMutation({
    mutationFn: async ({ folderId, folderName, connectionId }: any) => {
      const { data, error } = await supabase.functions.invoke("live-contract-scan", {
        body: { action: "add_folder", folderId, folderName, connectionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lc-folders"] }); toast.success("Folder added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const scanFolder = useMutation({
    mutationFn: async (folderRowId: string) => {
      const { data, error } = await supabase.functions.invoke("live-contract-scan", {
        body: { folderRowId },
      });
      if (error) await throwFunctionError(error, "Scan failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      const extracting = d.extraction_triggered || 0;
      toast.success(`Scan complete: ${d.new_files} new of ${d.total_files} files${extracting ? ` — extracting ${extracting}` : ""}`);
      qc.invalidateQueries({ queryKey: ["lc-folders"] });
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      if (d.new_files > 0 || extracting > 0) {
        navigate("/ai-ingestion?status=scanning", { replace: true });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reconnectDrive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { origin: window.location.origin },
      });
      if (error) await throwFunctionError(error, "Google Drive reconnect failed");
      if (!data?.authUrl) throw new Error("Google Drive reconnect failed");
      window.location.href = data.authUrl;
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePick = useCallback(async () => {
    setPickerOpening(true);
    try {
      // Reuse existing google-drive-scan picker token endpoint
      const { data: tokenData, error } = await supabase.functions.invoke("google-drive-scan", {
        body: { action: "get_picker_token" },
      });
      if (error) throw error;
      if (!tokenData?.access_token) throw new Error("No Google access token");

      // Find connection_id
      const { data: { user } } = await supabase.auth.getUser();
      const { data: conn } = await supabase
        .from("drive_connections").select("id").eq("user_id", user!.id).eq("is_active", true).maybeSingle();
      if (!conn) throw new Error("No active Google Drive connection. Connect one in Data Center first.");

      await openFolderPicker({
        accessToken: tokenData.access_token,
        apiKey: tokenData.api_key,
        appId: tokenData.app_id,
        onPicked: (folder) => {
          addFolder.mutate({ folderId: folder.id, folderName: folder.name, connectionId: conn.id });
        },
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPickerOpening(false);
    }
  }, [addFolder]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connected Drive Folders</CardTitle>
            <CardDescription>Select Google Drive folders to scan for live contracts.</CardDescription>
          </div>
          <Button onClick={handlePick} disabled={pickerOpening}>
            {pickerOpening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
            Add folder
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Google Drive permission required for folder scans</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Reconnect once to grant read access so contracts inside selected folders can be discovered and extracted.</span>
            <Button size="sm" variant="outline" onClick={() => reconnectDrive.mutate()} disabled={reconnectDrive.isPending}>
              {reconnectDrive.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Reconnect Drive
            </Button>
          </AlertDescription>
        </Alert>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
          folders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No folders connected yet. Add one to start scanning.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folder</TableHead>
                  <TableHead>Last scanned</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folders.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.folder_name || f.folder_id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.last_scanned_at ? new Date(f.last_scanned_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => scanFolder.mutate(f.id)} disabled={scanFolder.isPending}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${scanFolder.isPending ? "animate-spin" : ""}`} />
                        Scan now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CardContent>
    </Card>
  );
}

// ------- Upload dialog -------
function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const ACCEPT = [".pdf", ".docx", ".txt"];
  const MAX_BYTES = 25 * 1024 * 1024;

  const validate = (f: File): string | null => {
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPT.includes(ext)) return `${f.name}: unsupported file type`;
    if (f.size > MAX_BYTES) return `${f.name}: exceeds 25MB`;
    return null;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const errors: string[] = [];
    const ok: File[] = [];
    for (const f of arr) {
      const err = validate(f);
      if (err) errors.push(err);
      else ok.push(f);
    }
    if (errors.length) toast.error(errors.join(" • "));
    if (ok.length) setFiles((prev) => [...prev, ...ok]);
  };

  const uploadOne = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data, error } = await supabase.functions.invoke("live-contract-upload", { body: fd });
    if (error) throw new Error(error.message || "Upload failed");
    if (!data?.success || !data?.import?.id) throw new Error(data?.error || "Upload failed: server returned an unexpected response");
    return data;
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error("Select at least one file");
      setProgress({ done: 0, total: files.length });
      const results: any[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const r = await uploadOne(files[i]);
          results.push(r);
        } catch (e: any) {
          toast.error(`${files[i].name}: ${e.message}`);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      return results;
    },
    onSuccess: (results: any[]) => {
      if (results.length) toast.success(`${results.length} file${results.length > 1 ? "s" : ""} uploaded — extracting…`);
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      onOpenChange(false);
      setFiles([]);
      setProgress(null);
      if (results.length === 1) {
        navigate(`/ai-ingestion/${results[0].import.id}`);
      } else if (results.length > 1) {
        navigate("/ai-ingestion?status=scanning");
      }
    },
    onError: (e: any) => { toast.error(e.message); setProgress(null); },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!upload.isPending) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-primary" />Upload contract</DialogTitle>
          <DialogDescription>
            Drop one or more files. AI Smart Ingestion will extract critical dates, commercial terms, and risk flags automatically.
          </DialogDescription>
        </DialogHeader>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg px-6 py-10 text-center cursor-pointer transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-sm font-medium">
            {dragActive ? "Drop to upload" : "Drag & drop or click to browse"}
          </div>
          <div className="text-xs text-muted-foreground">PDF, DOCX or TXT • up to 25MB each</div>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }}
          />
        </label>

        {files.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 p-2 rounded border bg-muted/30 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtSize(f.size)}</div>
                </div>
                {!upload.isPending && (
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Remove"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{files.length} file{files.length > 1 ? "s" : ""} • {fmtSize(totalBytes)}</span>
              {!upload.isPending && (
                <button type="button" className="hover:text-foreground" onClick={() => setFiles([])}>Clear all</button>
              )}
            </div>
          </div>
        )}

        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span><span>{progress.done}/{progress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancel</Button>
          <Button onClick={() => upload.mutate()} disabled={files.length === 0 || upload.isPending}>
            {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {upload.isPending ? "Uploading…" : `Upload ${files.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------- Empty state -------
function ImportsEmptyState({ statusFilter }: { statusFilter?: string[] }) {
  const key = statusFilter?.includes("needs_review") ? "review"
    : statusFilter?.includes("imported") ? "imported"
    : statusFilter?.some((s) => SCANNING_STATUSES.includes(s)) ? "queue"
    : "all";
  const copy: Record<string, { title: string; body: string }> = {
    review: { title: "Nothing waiting for review", body: "Once AI finishes extracting, contracts that need a human eye will appear here." },
    imported: { title: "No imported contracts yet", body: "Approved and imported contracts will live here for ongoing management." },
    queue: { title: "No active scans", body: "Upload a contract or connect a Drive folder to kick off AI Smart Ingestion." },
    all: { title: "No contracts here", body: "Upload a contract to get started." },
  };
  const c = copy[key];
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-medium text-base">{c.title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{c.body}</p>
    </div>
  );
}

// ------- Imports/Queue table -------
function ImportsTable({ imports, onReview, statusFilter }: { imports: any[]; onReview: (id: string) => void; statusFilter?: string[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const filtered = statusFilter ? imports.filter((i) => statusFilter.includes(i.status)) : imports;
  const pendingIds = useMemo(
    () => filtered
      .filter((i) => {
        if (!["found", "queued"].includes(i.status)) return false;
        const ageMs = Date.now() - new Date(i.created_at || 0).getTime();
        return ageMs > 30_000;
      })
      .map((i) => i.id),
    [filtered],
  );
  const autoStartedRef = useRef<Set<string>>(new Set());
  const extract = useMutation({
    mutationFn: async (importId: string) => {
      const { data, error } = await supabase.functions.invoke("live-contract-extract", { body: { importId } });
      if (error) await throwFunctionError(error, "Extraction failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lc-imports"] }); toast.success("Extraction complete"); },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (pendingIds.length === 0 || extract.isPending) return;
    pendingIds
      .filter((id) => !autoStartedRef.current.has(id))
      .slice(0, 3)
      .forEach((id) => {
        autoStartedRef.current.add(id);
        extract.mutate(id);
      });
  }, [extract.isPending, extract.mutate, pendingIds]);

  const del = useMutation({
    mutationFn: async (importId: string) => {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "delete_import" },
      });
      if (error) await throwFunctionError(error, "Delete failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lc-imports"] }); toast.success("Contract deleted — you can re-upload it now"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  if (filtered.length === 0) {
    return <ImportsEmptyState statusFilter={statusFilter} />;
  }

  return (
    <TooltipProvider delayDuration={150}>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((i) => {
          const isFailed = i.status === "failed" || i.status === "rejected";
          const busy = del.isPending || extract.isPending;
          return (
          <TableRow
            key={i.id}
            className={`${isFailed ? "bg-destructive/5 " : ""}cursor-pointer hover:bg-muted/50`}
            onClick={() => navigate(`/ai-ingestion/${i.id}`)}
          >
            <TableCell>
              <div className="font-medium text-sm">{i.contract_name || i.file_name}</div>
              <div className="text-xs text-muted-foreground">{i.source}</div>
              {isFailed && i.error && (
                <div className="mt-2 flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive max-w-md">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="break-words">
                    <span className="font-medium">Failure reason:</span> {i.error}
                  </div>
                </div>
              )}
            </TableCell>
            <TableCell className="text-sm">
              {i.debtor?.company_name || i.debtor?.name || <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="text-sm">{i.contract_type || "—"}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1.5">
                <Badge variant={STATUS_VARIANT(i.status)}>{STATUS_LABEL[i.status] || i.status}</Badge>
                {isFailed && i.error && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-destructive cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs"><p className="text-xs">{i.error}</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TableCell>
            <TableCell className="text-sm">{i.confidence ? `${Math.round(i.confidence)}%` : "—"}</TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-end gap-1.5">
                {isFailed ? (
                  <Button size="sm" variant="outline" onClick={() => extract.mutate(i.id)} disabled={busy}>
                    <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                  </Button>
                ) : i.status === "found" || i.status === "queued" ? (
                  <Button size="sm" variant="outline" onClick={() => extract.mutate(i.id)} disabled={busy}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Extract
                  </Button>
                ) : i.status === "needs_review" ? (
                  <Button size="sm" onClick={() => onReview(i.id)}>Review</Button>
                ) : (
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/ai-ingestion/${i.id}`}>View</Link>
                  </Button>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete({ id: i.id, name: i.contract_name || i.file_name })}
                      disabled={busy}
                    >
                      {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">Delete contract</p></TooltipContent>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>

    <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{confirmDelete?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the contract, its uploaded file, and all extracted fields,
            schedules, dates, and review records. You can re-upload the contract afterwards.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { if (confirmDelete) { del.mutate(confirmDelete.id); setConfirmDelete(null); } }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </TooltipProvider>
  );
}

// ------- Post-import actions (invoices + alerts) -------
function PostImportActions({ importId, schedules, dates }: { importId: string; schedules: any[]; dates: any[] }) {
  const qc = useQueryClient();
  const pendingSchedules = useMemo(() => schedules.filter((s) => !s.invoice_id && s.amount), [schedules]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alertCfg, setAlertCfg] = useState<Record<string, { enabled: boolean; lead: number }>>(() => {
    const init: Record<string, { enabled: boolean; lead: number }> = {};
    dates.forEach((d) => { init[d.id] = { enabled: !!d.alert_enabled, lead: d.alert_lead_days || 30 }; });
    return init;
  });

  const allSelected = pendingSchedules.length > 0 && pendingSchedules.every((s) => selected.has(s.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pendingSchedules.map((s) => s.id)));

  const genInvoices = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "generate_invoices", scheduleIds: Array.from(selected) },
      });
      if (error) await throwFunctionError(error, "Generate invoices failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Generated ${d.created} invoice${d.created === 1 ? "" : "s"}${d.skipped?.length ? ` · ${d.skipped.length} skipped` : ""}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["lc-review", importId] });
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAlerts = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(alertCfg).map(([id, v]) => ({ id, enabled: v.enabled, lead_days: v.lead }));
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "set_alerts", dates: payload },
      });
      if (error) await throwFunctionError(error, "Save alerts failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Alerts saved · ${d.fired} sent now${d.fired ? "" : " (none due yet)"}`);
      qc.invalidateQueries({ queryKey: ["lc-review", importId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" /> Post-import actions
        </CardTitle>
        <CardDescription>Turn this contract into Recouply invoices and renewal/opt-out alerts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoices */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">Generate Recouply invoices</span>
              <Badge variant="outline" className="text-xs">{pendingSchedules.length} pending</Badge>
            </div>
            {pendingSchedules.length > 0 && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={toggleAll}>
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
          {schedules.length === 0 ? (
            <p className="text-xs text-muted-foreground">No invoice schedule was extracted from this contract.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto rounded border bg-background">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2 text-sm border-b last:border-b-0">
                  {s.invoice_id ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c) next.add(s.id); else next.delete(s.id);
                        setSelected(next);
                      }}
                      disabled={!s.amount}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.scheduled_date} · {s.billing_type || "invoice"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.description || "—"}
                      {s.expected_due_date && ` · due ${s.expected_due_date}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{s.amount ? `${s.currency || "USD"} ${Number(s.amount).toLocaleString()}` : "—"}</div>
                    {s.invoice_id && <div className="text-[10px] text-emerald-700">Invoice created</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            size="sm"
            className="mt-3"
            onClick={() => genInvoices.mutate()}
            disabled={selected.size === 0 || genInvoices.isPending}
          >
            {genInvoices.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Generate {selected.size > 0 ? `${selected.size} ` : ""}invoice{selected.size === 1 ? "" : "s"}
          </Button>
        </div>

        {/* Alerts */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <BellRing className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Renewal, opt-out & milestone alerts</span>
          </div>
          {dates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No critical dates were extracted from this contract.</p>
          ) : (
            <div className="space-y-2">
              {dates.map((d) => {
                const cfg = alertCfg[d.id] || { enabled: false, lead: 30 };
                return (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded border bg-background text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium capitalize">{d.date_type.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">Due {d.due_date}{d.risk_level ? ` · ${d.risk_level} risk` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Notify</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={cfg.lead}
                        onChange={(e) => setAlertCfg({ ...alertCfg, [d.id]: { ...cfg, lead: Number(e.target.value) || 30 } })}
                        className="h-7 w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!cfg.enabled}
                      />
                      <span className="text-muted-foreground">days before</span>
                    </div>
                    <Switch
                      checked={cfg.enabled}
                      onCheckedChange={(v) => setAlertCfg({ ...alertCfg, [d.id]: { ...cfg, enabled: v } })}
                    />
                  </div>
                );
              })}
              <Button size="sm" variant="outline" onClick={() => saveAlerts.mutate()} disabled={saveAlerts.isPending}>
                {saveAlerts.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5 mr-1.5" />}
                Save alert settings
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ------- Review drawer -------
function ReviewDrawer({ importId, onClose }: { importId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useReviewItem(importId);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [newDebtor, setNewDebtor] = useState({ company_name: "", primary_email: "", phone: "", address: "" });
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    setSelectedDebtorId(null);
    setNewDebtor({ company_name: "", primary_email: "", phone: "", address: "" });
    setPrefilled(false);
  }, [importId]);

  useEffect(() => {
    if (!data?.matches?.length || selectedDebtorId || newDebtor.company_name) return;
    const confidentMatch = data.matches.find((m: any) => Number(m.match_score) >= 75);
    if (confidentMatch?.candidate_debtor_id) setSelectedDebtorId(confidentMatch.candidate_debtor_id);
  }, [data?.matches, selectedDebtorId, newDebtor.company_name]);

  // Pre-fill new-customer form from extracted customer fields
  useEffect(() => {
    if (prefilled || !data?.fields?.length) return;
    const cust: Record<string, string> = {};
    for (const f of data.fields) {
      if (f.field_group === "customer" && f.field_value) cust[f.field_key] = f.field_value;
    }
    if (Object.keys(cust).length === 0) return;
    setNewDebtor((prev) => ({
      company_name: prev.company_name || cust.legal_name || cust.dba_name || cust.billing_entity || "",
      primary_email: prev.primary_email || cust.billing_contact || cust.primary_contact || (cust.email_domain ? `billing@${cust.email_domain.replace(/^@/, "")}` : ""),
      phone: prev.phone || "",
      address: prev.address || cust.address || "",
    }));
    setPrefilled(true);
  }, [data?.fields, prefilled]);

  const approve = useMutation({
    mutationFn: async () => {
      const body: any = { importId, action: "approve" };
      if (selectedDebtorId) body.debtorId = selectedDebtorId;
      else if (newDebtor.company_name) body.newDebtor = newDebtor;
      // else: backend will auto-create from extracted customer data
      const { data, error } = await supabase.functions.invoke("live-contract-approve", { body });
      if (error) await throwFunctionError(error, "Approve and import failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Contract imported");
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      qc.invalidateQueries({ queryKey: ["lc-audit"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("live-contract-approve", { body: { importId, action: "reject" } });
      if (error) await throwFunctionError(error, "Reject failed");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["lc-imports"] }); onClose(); },
  });

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    (data?.fields || []).forEach((f: any) => {
      g[f.field_group] = g[f.field_group] || [];
      g[f.field_group].push(f);
    });
    return g;
  }, [data?.fields]);

  return (
    <Sheet open={!!importId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Review extraction</SheetTitle>
          <SheetDescription>{data?.imp?.contract_name || data?.imp?.file_name}</SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Confidence */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">Confidence: {data.imp.confidence ? `${Math.round(data.imp.confidence)}%` : "—"}</Badge>
              <Badge variant={STATUS_VARIANT(data.imp.status)}>{STATUS_LABEL[data.imp.status]}</Badge>
            </div>

            {/* Customer match */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Customer match</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No existing customer matched this contract. Confirm the customer below to create it.</p>
                ) : (
                  <div className="space-y-2">
                    {data.matches.slice(0, 5).map((m: any) => (
                      <label key={m.id} className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${selectedDebtorId === m.candidate_debtor_id ? "border-primary bg-primary/5" : ""}`}>
                        <input type="radio" name="match" checked={selectedDebtorId === m.candidate_debtor_id} onChange={() => setSelectedDebtorId(m.candidate_debtor_id)} />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{m.match_reasons?.name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{m.match_reasons?.email} · {m.match_reasons?.reason} · {m.match_score}%</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium">Or create new customer {data.matches.length === 0 && <span className="text-muted-foreground">(auto-filled from contract)</span>}</p>
                  <Input placeholder="Company name" value={newDebtor.company_name} onChange={(e) => { setNewDebtor({ ...newDebtor, company_name: e.target.value }); setSelectedDebtorId(null); }} />
                  <Input placeholder="Primary email" value={newDebtor.primary_email} onChange={(e) => setNewDebtor({ ...newDebtor, primary_email: e.target.value })} />
                  <Input placeholder="Phone" value={newDebtor.phone} onChange={(e) => setNewDebtor({ ...newDebtor, phone: e.target.value })} />
                  <Input placeholder="Address" value={newDebtor.address} onChange={(e) => setNewDebtor({ ...newDebtor, address: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            {/* Extracted fields by group */}
            {Object.entries(groups).map(([group, fields]) => (
              <Card key={group}>
                <CardHeader className="pb-2"><CardTitle className="text-base capitalize">{group} details</CardTitle></CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {fields.map((f: any) => (
                      <div key={f.id} className="contents">
                        <dt className="text-muted-foreground capitalize">{f.field_key.replace(/_/g, " ")}</dt>
                        <dd className="font-medium">{f.field_value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}

            {/* Critical dates */}
            {data.dates.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />Critical dates</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {data.dates.map((d: any) => (
                    <div key={d.id} className="flex justify-between text-sm">
                      <span className="capitalize">{d.date_type.replace(/_/g, " ")}</span>
                      <span className="font-medium">{d.due_date} <Badge variant="outline" className="ml-1">{d.risk_level}</Badge></span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Invoice schedule */}
            {data.schedules.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" />Invoice schedule ({data.schedules.length})</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.schedules.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.scheduled_date}</TableCell>
                          <TableCell className="text-sm">{s.billing_type || "—"}</TableCell>
                          <TableCell className="text-sm text-right">{s.amount ? `${s.currency} ${s.amount}` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Risk flags */}
            {data.flags.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-600" />Risk flags</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.flags.map((f: any) => (
                    <div key={f.id} className="flex items-start gap-2 text-sm">
                      <Badge variant={f.severity === "critical" || f.severity === "high" ? "destructive" : "secondary"} className="capitalize">{f.severity}</Badge>
                      <div>
                        <div className="font-medium capitalize">{f.flag_type.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">{f.description}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* POC */}
            {data.poc && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">POC / Pilot</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>Period: {data.poc.poc_start} → {data.poc.poc_end}</div>
                  {data.poc.pilot_fee && <div>Fee: {data.poc.pilot_fee}</div>}
                  {data.poc.conversion_terms && <div className="text-muted-foreground">{data.poc.conversion_terms}</div>}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {/* Post-import actions: invoices + alerts */}
            {(data.imp.status === "imported" || data.imp.status === "approved") && (
              <PostImportActions importId={data.imp.id} schedules={data.schedules} dates={data.dates} />
            )}

            {data.imp.status === "needs_review" && (
              <div className="flex gap-2 sticky bottom-0 bg-background pt-3 border-t">
                <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending}>
                  <XCircle className="h-4 w-4 mr-2" />Reject
                </Button>
                <Button onClick={() => approve.mutate()} disabled={approve.isPending} className="flex-1">
                  {approve.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Approve & import
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ------- Audit tab -------
function AuditTab() {
  const { data: events = [] } = useAuditLog();
  return (
    <Card>
      <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {events.map((e: any) => (
              <div key={e.id} className="flex items-start gap-3 text-sm border-b pb-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium capitalize">{e.event_type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                  {e.event_details && Object.keys(e.event_details).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">{JSON.stringify(e.event_details)}</div>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No events yet.</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ------- Enhanced tab trigger -------
function RichTab({
  value, icon: Icon, label, sublabel, count, tone = "muted", urgent = false,
}: {
  value: string;
  icon: any;
  label: string;
  sublabel?: string;
  count?: number;
  tone?: "muted" | "amber" | "emerald" | "blue" | "red" | "primary";
  urgent?: boolean;
}) {
  const toneMap: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <TabsTrigger
      value={value}
      className="group relative flex-1 min-w-[160px] data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-primary/40 border border-transparent rounded-md px-3 py-2.5 h-auto items-start text-left transition-all"
    >
      <div className="flex items-start gap-2.5 w-full">
        <div className={`p-1.5 rounded-md shrink-0 ${toneMap[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{label}</span>
            {typeof count === "number" && (
              <Badge
                variant={urgent && count > 0 ? "destructive" : "secondary"}
                className="h-5 px-1.5 text-[10px] font-semibold"
              >
                {count}
              </Badge>
            )}
            {urgent && count > 0 && (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          {sublabel && (
            <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">{sublabel}</div>
          )}
        </div>
      </div>
    </TabsTrigger>
  );
}

// ------- Main page -------
export default function LiveContracts() {
  const { data: imports = [] } = useImports();
  const { data: folders = [] } = useFolders();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [searchText, setSearchText] = useState("");
  const requestedStatus = searchParams.get("status");

  // Distinct accounts present in the contract list
  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    imports.forEach((i: any) => {
      const id = i.debtor?.id || i.debtor_id;
      const name = i.debtor?.company_name || i.debtor?.name;
      if (id && name) map.set(id, name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [imports]);

  // Apply filters to the shared imports list
  const filteredImports = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return imports.filter((i: any) => {
      if (!showArchived && i.status === "archived") return false;
      if (accountFilter !== "all") {
        const id = i.debtor?.id || i.debtor_id;
        if (id !== accountFilter) return false;
      }
      if (q) {
        const hay = `${i.contract_name || ""} ${i.file_name || ""} ${i.debtor?.company_name || ""} ${i.debtor?.name || ""} ${i.contract_type || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [imports, accountFilter, showArchived, searchText]);

  const tabCounts = useMemo(() => {
    const queueStatuses = [...SCANNING_STATUSES, "failed"];
    const importedStatuses = showArchived
      ? ["imported", "duplicate", "rejected", "approved", "archived"]
      : ["imported", "duplicate", "rejected", "approved"];
    const queue = filteredImports.filter((i: any) => queueStatuses.includes(i.status));
    const failedInQueue = queue.filter((i: any) => i.status === "failed").length;
    const review = filteredImports.filter((i: any) => i.status === "needs_review").length;
    const imported = filteredImports.filter((i: any) => importedStatuses.includes(i.status)).length;
    const lastScanned = folders.reduce((max: number, f: any) => {
      const t = f.last_scanned_at ? new Date(f.last_scanned_at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    const folderSub = folders.length === 0
      ? "None connected"
      : lastScanned
        ? `Last scan ${new Date(lastScanned).toLocaleDateString()}`
        : "Never scanned";
    return {
      folders: folders.length,
      folderSub,
      queue: queue.length,
      queueSub: failedInQueue ? `${failedInQueue} failed` : "Awaiting extraction",
      review,
      reviewSub: review ? "Action needed" : "All clear",
      imported,
      importedSub: showArchived ? "Includes archived" : "Approved & duplicates",
      importedStatuses,
    };
  }, [filteredImports, folders, showArchived]);

  const filtersActive = accountFilter !== "all" || showArchived || searchText.trim().length > 0;
  const activeTab = requestedStatus === "scanning" || requestedStatus === "queued" || requestedStatus === "failed"
    ? "queue"
    : requestedStatus === "needs_review"
      ? "review"
      : requestedStatus === "imported"
        ? "imported"
        : tabCounts.queue > 0 ? "queue" : tabCounts.review > 0 ? "review" : "folders";

  return (
    <>
      <SEO title="AI Smart Ingestion — Recouply" description="Scan, extract, and validate contracts with AI Smart Ingestion." />
      <Layout>
        <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" /> AI Smart Ingestion — Contracts
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Scan contracts from Google Drive or upload them directly. AI extracts commercial terms, invoice schedules, renewals, and risk flags for review before import.
              </p>
            </div>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Upload contract
            </Button>
          </div>

          <IngestionBalanceCard />

          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search by contract name, file, type, or account…"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="w-full md:w-64">
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Filter by account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accounts ({accountOptions.length})</SelectItem>
                      {accountOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={showArchived}
                    onCheckedChange={(v) => setShowArchived(!!v)}
                  />
                  Show archived
                </label>
                {filtersActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setAccountFilter("all"); setShowArchived(false); setSearchText(""); }}
                  >
                    Clear filters
                  </Button>
                )}
                <div className="text-xs text-muted-foreground md:ml-auto">
                  Showing {filteredImports.length} of {imports.length} contract{imports.length === 1 ? "" : "s"}
                </div>
              </div>
            </CardContent>
          </Card>

          <DashboardWidgets imports={filteredImports} />

          <RecentScansCard imports={filteredImports} />

          <Tabs value={activeTab} onValueChange={(value) => {
            const next = new URLSearchParams(searchParams);
            if (value === "queue") next.set("status", "scanning");
            else if (value === "review") next.set("status", "needs_review");
            else if (value === "imported") next.set("status", "imported");
            else next.delete("status");
            setSearchParams(next, { replace: true });
          }}>
            <TabsList className="w-full h-auto bg-muted/40 p-1.5 flex flex-wrap gap-1 justify-stretch">
              <RichTab
                value="folders"
                icon={FolderPlus}
                label="Assigned folders"
                sublabel={tabCounts.folderSub}
                count={tabCounts.folders}
                tone="primary"
              />
              <RichTab
                value="queue"
                icon={Loader2}
                label="Scan queue"
                sublabel={tabCounts.queueSub}
                count={tabCounts.queue}
                tone="blue"
              />
              <RichTab
                value="review"
                icon={ClipboardList}
                label="Review"
                sublabel={tabCounts.reviewSub}
                count={tabCounts.review}
                tone="amber"
                urgent
              />
              <RichTab
                value="imported"
                icon={CheckCircle2}
                label="Imported"
                sublabel={tabCounts.importedSub}
                count={tabCounts.imported}
                tone="emerald"
              />
              <RichTab
                value="audit"
                icon={Clock}
                label="Audit trail"
                sublabel="Activity log"
                tone="muted"
              />
            </TabsList>

            <TabsContent value="folders" className="mt-4"><FoldersTab /></TabsContent>

            <TabsContent value="queue" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Scan queue</CardTitle><CardDescription>Files discovered or uploaded, awaiting extraction.</CardDescription></CardHeader>
                <CardContent>
                  <ImportsTable imports={filteredImports} onReview={setReviewId}
                    statusFilter={[...SCANNING_STATUSES, "failed"]} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="review" className="mt-4">
              <Card>
                <CardHeader><CardTitle>Needs review</CardTitle><CardDescription>Confirm extracted data before importing into your account.</CardDescription></CardHeader>
                <CardContent>
                  <ImportsTable imports={filteredImports} onReview={setReviewId} statusFilter={["needs_review"]} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="imported" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Imported & duplicates{showArchived ? " (incl. archived)" : ""}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ImportsTable imports={filteredImports} onReview={setReviewId} statusFilter={tabCounts.importedStatuses} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-4"><AuditTab /></TabsContent>
          </Tabs>
        </div>

        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        <ReviewDrawer importId={reviewId} onClose={() => setReviewId(null)} />
      </Layout>
    </>
  );
}
