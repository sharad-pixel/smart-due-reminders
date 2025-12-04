import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Search,
  Loader2,
  Link as LinkIcon,
  X
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

const DataCenterReview = () => {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("needs_review");

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

  // Fetch staging rows
  const { data: stagingRows, isLoading: rowsLoading, refetch } = useQuery({
    queryKey: ["data-center-staging-rows", uploadId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("data_center_staging_rows")
        .select("*")
        .eq("upload_id", uploadId)
        .order("row_index", { ascending: true });

      if (statusFilter !== "all") {
        query = query.eq("match_status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!uploadId,
  });

  // Fetch debtors for manual matching
  const { data: debtors } = useQuery({
    queryKey: ["debtors-for-matching"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("debtors")
        .select("id, name, company_name, email")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

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
          match_status: "confirmed",
          match_confidence: 100,
        })
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Match confirmed");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["data-center-upload", uploadId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to confirm match: ${error.message}`);
    },
  });

  // Skip row mutation
  const skipRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase
        .from("data_center_staging_rows")
        .update({ match_status: "skipped" })
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Row skipped");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to skip row: ${error.message}`);
    },
  });

  // Create new customer and match
  const createAndMatch = useMutation({
    mutationFn: async ({ rowId, rawJson }: { rowId: string; rawJson: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create a new debtor
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

      // Update staging row
      const { error: updateError } = await supabase
        .from("data_center_staging_rows")
        .update({
          matched_customer_id: newDebtor.id,
          match_status: "confirmed",
          match_confidence: 100,
        })
        .eq("id", rowId);

      if (updateError) throw updateError;

      return newDebtor;
    },
    onSuccess: () => {
      toast.success("New customer created and matched");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["debtors-for-matching"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create customer: ${error.message}`);
    },
  });

  const filteredRows = stagingRows?.filter((row: any) => {
    if (!searchTerm) return true;
    const rawJson = row.raw_json || {};
    const searchLower = searchTerm.toLowerCase();
    return (
      (rawJson.customer_name || "").toLowerCase().includes(searchLower) ||
      (rawJson.company_name || "").toLowerCase().includes(searchLower) ||
      (rawJson.invoice_number || "").toLowerCase().includes(searchLower)
    );
  });

  const isLoading = uploadLoading || rowsLoading;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge variant="default" className="bg-green-600">Confirmed</Badge>;
      case "needs_review":
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Needs Review</Badge>;
      case "skipped":
        return <Badge variant="secondary">Skipped</Badge>;
      case "auto_matched":
        return <Badge variant="default">Auto Matched</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
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

        {/* Stats */}
        {upload && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{upload.row_count || 0}</div>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-green-600">{upload.matched_count || 0}</div>
                <p className="text-sm text-muted-foreground">Matched</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {stagingRows?.filter((r: any) => r.match_status === "needs_review").length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Needs Review</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{upload.processed_count || 0}</div>
                <p className="text-sm text-muted-foreground">Processed</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Staging Rows</CardTitle>
                <CardDescription>Review and match records to customers</CardDescription>
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="needs_review">Needs Review</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="auto_matched">Auto Matched</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRows && filteredRows.length > 0 ? (
              <div className="space-y-4">
                {filteredRows.map((row: any) => {
                  const rawJson = row.raw_json || {};
                  const matchedDebtor = debtors?.find((d: any) => d.id === row.matched_customer_id);

                  return (
                    <div
                      key={row.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
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
                            {rawJson.customer_name || rawJson.company_name || "Unknown Customer"}
                          </h3>
                          <div className="text-sm text-muted-foreground space-x-3">
                            {rawJson.invoice_number && <span>Invoice: {rawJson.invoice_number}</span>}
                            {rawJson.amount && <span>Amount: ${rawJson.amount}</span>}
                            {rawJson.email && <span>Email: {rawJson.email}</span>}
                          </div>
                        </div>

                        {row.match_status === "needs_review" && (
                          <div className="flex gap-2">
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
                          </div>
                        )}
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
                      {row.match_status === "needs_review" && (
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <Label className="text-sm">Match to existing customer</Label>
                            <Select
                              onValueChange={(value) => {
                                confirmMatch.mutate({ rowId: row.id, customerId: value });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a customer..." />
                              </SelectTrigger>
                              <SelectContent>
                                {debtors?.map((debtor: any) => (
                                  <SelectItem key={debtor.id} value={debtor.id}>
                                    {debtor.name || debtor.company_name}
                                    {debtor.email && ` (${debtor.email})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
