import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
  metadata: any;
  old_values: any;
  new_values: any;
}

const AdminActivityLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, resourceFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }

      if (resourceFilter !== "all") {
        query = query.eq("resource_type", resourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.action_type?.toLowerCase().includes(searchLower) ||
      log.resource_type?.toLowerCase().includes(searchLower) ||
      log.user_id?.toLowerCase().includes(searchLower)
    );
  });

  const exportLogs = () => {
    const csv = [
      ["Timestamp", "Action", "Resource", "User ID", "Resource ID"].join(","),
      ...filteredLogs.map((log) =>
        [
          log.created_at,
          log.action_type,
          log.resource_type,
          log.user_id,
          log.resource_id || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <AdminLayout title="Activity Logs" description="Platform-wide audit trail">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Audit Logs</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="debtor">Debtor</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={exportLogs}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No logs found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, yyyy h:mm:ss a")}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-muted">
                          {log.action_type}
                        </span>
                      </TableCell>
                      <TableCell>{log.resource_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.user_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.resource_id || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminActivityLogs;
