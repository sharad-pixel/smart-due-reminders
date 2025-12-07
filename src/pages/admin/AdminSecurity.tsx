import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, Lock, Eye } from "lucide-react";
import { format } from "date-fns";

const AdminSecurity = () => {
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [suspendedUsers, setSuspendedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [{ data: attempts }, { data: events }, { data: suspended }] = await Promise.all([
        supabase
          .from("login_attempts")
          .select("*")
          .order("attempt_time", { ascending: false })
          .limit(50),
        supabase
          .from("security_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("profiles")
          .select("id, email, name, suspended_at, suspended_reason")
          .eq("is_suspended", true),
      ]);

      setLoginAttempts(attempts || []);
      setSecurityEvents(events || []);
      setSuspendedUsers(suspended || []);
    } catch (error) {
      console.error("Error fetching security data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Security Center" description="Monitor security events and access attempts">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed Login Attempts (24h)</p>
                <p className="text-2xl font-bold">
                  {loginAttempts.filter((a) => !a.success).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suspended Accounts</p>
                <p className="text-2xl font-bold">{suspendedUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Security Events</p>
                <p className="text-2xl font-bold">{securityEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Login Attempts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Recent Login Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : loginAttempts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No login attempts recorded</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginAttempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-mono text-xs">
                          {attempt.email?.slice(0, 20)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={attempt.success ? "default" : "destructive"}>
                            {attempt.success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(attempt.attempt_time), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suspended Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Suspended Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : suspendedUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No suspended accounts</p>
            ) : (
              <div className="space-y-3">
                {suspendedUsers.map((user) => (
                  <div key={user.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant="destructive">Suspended</Badge>
                    </div>
                    {user.suspended_reason && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Reason: {user.suspended_reason}
                      </p>
                    )}
                    {user.suspended_at && (
                      <p className="text-xs text-muted-foreground">
                        Since: {format(new Date(user.suspended_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSecurity;
