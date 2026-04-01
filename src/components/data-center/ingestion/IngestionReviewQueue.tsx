import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

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
  ingestion_scanned_files?: { file_name: string; file_id: string };
}

export function IngestionReviewQueue() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [showDebtorSelector, setShowDebtorSelector] = useState(false);

  // Fetch review queue
  const { data: reviewItems, isLoading } = useQuery({
    queryKey: ["ingestion-review-queue", statusFilter, searchTerm],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let query = supabase
        .from("ingestion_review_queue")
        .select("*, ingestion_scanned_files(file_name, file_id)")
        .eq("user_id", user.id)
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
    queryKey: ["debtors-for-matching"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("debtors")
        .select("id, company_name, name, email, reference_id")
        .eq("user_id", user.id)
        .order("company_name")
        .limit(500);
      return data || [];
    },
  });

  // Approve import
  const approveMutation = useMutation({
    mutationFn: async (item: ReviewItem) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate
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

      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }

      let debtorId = inv.matched_debtor_id;

      // Create debtor if not matched
      if (!debtorId) {
        const { data: orgId } = await supabase.rpc("get_user_organization_id" as any, { p_user_id: user.id });
        const { data: newDebtor, error: debtorErr } = await supabase
          .from("debtors")
          .insert({
            user_id: user.id,
            organization_id: orgId,
            company_name: inv.extracted_company_name || inv.extracted_debtor_name || "Unknown",
            name: inv.extracted_debtor_name || null,
            email: inv.extracted_billing_email || null,
          } as any)
          .select("id")
          .single();

        if (debtorErr) throw new Error(`Failed to create debtor: ${debtorErr.message}`);
        debtorId = newDebtor.id;
      }

      // Create invoice
      const { data: orgId } = await supabase.rpc("get_user_organization_id" as any, { p_user_id: user.id });
      const { data: newInvoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          organization_id: orgId,
          debtor_id: debtorId,
          invoice_number: inv.extracted_invoice_number,
          amount: inv.extracted_amount,
          amount_outstanding: inv.extracted_outstanding_balance || inv.extracted_amount,
          issue_date: inv.extracted_invoice_date || new Date().toISOString().split("T")[0],
          due_date: inv.extracted_due_date || new Date().toISOString().split("T")[0],
          status: "Open",
          source_system: "google_drive",
          notes: `Imported from Google Drive PDF ingestion`,
        } as any)
        .select("id")
        .single();

      if (invErr) throw new Error(`Failed to create invoice: ${invErr.message}`);

      // Update review queue item
      const edits = editMode ? {
        original: {
          invoice_number: item.extracted_invoice_number,
          amount: item.extracted_amount,
          due_date: item.extracted_due_date,
        },
        edited: {
          invoice_number: inv.extracted_invoice_number,
          amount: inv.extracted_amount,
          due_date: inv.extracted_due_date,
        },
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

      // Record ingestion usage charge ($0.75 per approved file)
      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await supabase.from("ingestion_usage_charges").insert({
        user_id: user.id,
        organization_id: orgId,
        review_item_id: item.id,
        scanned_file_id: item.scanned_file_id,
        file_name: item.ingestion_scanned_files?.file_name || item.extracted_invoice_number || "Unknown",
        charge_amount: 0.75,
        billing_period: billingPeriod,
      } as any);

      // Audit log
      await supabase.from("ingestion_audit_log").insert({
        user_id: user.id,
        organization_id: orgId,
        scanned_file_id: item.scanned_file_id,
        review_item_id: item.id,
        event_type: "invoice_approved",
        event_details: {
          invoice_id: newInvoice.id,
          debtor_id: debtorId,
          edits_made: !!edits,
          ingestion_charge: 0.75,
        },
      });

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

  // Reject
  const rejectMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase
        .from("ingestion_review_queue")
        .update({
          review_status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      const { data: orgId } = await supabase.rpc("get_user_organization_id" as any, { p_user_id: user.id });
      await supabase.from("ingestion_audit_log").insert({
        user_id: user.id,
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

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 50) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
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
        <div className="space-y-2">
          {reviewItems.map(item => (
            <Card
              key={item.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => {
                setSelectedItem(item);
                setEditData({ ...item });
                setEditMode(false);
              }}
            >
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-4 min-w-0">
                  <FileText className="h-5 w-5 text-red-500 shrink-0" />
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
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.extracted_company_name || item.extracted_debtor_name || "Unknown debtor"}
                      {item.extracted_amount && ` • $${item.extracted_amount.toLocaleString()}`}
                      {" • "}{(item.ingestion_scanned_files as any)?.file_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge className={`text-xs ${getConfidenceColor(item.confidence_score)}`}>
                    {item.confidence_score}%
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setEditMode(false); }}}>
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

                  {/* Validation Errors */}
                  {selectedItem.validation_errors && selectedItem.validation_errors.length > 0 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-xs font-medium text-destructive mb-1">Validation Issues:</p>
                      {selectedItem.validation_errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {err}
                        </p>
                      ))}
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
                      { label: "Invoice Number", key: "extracted_invoice_number" },
                      { label: "Invoice Date", key: "extracted_invoice_date", type: "date" },
                      { label: "Due Date", key: "extracted_due_date", type: "date" },
                      { label: "Amount", key: "extracted_amount", type: "number" },
                      { label: "Outstanding Balance", key: "extracted_outstanding_balance", type: "number" },
                      { label: "Company Name", key: "extracted_company_name" },
                      { label: "Contact Name", key: "extracted_debtor_name" },
                      { label: "Billing Email", key: "extracted_billing_email" },
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
                  {/* Debtor Match */}
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
                                Confidence: {selectedItem.debtor_match_confidence}%
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
                        <CardContent className="py-3">
                          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">No debtor match found</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowDebtorSelector(!showDebtorSelector)}>
                              <Link2 className="h-3 w-3 mr-1" />
                              Match Existing
                            </Button>
                            <Button size="sm" variant="outline">
                              <UserPlus className="h-3 w-3 mr-1" />
                              Create New
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {showDebtorSelector && (
                      <Card className="mt-2">
                        <CardContent className="py-3 max-h-48 overflow-y-auto">
                          {debtors?.map((d: any) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer"
                              onClick={() => {
                                setEditData((prev: any) => ({ ...prev, matched_debtor_id: d.id }));
                                setSelectedItem(prev => prev ? { ...prev, matched_debtor_id: d.id, debtor_match_confidence: 100 } : null);
                                setShowDebtorSelector(false);
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium">{d.company_name}</p>
                                <p className="text-xs text-muted-foreground">{d.email || d.reference_id}</p>
                              </div>
                              <ArrowRight className="h-3 w-3" />
                            </div>
                          ))}
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
    </div>
  );
}
