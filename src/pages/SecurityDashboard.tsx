import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, AlertTriangle, Activity, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any;
  new_values: any;
  metadata: any;
  created_at: string;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  email: string | null;
  success: boolean;
  failure_reason: string | null;
  metadata: any;
  created_at: string;
}

export default function SecurityDashboard() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    failedLogins: 0,
    recentActions: 0,
    highRiskActions: 0,
  });

  useEffect(() => {
    if (!roleLoading && role !== "owner" && role !== "admin") {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [role, roleLoading, navigate]);

  useEffect(() => {
    if (role === "owner" || role === "admin") {
      loadSecurityData();
      
      // Set up real-time subscriptions
      const auditChannel = supabase
        .channel('audit_logs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'audit_logs'
          },
          () => {
            loadSecurityData();
          }
        )
        .subscribe();

      const securityChannel = supabase
        .channel('security_events_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'security_events'
          },
          () => {
            loadSecurityData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(auditChannel);
        supabase.removeChannel(securityChannel);
      };
    }
  }, [role]);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Load audit logs
      const { data: logs, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setAuditLogs(logs || []);

      // Load security events
      const { data: events, error: eventsError } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;
      setSecurityEvents(events || []);

      // Calculate stats
      const failedLogins = events?.filter(e => e.event_type === "login" && !e.success).length || 0;
      const recentActions = logs?.filter(l => {
        const logDate = new Date(l.created_at);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return logDate > dayAgo;
      }).length || 0;

      const highRiskActions = logs?.filter(l => 
        ["delete", "permission_change", "config_change", "bulk_action"].includes(l.action_type)
      ).length || 0;

      setStats({
        totalEvents: (logs?.length || 0) + (events?.length || 0),
        failedLogins,
        recentActions,
        highRiskActions,
      });

    } catch (error) {
      console.error("Error loading security data:", error);
      toast.error("Failed to load security data");
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = () => {
    try {
      const csvContent = [
        ["Timestamp", "User ID", "Action", "Resource Type", "Resource ID", "Details"],
        ...auditLogs.map(log => [
          format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
          log.user_id,
          log.action_type,
          log.resource_type,
          log.resource_id || "",
          JSON.stringify(log.metadata),
        ])
      ].map(row => row.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      
      toast.success("Audit logs exported successfully");
    } catch (error) {
      console.error("Error exporting logs:", error);
      toast.error("Failed to export logs");
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "delete":
      case "permission_change":
        return "destructive";
      case "create":
      case "login":
        return "default";
      case "update":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Security & Compliance
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor system activity and security events
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSecurityData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
              <p className="text-xs text-muted-foreground">All tracked events</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.failedLogins}</div>
              <p className="text-xs text-muted-foreground">Authentication failures</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Actions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentActions}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High-Risk Actions</CardTitle>
              <Shield className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.highRiskActions}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="audit" className="space-y-4">
          <TabsList>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="security">Security Events</TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>
                  Complete history of all user actions and system changes
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No audit logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs">
                              {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getActionBadgeVariant(log.action_type)}>
                                {log.action_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{log.resource_type}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.user_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {log.resource_id && (
                                <span className="text-xs text-muted-foreground">
                                  ID: {log.resource_id.slice(0, 8)}...
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Events</CardTitle>
                <CardDescription>
                  Authentication attempts and security-related events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {securityEvents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No security events found
                          </TableCell>
                        </TableRow>
                      ) : (
                        securityEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-mono text-xs">
                              {format(new Date(event.created_at), "MMM dd, HH:mm:ss")}
                            </TableCell>
                            <TableCell>{event.event_type}</TableCell>
                            <TableCell>{event.email || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant={event.success ? "default" : "destructive"}>
                                {event.success ? "Success" : "Failed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {event.failure_reason || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
