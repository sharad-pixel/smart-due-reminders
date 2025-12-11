import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Search,
  Loader2,
  Link as LinkIcon,
  X,
  Users,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;

const DataCenterReview = () => {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all_pending");
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkMatchCustomerId, setBulkMatchCustomerId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch upload details
  const { data: upload, isLoading: uploadLoading } = useQuery({
    queryKey: ["data-center-upload", uploadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_center_uploads")
        .select("*")
        .eq("id", uploadId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!uploadId,
  });

  // Fetch stats counts only (not full rows)
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["data-center-staging-stats", uploadId],
    queryFn: async () => {
      // Get total count
      const { count: totalCount } = await supabase
        .from("data_center_staging_rows")
        .select("*", { count: "exact", head: true })
        .eq("upload_id", uploadId);

      // Get matched count
      const { count: matchedCount } = await supabase
        .from("data_center_staging_rows")
        .select("*", { count: "exact", head: true })
        .eq("upload_id", uploadId)
        .in("match_status", ["matched_customer", "matched_invoice", "matched_payment"]);

      // Get pending count
      const { count: pendingCount } = await supabase
        .from("data_center_staging_rows")
        .select("*", { count: "exact", head: true })
        .eq("upload_id", uploadId)
        .in("match_status", ["needs_review", "unmatched"]);

      return {
        totalRows: totalCount || 0,
        matchedCount: matchedCount || 0,
        pendingCount: pendingCount || 0,
        processedCount: (totalCount || 0) - (pendingCount || 0),
      };
    },
    enabled: !!uploadId,
  });

  // Fetch staging rows with pagination
  const { data: stagingData, isLoading: rowsLoading, refetch } = useQuery({
    queryKey: ["data-center-staging-rows", uploadId, statusFilter, currentPage, searchTerm],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("data_center_staging_rows")
        .select("*", { count: "exact" })
        .eq("upload_id", uploadId)
        .order("row_index", { ascending: true });

      if (statusFilter === "all_pending") {
        query = query.in("match_status", ["needs_review", "unmatched"]);
      } else if (statusFilter !== "all") {
        query = query.eq("match_status", statusFilter);
      }

      // Apply pagination
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      return { rows: data || [], totalCount: count || 0 };
    },
    enabled: !!uploadId,
  });

  const stagingRows = stagingData?.rows || [];
  const totalFilteredCount = stagingData?.totalCount || 0;
  const totalPages = Math.ceil(totalFilteredCount / PAGE_SIZE);

  // Helper to refetch all data
  const refetchAllData = () => {
    refetch();
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ["data-center-upload", uploadId] });
  };

  // Fetch debtors for manual matching (limited fields)
  const { data: debtors } = useQuery({
    queryKey: ["debtors-for-matching"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("debtors")
        .select("id, name, company_name, email")
        .eq("user_id", user.id)
        .order("name", { ascending: true })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  // Confirm match mutation
  const confirmMatch = useMutation({
    mutationFn: async ({ rowId, customerId }: { rowId: string; customerId: string }) => {
      const { error } = await supabase
        .from("data_center_staging_rows")
        .update({
          matched_customer_id: customerId,
          match_status: "matched_customer",
          match_confidence: 100,
        })
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Match confirmed");
      refetchAllData();
    },
    onError: (error: any) => {
      toast.error(`Failed to confirm match: ${error.message}`);
    },
  });

  // Skip row mutation (mark as error/skip)
  const skipRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase
        .from("data_center_staging_rows")
        .update({ match_status: "error", error_message: "Skipped by user" })
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Row skipped");
      refetchAllData();
    },
    onError: (error: any) => {
      toast.error(`Failed to skip row: ${error.message}`);
    },
  });

  // Delete row mutation
  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase
        .from("data_center_staging_rows")
        .delete()
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Row deleted");
      refetchAllData();
    },
    onError: (error: any) => {
      toast.error(`Failed to delete row: ${error.message}`);
    },
  });

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: async (rowIds: string[]) => {
      const { error } = await supabase
        .from("data_center_staging_rows")
        .delete()
        .in("id", rowIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedRows.size} rows deleted`);
      setSelectedRows(new Set());
      refetchAllData();
    },
    onError: (error: any) => {
      toast.error(`Failed to delete rows: ${error.message}`);
    },
  });

  // Archive upload mutation
  const archiveUpload = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("data_center_uploads")
        .update({ status: "archived" })
        .eq("id", uploadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Upload archived");
      navigate("/data-center");
    },
    onError: (error: any) => {
      toast.error(`Failed to archive upload: ${error.message}`);
    },
  });

  // Create new customer and match
  const createAndMatch = useMutation({
    mutationFn: async ({ rowId, rawJson }: { rowId: string; rawJson: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newDebtor, error: debtorError } = await supabase
        .from("debtors")
        .insert({
          user_id: user.id,
          name: rawJson.customer_name || rawJson.company_name || "Unknown Customer",
          company_name: rawJson.company_name || rawJson.customer_name || "Unknown Company",
          contact_name: rawJson.contact_name || rawJson.customer_name || "Unknown",
          email: rawJson.email || rawJson.customer_email || "",
          reference_id: `RCPLY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        })
        .select()
        .single();

      if (debtorError) throw debtorError;

      const { error: updateError } = await supabase
        .from("data_center_staging_rows")
        .update({
          matched_customer_id: newDebtor.id,
          match_status: "matched_customer",
          match_confidence: 100,
        })
        .eq("id", rowId);

      if (updateError) throw updateError;

      return newDebtor;
    },
    onSuccess: () => {
      toast.success("New customer created and matched");
      refetchAllData();
      queryClient.invalidateQueries({ queryKey: ["debtors-for-matching"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create customer: ${error.message}`);
    },
  });

  // Bulk match mutation
  const bulkMatch = useMutation({
    mutationFn: async ({ rowIds, customerId }: { rowIds: string[]; customerId: string }) => {
      const { error } = await supabase
        .from("data_center_staging_rows")
        .update({
          matched_customer_id: customerId,
          match_status: "matched_customer",
          match_confidence: 100,
        })
        .in("id", rowIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedRows.size} rows matched successfully`);
      setSelectedRows(new Set());
      setBulkMatchCustomerId("");
      refetchAllData();
    },
    onError: (error: any) => {
      toast.error(`Failed to bulk match: ${error.message}`);
    },
  });

  // Get pending rows on current page for selection
  const pendingRowsOnPage = useMemo(() => 
    stagingRows.filter((r: any) => 
      r.match_status === "needs_review" || r.match_status === "unmatched"
    ), [stagingRows]
  );

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const toggleAllOnPage = () => {
    const allOnPageSelected = pendingRowsOnPage.every((r: any) => selectedRows.has(r.id));
    if (allOnPageSelected) {
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        pendingRowsOnPage.forEach((r: any) => newSet.delete(r.id));
        return newSet;
      });
    } else {
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        pendingRowsOnPage.forEach((r: any) => newSet.add(r.id));
        return newSet;
      });
    }
  };

  // Filter rows by search term (client-side on current page only)
  const filteredRows = useMemo(() => {
    if (!searchTerm) return stagingRows;
    const searchLower = searchTerm.toLowerCase();
    return stagingRows.filter((row: any) => {
      const rawJson = row.raw_json || {};
      return (
        (rawJson.customer_name || "").toLowerCase().includes(searchLower) ||
        (rawJson.company_name || "").toLowerCase().includes(searchLower) ||
        (rawJson.invoice_number || "").toLowerCase().includes(searchLower)
      );
    });
  }, [stagingRows, searchTerm]);

  // Create a map for quick debtor lookup
  const debtorMap = useMemo(() => {
    const map = new Map();
    debtors?.forEach((d: any) => map.set(d.id, d));
    return map;
  }, [debtors]);

  const isLoading = uploadLoading || rowsLoading;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched_customer":
        return <Badge variant="default" className="bg-green-600">Matched</Badge>;
      case "matched_invoice":
        return <Badge variant="default" className="bg-green-600">Invoice Matched</Badge>;
      case "matched_payment":
        return <Badge variant="default" className="bg-green-600">Payment Matched</Badge>;
      case "needs_review":
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Needs Review</Badge>;
      case "unmatched":
        return <Badge variant="outline" className="border-red-500 text-red-600">Unmatched</Badge>;
      case "error":
        return <Badge variant="destructive">Skipped/Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    setSelectedRows(new Set());
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/data-center")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Review Matches</h1>
              <p className="text-muted-foreground">
                {upload?.file_name || "Loading..."} • Review and confirm customer matches
              </p>
            </div>
          </div>
          {upload && upload.status !== "archived" && (
            <Button
              variant="outline"
              onClick={() => archiveUpload.mutate()}
              disabled={archiveUpload.isPending}
            >
              {archiveUpload.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Archive Upload
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{stats?.totalRows || 0}</div>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.matchedCount || 0}</div>
              <p className="text-sm text-muted-foreground">Matched</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats?.pendingCount || 0}</div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats?.processedCount || 0}</div>
              <p className="text-sm text-muted-foreground">Processed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Staging Rows</CardTitle>
                <CardDescription>
                  Showing {filteredRows.length} of {totalFilteredCount} records (Page {currentPage} of {totalPages || 1})
                </CardDescription>
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="all_pending">All Pending</SelectItem>
                    <SelectItem value="needs_review">Needs Review</SelectItem>
                    <SelectItem value="unmatched">Unmatched</SelectItem>
                    <SelectItem value="matched_customer">Matched</SelectItem>
                    <SelectItem value="error">Skipped/Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bulk Actions Toolbar */}
            {selectedRows.size > 0 && (
              <div className="mb-4 p-4 bg-muted rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{selectedRows.size} rows selected</span>
                </div>
                <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-3">
                  <Select
                    value={bulkMatchCustomerId}
                    onValueChange={setBulkMatchCustomerId}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select customer to match all..." />
                    </SelectTrigger>
                    <SelectContent>
                      {debtors?.slice(0, 100).map((debtor: any) => (
                        <SelectItem key={debtor.id} value={debtor.id}>
                          {debtor.name || debtor.company_name}
                          {debtor.email && ` (${debtor.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (bulkMatchCustomerId) {
                        bulkMatch.mutate({ rowIds: Array.from(selectedRows), customerId: bulkMatchCustomerId });
                      }
                    }}
                    disabled={!bulkMatchCustomerId || bulkMatch.isPending}
                  >
                    {bulkMatch.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Match Selected
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => bulkDelete.mutate(Array.from(selectedRows))}
                    disabled={bulkDelete.isPending}
                  >
                    {bulkDelete.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Selected
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedRows(new Set())}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            )}

            {/* Select All for Pending on Page */}
            {pendingRowsOnPage.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={pendingRowsOnPage.length > 0 && pendingRowsOnPage.every((r: any) => selectedRows.has(r.id))}
                  onCheckedChange={toggleAllOnPage}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select all on this page ({pendingRowsOnPage.length})
                </Label>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows && filteredRows.length > 0 ? (
              <div className="space-y-4">
                {filteredRows.map((row: any) => {
                  const rawJson = row.raw_json || {};
                  const matchedDebtor = debtorMap.get(row.matched_customer_id);
                  const isPending = row.match_status === "needs_review" || row.match_status === "unmatched";

                  return (
                    <div
                      key={row.id}
                      className={`border rounded-lg p-4 space-y-3 ${selectedRows.has(row.id) ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {isPending && (
                            <Checkbox
                              checked={selectedRows.has(row.id)}
                              onCheckedChange={() => toggleRowSelection(row.id)}
                              className="mt-1"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Row #{row.row_index + 1}</span>
                              {getStatusBadge(row.match_status)}
                              {row.match_confidence && row.match_confidence < 100 && (
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(row.match_confidence)}% confidence
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-medium mt-1">
                              {matchedDebtor?.name || matchedDebtor?.company_name || rawJson.customer_name || rawJson.company_name || "Unknown Customer"}
                              {matchedDebtor && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Linked to Account
                                </Badge>
                              )}
                            </h3>
                            <div className="text-sm text-muted-foreground space-x-3">
                              {rawJson.invoice_number && <span>Invoice: {rawJson.invoice_number}</span>}
                              {(rawJson.amount_outstanding || rawJson.amount || rawJson.amount_original) && (
                                <span>Amount: ${rawJson.amount_outstanding || rawJson.amount || rawJson.amount_original}</span>
                              )}
                              {(matchedDebtor?.email || rawJson.email || rawJson.customer_email) && (
                                <span>Email: {matchedDebtor?.email || rawJson.email || rawJson.customer_email}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => skipRow.mutate(row.id)}
                                disabled={skipRow.isPending}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Skip
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => createAndMatch.mutate({ rowId: row.id, rawJson })}
                                disabled={createAndMatch.isPending}
                              >
                                Create New
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteRow.mutate(row.id)}
                            disabled={deleteRow.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Current Match */}
                      {matchedDebtor && (
                        <div className="bg-muted/50 rounded p-3">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Matched to:</span>
                            <span className="text-sm">{matchedDebtor.name || matchedDebtor.company_name}</span>
                            {matchedDebtor.email && (
                              <span className="text-sm text-muted-foreground">({matchedDebtor.email})</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Manual Match Selector */}
                      {isPending && (
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <Label className="text-sm">Match to existing customer</Label>
                            <Select
                              value={selectedMatches[row.id] || ""}
                              onValueChange={(value) => {
                                setSelectedMatches(prev => ({ ...prev, [row.id]: value }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a customer..." />
                              </SelectTrigger>
                              <SelectContent>
                                {debtors?.slice(0, 100).map((debtor: any) => (
                                  <SelectItem key={debtor.id} value={debtor.id}>
                                    {debtor.name || debtor.company_name}
                                    {debtor.email && ` (${debtor.email})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedMatches[row.id] && (
                            <Button
                              size="sm"
                              onClick={() => {
                                confirmMatch.mutate({ rowId: row.id, customerId: selectedMatches[row.id] });
                                setSelectedMatches(prev => {
                                  const newState = { ...prev };
                                  delete newState[row.id];
                                  return newState;
                                });
                              }}
                              disabled={confirmMatch.isPending}
                            >
                              {confirmMatch.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Confirm
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Error Message */}
                      {row.error_message && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{row.error_message}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rows to review</p>
                <p className="text-sm">All records have been processed</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DataCenterReview;
