import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Database, Table, CheckCircle, AlertTriangle } from "lucide-react";

interface TableStats {
  name: string;
  count: number;
  hasRLS: boolean;
}

const AdminDatabase = () => {
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(true);

  const tables = [
    "profiles",
    "debtors",
    "invoices",
    "payments",
    "ai_drafts",
    "collection_tasks",
    "collection_activities",
    "inbound_emails",
    "waitlist_signups",
    "early_access_whitelist",
    "audit_logs",
    "daily_digests",
    "collection_workflows",
    "data_center_uploads",
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const stats: TableStats[] = [];
      
      for (const table of tables) {
        try {
          const { count, error } = await supabase
            .from(table as any)
            .select("*", { count: "exact", head: true });

          stats.push({
            name: table,
            count: error ? -1 : (count || 0),
            hasRLS: !error, // If we can query, RLS is working
          });
        } catch {
          stats.push({ name: table, count: -1, hasRLS: false });
        }
      }

      setTableStats(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalRecords = tableStats.reduce((sum, t) => sum + (t.count > 0 ? t.count : 0), 0);

  return (
    <AdminLayout title="Database Health" description="Monitor database tables and records">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{totalRecords.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Table className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Monitored Tables</p>
                <p className="text-2xl font-bold">{tables.length}</p>
              </div>
            </div>
          </Card>
        </div>
        <Button onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Table Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tableStats.map((table) => (
                <div
                  key={table.name}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{table.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {table.count >= 0 ? `${table.count.toLocaleString()} records` : "Error"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {table.hasRLS ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        RLS OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminDatabase;
