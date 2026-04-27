import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  AlertTriangle,
  Edit,
  UserPlus,
  Link2,
  ArrowRight,
  Search,
  Filter,
  Shield,
  CheckSquare,
  Layers,
  Sparkles,
  Building2,
  Mail,
  Hash,
} from "lucide-react";
import { useAccountId } from "@/hooks/useAccountId";
import { getUserOrganizationId } from "@/lib/supabase/auth";

interface ReviewItem {
  id: string;
  scanned_file_id: string;
  extracted_invoice_number: string | null;
  extracted_invoice_date: string | null;
  extracted_due_date: string | null;
  extracted_debtor_name: string | null;
  extracted_company_name: string | null;
  extracted_amount: number | null;
  extracted_outstanding_balance: number | null;
  extracted_po_number: string | null;
  extracted_billing_email: string | null;
  extracted_address: string | null;
  confidence_score: number;
  confidence_breakdown: any;
  matched_debtor_id: string | null;
  debtor_match_confidence: number | null;
  review_status: string;
  is_duplicate: boolean;
  duplicate_invoice_id: string | null;
  validation_errors: string[] | null;
  created_at: string;
  ingestion_scanned_files?: { file_name: string; file_id: string; page_count?: number | null };
}

export function IngestionReviewQueue() {
  const queryClient = useQueryClient();
  const { accountId, isLoading: accountLoading } = useAccountId();
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [showDebtorSelector, setShowDebtorSelector] = useState(false);
  const [debtorSearchTerm, setDebtorSearchTerm] = useState("");

  // Bulk state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkMatchDialog, setShowBulkMatchDialog] = useState(false);
  const [bulkDebtorSearch, setBulkDebtorSearch] = useState("");
  const [bulkSelectedDebtorId, setBulkSelectedDebtorId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Fetch review queue
  const { data: reviewItems, isLoading } = useQuery({
    queryKey: ["ingestion-review-queue", accountId, statusFilter, searchTerm],
    enabled: !!accountId && !accountLoading,
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from("ingestion_review_queue")
        .select("*, ingestion_scanned_files(file_name, file_id, page_count)")
        .eq("user_id", accountId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("review_status", statusFilter);
      }

      const { data } = await query;
      let results = data || [];

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter((item: any) =>
          item.extracted_invoice_number?.toLowerCase().includes(term) ||
          item.extracted_company_name?.toLowerCase().includes(term) ||
          item.extracted_debtor_name?.toLowerCase().includes(term) ||
          (item.ingestion_scanned_files as any)?.file_name?.toLowerCase().includes(term)
        );
      }

      return results as ReviewItem[];
    },
  });

  // Fetch debtors for matching
  const { data: debtors } = useQuery({
    queryKey: ["debtors-for-matching", accountId],
    enabled: !!accountId && !accountLoading,
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await supabase
        .from("debtors")
        .select("id, company_name, name, email, reference_id")
        .eq("user_id", accountId)
        .eq("is_archived", false)
        .order("company_name")
        .limit(1000);
      return data || [];
    },
  });

  // Filtered debtors for single-item selector
  const filteredDebtors = useMemo(() => {
    if (!debtors) return [];
    if (!debtorSearchTerm) return debtors;
    const term = debtorSearchTerm.toLowerCase();
    return debtors.filter((d: any) =>
      d.company_name?.toLowerCase().includes(term) ||
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.reference_id?.toLowerCase().includes(term)
    );
  }, [debtors, debtorSearchTerm]);

  // Filtered debtors for bulk match dialog
  const bulkFilteredDebtors = useMemo(() => {
    if (!debtors) return [];
    if (!bulkDebtorSearch) return debtors;
    const term = bulkDebtorSearch.toLowerCase();
    return debtors.filter((d: any) =>
      d.company_name?.toLowerCase().includes(term) ||
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.reference_id?.toLowerCase().includes(term)
    );
  }, [debtors, bulkDebtorSearch]);

  // Pending items for bulk selection
  const pendingItems = useMemo(() =>
    reviewItems?.filter(i => i.review_status === "pending") || [],
    [reviewItems]
  );

  // Select all / none
  const toggleSelectAll = () => {
    if (selectedRows.size === pendingItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pendingItems.map(i => i.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Approve import (single)
  const approveMutation = useMutation({
    mutationFn: async (item: ReviewItem) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const errors: string[] = [];
      const inv = editMode ? editData : item;
      if (!inv.extracted_invoice_number) errors.push("Invoice number is required");
      if (!inv.extracted_amount || inv.extracted_amount <= 0) errors.push("Amount must be greater than 0");
      if (inv.extracted_invoice_date && inv.extracted_due_date && new Date(inv.extracted_due_date) < new Date(inv.extracted_invoice_date)) {
        errors.push("Due date must be on or after invoice date");
      }
      if (!inv.matched_debtor_id && !inv.extracted_company_name && !inv.extracted_debtor_name) {
        errors.push("A debtor must be matched or created");
      }
      if (errors.length > 0) throw new Error(errors.join("; "));

      let debtorId = inv.matched_debtor_id;
      if (!debtorId) {
        const orgId = await getUserOrganizationId(accountId);
        const { data: newDebtor, error: debtorErr } = await supabase
          .from("debtors")
          .insert({
            user_id: accountId,
            organization_id: orgId,
            company_name: inv.extracted_company_name || inv.extracted_debtor_name || "Unknown",
            name: inv.extracted_debtor_name || inv.extracted_company_name || "Unknown",
            email: inv.extracted_billing_email || null,
          } as any)
          .select("id")
          .single();
        if (debtorErr) throw new Error(`Failed to create debtor: ${debtorErr.message}`);
        debtorId = newDebtor.id;
      }

      const orgId = await getUserOrganizationId(accountId);
      
      // Check for duplicate invoice number and make unique if needed
      let invoiceNumber = inv.extracted_invoice_number;
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("user_id", accountId)
        .eq("invoice_number", invoiceNumber)
        .limit(1);
      if (existing && existing.length > 0) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        invoiceNumber = `${invoiceNumber}-${suffix}`;
      }

      const { data: newInvoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          user_id: accountId,
          organization_id: orgId,
          debtor_id: debtorId,
          invoice_number: invoiceNumber,
          amount: inv.extracted_amount,
          amount_outstanding: inv.extracted_outstanding_balance || inv.extracted_amount,
          issue_date: inv.extracted_invoice_date || new Date().toISOString().split("T")[0],
          due_date: inv.extracted_due_date || new Date().toISOString().split("T")[0],
          status: "Open",
          source_system: "ai_ingestion",
          integration_source: "ai_ingestion",
          notes: `Imported via AI Smart Ingestion`,
        } as any)
        .select("id")
        .single();

      if (invErr) throw new Error(`Failed to create invoice: ${invErr.message}`);

      const edits = editMode ? {
        original: { invoice_number: item.extracted_invoice_number, amount: item.extracted_amount, due_date: item.extracted_due_date },
        edited: { invoice_number: inv.extracted_invoice_number, amount: inv.extracted_amount, due_date: inv.extracted_due_date },
      } : null;

      await supabase
        .from("ingestion_review_queue")
        .update({
          review_status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          created_invoice_id: newInvoice.id,
          created_debtor_id: debtorId,
          matched_debtor_id: debtorId,
          edits_made: edits,
        })
        .eq("id", item.id);

      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const pageCount = Math.max(1, Number((item.ingestion_scanned_files as any)?.page_count || 1));
      const PER_PAGE_RATE = 0.75;
      const chargeAmount = Number((PER_PAGE_RATE * pageCount).toFixed(2));
      await supabase.from("ingestion_usage_charges").insert({
        user_id: accountId,
        organization_id: orgId,
        review_item_id: item.id,
        scanned_file_id: item.scanned_file_id,
        file_name: item.ingestion_scanned_files?.file_name || item.extracted_invoice_number || "Unknown",
        charge_amount: chargeAmount,
        page_count: pageCount,
        billing_period: billingPeriod,
      } as any);

      await supabase.from("ingestion_audit_log").insert({
        user_id: accountId,
        organization_id: orgId,
        scanned_file_id: item.scanned_file_id,
        review_item_id: item.id,
        event_type: "invoice_approved",
        event_details: {
          invoice_id: newInvoice.id,
          debtor_id: debtorId,
          edits_made: !!edits,
          ingestion_charge: chargeAmount,
          page_count: pageCount,
          rate_per_page: PER_PAGE_RATE,
        },
      });

      // Report usage to Stripe (non-blocking) — bill 1 unit per page
      supabase.functions.invoke("report-ingestion-usage", { body: { quantity: pageCount } }).catch((err) =>
        console.warn("[Ingestion] Stripe usage report failed:", err)
      );

      return newInvoice;
    },
    onSuccess: () => {
      toast.success("Invoice imported successfully");
      setSelectedItem(null);
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
    },
    onError: (err: any) => toast.error("Import failed", { description: err.message }),
  });

  // Reject (single)
  const rejectMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase
        .from("ingestion_review_queue")
        .update({ review_status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", itemId);
      if (!accountId) throw new Error("No effective account");
      const orgId = await getUserOrganizationId(accountId);
      await supabase.from("ingestion_audit_log").insert({
        user_id: accountId,
        organization_id: orgId,
        review_item_id: itemId,
        event_type: "invoice_rejected",
      });
    },
    onSuccess: () => {
      toast.success("File rejected");
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
    },
  });

  // Bulk match mutation
  const bulkMatchMutation = useMutation({
    mutationFn: async ({ rowIds, debtorId }: { rowIds: string[]; debtorId: string }) => {
      const { error } = await supabase
        .from("ingestion_review_queue")
        .update({ matched_debtor_id: debtorId, debtor_match_confidence: 100 })
        .in("id", rowIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedRows.size} items matched to debtor`);
      setSelectedRows(new Set());
      setShowBulkMatchDialog(false);
      setBulkSelectedDebtorId(null);
      setBulkDebtorSearch("");
      queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
    },
    onError: (err: any) => toast.error("Bulk match failed", { description: err.message }),
  });

  // Bulk approve
  const bulkApproveMutation = useMutation({
    mutationFn: async (rowIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!accountId) throw new Error("No effective account");
      const orgId = await getUserOrganizationId(accountId);

      const items = reviewItems?.filter(i => rowIds.includes(i.id)) || [];
      let successCount = 0;
      let errorCount = 0;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        setBulkProgress({ current: idx + 1, total: items.length });
        try {
          if (!item.extracted_invoice_number || !item.extracted_amount || item.extracted_amount <= 0) {
            errorCount++;
            continue;
          }

          let debtorId = item.matched_debtor_id;
          if (!debtorId) {
            if (!item.extracted_company_name && !item.extracted_debtor_name) {
              errorCount++;
              continue;
            }
            const { data: newDebtor, error: dErr } = await supabase
              .from("debtors")
              .insert({
                user_id: accountId,
                organization_id: orgId,
                company_name: item.extracted_company_name || item.extracted_debtor_name || "Unknown",
                name: item.extracted_debtor_name || item.extracted_company_name || "Unknown",
                email: item.extracted_billing_email || null,
              } as any)
              .select("id")
              .single();
            if (dErr) { errorCount++; continue; }
            debtorId = newDebtor.id;
          }

          // Check for duplicate invoice number and make unique if needed
          let invoiceNumber = item.extracted_invoice_number;
          const { data: existingInv } = await supabase
            .from("invoices")
            .select("id")
            .eq("user_id", accountId)
            .eq("invoice_number", invoiceNumber)
            .limit(1);
          if (existingInv && existingInv.length > 0) {
            const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            invoiceNumber = `${invoiceNumber}-${suffix}`;
          }

          const { data: newInvoice, error: iErr } = await supabase
            .from("invoices")
            .insert({
              user_id: accountId,
              organization_id: orgId,
              debtor_id: debtorId,
              invoice_number: invoiceNumber,
              amount: item.extracted_amount,
              amount_outstanding: item.extracted_outstanding_balance || item.extracted_amount,
              issue_date: item.extracted_invoice_date || new Date().toISOString().split("T")[0],
              due_date: item.extracted_due_date || new Date().toISOString().split("T")[0],
              status: "Open",
              source_system: "google_drive",
              notes: "Imported from Google Drive PDF ingestion (bulk)",
            } as any)
            .select("id")
            .single();

          if (iErr) { errorCount++; continue; }

          await supabase
            .from("ingestion_review_queue")
            .update({
              review_status: "approved",
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              created_invoice_id: newInvoice.id,
              created_debtor_id: debtorId,
              matched_debtor_id: debtorId,
            })
            .eq("id", item.id);

          const now = new Date();
          const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const pageCount = Math.max(1, Number((item.ingestion_scanned_files as any)?.page_count || 1));
          const chargeAmount = Number((0.75 * pageCount).toFixed(2));
          await supabase.from("ingestion_usage_charges").insert({
            user_id: accountId,
            organization_id: orgId,
            review_item_id: item.id,
            scanned_file_id: item.scanned_file_id,
            file_name: item.ingestion_scanned_files?.file_name || item.extracted_invoice_number || "Unknown",
            charge_amount: chargeAmount,
            page_count: pageCount,
            billing_period: billingPeriod,
          } as any);

          // Report each file usage to Stripe (non-blocking) — bill 1 unit per page
          supabase.functions.invoke("report-ingestion-usage", { body: { quantity: pageCount } }).catch(() => {});

          successCount++;
        } catch {
          errorCount++;
        }
      }

      setBulkProgress(null);
      return { successCount, errorCount };
    },
    onSuccess: (result) => {
      toast.success(`Bulk import complete: ${result.successCount} approved, ${result.errorCount} failed`);
      setSelectedRows(new Set());
      queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
    },
    onError: (err: any) => {
      setBulkProgress(null);
      toast.error("Bulk approve failed", { description: err.message });
    },
  });

  // Bulk reject
  const bulkRejectMutation = useMutation({
    mutationFn: async (rowIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase
        .from("ingestion_review_queue")
        .update({ review_status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .in("id", rowIds);
    },
    onSuccess: () => {
      toast.success(`${selectedRows.size} items rejected`);
      setSelectedRows(new Set());
      queryClient.invalidateQueries({ queryKey: ["ingestion-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-scan-stats"] });
    },
  });

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100 dark:bg-green-900/30";
    if (score >= 50) return "text-amber-600 bg-amber-100 dark:bg-amber-900/30";
    return "text-red-600 bg-red-100 dark:bg-red-900/30";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 90) return "High";
    if (score >= 70) return "Medium";
    if (score >= 50) return "Low";
    return "Very Low";
  };

  const statusCounts = {
    pending: reviewItems?.filter(i => i.review_status === "pending").length || 0,
    approved: reviewItems?.filter(i => i.review_status === "approved").length || 0,
    rejected: reviewItems?.filter(i => i.review_status === "rejected").length || 0,
  };

  if (isLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>
    );
  }

  const selectedDebtorForBulk = debtors?.find((d: any) => d.id === bulkSelectedDebtorId);

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", count: statusCounts.pending, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "Approved", count: statusCounts.approved, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "Rejected", count: statusCounts.rejected, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
        ].map(s => (
          <Card key={s.label} className={s.bg}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <span className={`text-lg font-bold ${s.color}`}>{s.count}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Bulk Actions Bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedRows(new Set()); setCurrentPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, companies, files..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Bulk controls */}
            {statusFilter === "pending" && pendingItems.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Button size="sm" variant="ghost" onClick={toggleSelectAll} className="text-xs">
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  {selectedRows.size === pendingItems.length ? "Deselect All" : "Select All"}
                </Button>
                {selectedRows.size > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedRows.size} selected
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Bulk Action Buttons */}
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium mr-2">Bulk Actions:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowBulkMatchDialog(true); setBulkDebtorSearch(""); setBulkSelectedDebtorId(null); }}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Match to Debtor
              </Button>
              <Button
                size="sm"
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedRows))}
                disabled={bulkApproveMutation.isPending}
              >
                {bulkApproveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Approve ({selectedRows.size})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => bulkRejectMutation.mutate(Array.from(selectedRows))}
                disabled={bulkRejectMutation.isPending}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Reject ({selectedRows.size})
              </Button>
            </div>
          )}

          {/* Bulk progress */}
          {bulkProgress && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Processing {bulkProgress.current} of {bulkProgress.total}...</span>
                <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
              </div>
              <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Items */}
      {!reviewItems || reviewItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No items in review queue</p>
            <p className="text-xs text-muted-foreground mt-1">
              Scan a folder and extract PDFs to populate the review queue
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {(() => {
            const totalItems = reviewItems.length;
            const totalPages = Math.ceil(totalItems / pageSize);
            const safeCurrentPage = Math.min(currentPage, totalPages || 1);
            const startIdx = (safeCurrentPage - 1) * pageSize;
            const paginatedItems = reviewItems.slice(startIdx, startIdx + pageSize);

            return (
              <>
                {paginatedItems.map(item => {
                  const isPending = item.review_status === "pending";
                  const isSelected = selectedRows.has(item.id);
                  return (
                    <Card
                      key={item.id}
                      className={`transition-all ${isSelected ? "border-primary/60 bg-primary/5" : "hover:border-primary/30"}`}
                    >
                      <CardContent className="flex items-center gap-3 py-2.5 px-4">
                        {isPending && statusFilter === "pending" && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(item.id)}
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                        <div
                          className="flex items-center justify-between flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            setSelectedItem(item);
                            setEditData({ ...item });
                            setEditMode(false);
                            setDebtorSearchTerm("");
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">
                                  {item.extracted_invoice_number || "No invoice number"}
                                </p>
                                {item.is_duplicate && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                    <AlertTriangle className="h-3 w-3 mr-1" /> Duplicate
                                  </Badge>
                                )}
                                {item.matched_debtor_id && (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                    <Link2 className="h-3 w-3 mr-1" /> Matched
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.extracted_company_name || item.extracted_debtor_name || "Unknown debtor"}
                                {item.extracted_amount != null && ` · $${item.extracted_amount.toLocaleString()}`}
                                {" · "}{(item.ingestion_scanned_files as any)?.file_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <Badge className={`text-xs ${getConfidenceColor(item.confidence_score)}`}>
                              {item.confidence_score}% · {getConfidenceLabel(item.confidence_score)}
                            </Badge>
                            {item.validation_errors && item.validation_errors.length > 0 && (
                              <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                                {item.validation_errors.length} issues
                              </Badge>
                            )}
                            <Badge variant={item.review_status === "approved" ? "default" : item.review_status === "rejected" ? "destructive" : "secondary"}>
                              {item.review_status}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {startIdx + 1}–{Math.min(startIdx + pageSize, totalItems)} of {totalItems} items
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safeCurrentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="h-7 px-2 text-xs"
                      >
                        Previous
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (safeCurrentPage <= 3) {
                          page = i + 1;
                        } else if (safeCurrentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = safeCurrentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={page}
                            size="sm"
                            variant={safeCurrentPage === page ? "default" : "outline"}
                            onClick={() => setCurrentPage(page)}
                            className="h-7 w-7 p-0 text-xs"
                          >
                            {page}
                          </Button>
                        );
                      })}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safeCurrentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="h-7 px-2 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* =============== REVIEW DETAIL DIALOG =============== */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setEditMode(false); setShowDebtorSelector(false); }}}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Review Invoice
                  <Badge className={`ml-2 text-xs ${getConfidenceColor(selectedItem.confidence_score)}`}>
                    {selectedItem.confidence_score}% confidence
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Source file: {(selectedItem.ingestion_scanned_files as any)?.file_name}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Extracted Data */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Extracted Data</h3>
                    {selectedItem.review_status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => setEditMode(!editMode)}>
                        <Edit className="h-3 w-3 mr-1" />
                        {editMode ? "Cancel Edit" : "Edit Fields"}
                      </Button>
                    )}
                  </div>

                  {selectedItem.validation_errors && selectedItem.validation_errors.length > 0 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-xs font-medium text-destructive mb-1">Extraction Errors:</p>
                      {selectedItem.validation_errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {err}
                        </p>
                      ))}
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        You can fix these using "Edit Fields" before approving.
                      </p>
                    </div>
                  )}

                  {selectedItem.is_duplicate && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Possible duplicate invoice detected
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {[
                      { label: "Invoice Number", key: "extracted_invoice_number", icon: Hash },
                      { label: "Invoice Date", key: "extracted_invoice_date", type: "date" },
                      { label: "Due Date", key: "extracted_due_date", type: "date" },
                      { label: "Amount", key: "extracted_amount", type: "number" },
                      { label: "Outstanding Balance", key: "extracted_outstanding_balance", type: "number" },
                      { label: "Company Name", key: "extracted_company_name", icon: Building2 },
                      { label: "Contact Name", key: "extracted_debtor_name" },
                      { label: "Billing Email", key: "extracted_billing_email", icon: Mail },
                      { label: "PO Number", key: "extracted_po_number" },
                      { label: "Address", key: "extracted_address" },
                    ].map(field => (
                      <div key={field.key}>
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        {editMode ? (
                          <Input
                            type={field.type || "text"}
                            value={editData[field.key] || ""}
                            onChange={e => setEditData((prev: any) => ({
                              ...prev,
                              [field.key]: field.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
                            }))}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-sm font-medium">
                            {field.type === "number" && (selectedItem as any)[field.key] != null
                              ? `$${(selectedItem as any)[field.key].toLocaleString()}`
                              : (selectedItem as any)[field.key] || <span className="text-muted-foreground italic">Not detected</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Debtor Matching & Confidence */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Debtor Matching</h3>
                    {selectedItem.matched_debtor_id ? (
                      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                        <CardContent className="py-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <div>
                              <p className="text-sm font-medium">Matched to existing debtor</p>
                              <p className="text-xs text-muted-foreground">
                                {debtors?.find((d: any) => d.id === selectedItem.matched_debtor_id)?.company_name || "Unknown"} · Confidence: {selectedItem.debtor_match_confidence}%
                              </p>
                            </div>
                          </div>
                          {selectedItem.review_status === "pending" && (
                            <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => {
                              setSelectedItem(prev => prev ? { ...prev, matched_debtor_id: null, debtor_match_confidence: null } : null);
                              setEditData((prev: any) => ({ ...prev, matched_debtor_id: null }));
                              setShowDebtorSelector(true);
                            }}>
                              Change Match
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
                        <CardContent className="py-3">
                          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">No debtor match found</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setShowDebtorSelector(!showDebtorSelector); setDebtorSearchTerm(""); }}>
                              <Link2 className="h-3 w-3 mr-1" />
                              Match Existing
                            </Button>
                            <Button size="sm" variant="outline" onClick={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) { toast.error("Not authenticated"); return; }
                                if (!accountId) { toast.error("No effective account available"); return; }
                                const companyName = selectedItem.extracted_company_name || selectedItem.extracted_debtor_name;
                                if (!companyName) { toast.error("No debtor name available to create account"); return; }
                                const orgId = await getUserOrganizationId(accountId);
                                const { data: newDebtor, error: dErr } = await supabase
                                  .from("debtors")
                                  .insert({
                                    user_id: accountId,
                                    organization_id: orgId,
                                    company_name: selectedItem.extracted_company_name || selectedItem.extracted_debtor_name || "Unknown",
                                    name: selectedItem.extracted_debtor_name || selectedItem.extracted_company_name || "Unknown",
                                    email: selectedItem.extracted_billing_email || null,
                                  } as any)
                                  .select("id")
                                  .single();
                                if (dErr) throw dErr;
                                setEditData((prev: any) => ({ ...prev, matched_debtor_id: newDebtor.id }));
                                setSelectedItem(prev => prev ? { ...prev, matched_debtor_id: newDebtor.id, debtor_match_confidence: 100 } : null);
                                queryClient.invalidateQueries({ queryKey: ["debtors"] });
                                toast.success("New debtor account created and linked");
                              } catch (err: any) {
                                toast.error("Failed to create debtor", { description: err.message });
                              }
                            }}>
                              <UserPlus className="h-3 w-3 mr-1" />
                              Create New
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {showDebtorSelector && (
                      <Card className="mt-2">
                        <CardContent className="py-3">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search by name, email, or ID..."
                              value={debtorSearchTerm}
                              onChange={e => setDebtorSearchTerm(e.target.value)}
                              className="pl-9 h-8 text-sm"
                              autoFocus
                            />
                          </div>
                          <ScrollArea className="h-48">
                            {filteredDebtors.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">No debtors found</p>
                            ) : (
                              filteredDebtors.map((d: any) => (
                                <div
                                  key={d.id}
                                  className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer"
                                  onClick={() => {
                                    setEditData((prev: any) => ({ ...prev, matched_debtor_id: d.id }));
                                    setSelectedItem(prev => prev ? { ...prev, matched_debtor_id: d.id, debtor_match_confidence: 100 } : null);
                                    setShowDebtorSelector(false);
                                  }}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{d.company_name || d.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {d.email && `${d.email} · `}{d.reference_id || ""}
                                    </p>
                                  </div>
                                  <ArrowRight className="h-3 w-3 shrink-0 ml-2" />
                                </div>
                              ))
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Confidence Breakdown */}
                  {selectedItem.confidence_breakdown && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Confidence Breakdown</h3>
                      <Card>
                        <CardContent className="py-3 space-y-2">
                          {Object.entries(selectedItem.confidence_breakdown).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="capitalize">{key.replace(/_/g, " ")}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">({val.weight}pt)</span>
                                {val.passed ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedItem.review_status === "pending" && (
                <DialogFooter className="flex gap-2 mt-4">
                  <Button
                    variant="destructive"
                    onClick={() => rejectMutation.mutate(selectedItem.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(editMode ? { ...selectedItem, ...editData } : selectedItem)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Approve & Import
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =============== BULK MATCH DIALOG =============== */}
      <Dialog open={showBulkMatchDialog} onOpenChange={setShowBulkMatchDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Bulk Match to Debtor
            </DialogTitle>
            <DialogDescription>
              Match {selectedRows.size} selected invoice{selectedRows.size !== 1 ? "s" : ""} to an existing debtor account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search debtors by name, email, or RAID..."
                value={bulkDebtorSearch}
                onChange={e => setBulkDebtorSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {bulkSelectedDebtorId && selectedDebtorForBulk && (
              <Card className="bg-primary/5 border-primary/30">
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{selectedDebtorForBulk.company_name || selectedDebtorForBulk.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedDebtorForBulk.email} · {selectedDebtorForBulk.reference_id}</p>
                  </div>
                  <Badge>Selected</Badge>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="h-[280px] border rounded-lg">
              {bulkFilteredDebtors.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">No matching debtors found</p>
                </div>
              ) : (
                <div className="p-1">
                  {bulkFilteredDebtors.map((d: any) => (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-colors ${
                        bulkSelectedDebtorId === d.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setBulkSelectedDebtorId(d.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.company_name || d.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.email && `${d.email} · `}{d.reference_id || ""}
                        </p>
                      </div>
                      {bulkSelectedDebtorId === d.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkMatchDialog(false)}>Cancel</Button>
            <Button
              disabled={!bulkSelectedDebtorId || bulkMatchMutation.isPending}
              onClick={() => {
                if (bulkSelectedDebtorId) {
                  bulkMatchMutation.mutate({ rowIds: Array.from(selectedRows), debtorId: bulkSelectedDebtorId });
                }
              }}
            >
              {bulkMatchMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
              Match {selectedRows.size} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
