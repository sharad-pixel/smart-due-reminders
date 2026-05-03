import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, ExternalLink, Clock, ShieldCheck, ShieldAlert, LogIn, UserPlus, X, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { setImpersonatedAccountId } from "@/lib/supportImpersonation";

interface AssignmentRow {
  id: string;
  support_user_id: string;
  notes: string | null;
  support_users: { email: string; name: string | null } | null;
}

interface GrantRow {
  id: string;
  account_id: string;
  granted_by: string;
  scope: string;
  reason: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  account_email?: string | null;
  account_name?: string | null;
  account_company?: string | null;
  assignments?: AssignmentRow[];
}

interface SupportUser { id: string; email: string; name: string | null; is_active: boolean }

const AdminSupportAccess = () => {
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignFor, setAssignFor] = useState<GrantRow | null>(null);
  const [selectedSupportUser, setSelectedSupportUser] = useState<string>("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const openWorkspace = (accountId: string) => {
    setImpersonatedAccountId(accountId);
    toast.success("Opening customer workspace…");
    navigate("/dashboard");
  };

  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("support_access_grants")
      .select("*")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load grants");
      setLoading(false);
      return;
    }

    const hydratedRows = await Promise.all(
      (rows || []).map(async (g: any) => {
        const { data: ownerInfoRows, error: ownerErr } = await supabase.rpc("get_owner_account_info", {
          p_account_id: g.account_id,
        });
        if (ownerErr) console.error("owner profile fetch error", ownerErr);
        const p = Array.isArray(ownerInfoRows) ? ownerInfoRows[0] : null;
        const { data: aData } = await supabase.functions.invoke("support-user-admin", {
          body: { action: "list_assignments", grant_id: g.id },
        });
        return {
          ...g,
          account_email: p?.email || `Account ${g.account_id.slice(0, 8)}…`,
          account_name: p?.name || null,
          account_company: p?.business_name || p?.company_name || null,
          assignments: (aData?.assignments ?? []) as AssignmentRow[],
        };
      })
    );
    setGrants(hydratedRows);
    setLoading(false);
  };

  const loadSupportUsers = async () => {
    const { data } = await supabase.functions.invoke("support-user-admin", { body: { action: "list" } });
    setSupportUsers((data?.users ?? []).filter((u: SupportUser) => u.is_active));
  };

  const assign = async () => {
    if (!assignFor || !selectedSupportUser) return;
    const { error } = await supabase.functions.invoke("support-user-admin", {
      body: { action: "assign", grant_id: assignFor.id, support_user_id: selectedSupportUser },
    });
    if (error) { toast.error("Failed to assign"); return; }
    toast.success("Support member assigned");
    setSelectedSupportUser("");
    setAssignFor(null);
    load();
  };

  const unassign = async (assignmentId: string) => {
    const { error } = await supabase.functions.invoke("support-user-admin", {
      body: { action: "unassign", id: assignmentId },
    });
    if (error) { toast.error("Failed to remove"); return; }
    toast.success("Removed");
    load();
  };

  useEffect(() => {
    load();
    loadSupportUsers();
  }, []);

  // Auto-open workspace when arriving from email button (?account=...&open=1)
  useEffect(() => {
    const accountParam = searchParams.get("account");
    const openParam = searchParams.get("open");
    if (!accountParam || openParam !== "1" || loading) return;
    const grant = grants.find((g) => g.account_id === accountParam);
    if (grant) openWorkspace(accountParam);
  }, [searchParams, grants, loading]);
  return (
    <AdminLayout title="Support Access">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Support Access Grants</h1>
            <p className="text-sm text-muted-foreground">
              Customers who have authorized the support team to access their workspace.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Grants</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${grants.length} active grant${grants.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {grants.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active support access grants right now.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Assigned support</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <div className="font-medium">
                          {g.account_company || g.account_name || g.account_email || `Account ${g.account_id.slice(0, 8)}…`}
                        </div>
                        <div className="text-xs text-muted-foreground">{g.account_email}</div>
                      </TableCell>
                      <TableCell>
                        {g.scope === "write" ? (
                          <Badge variant="default" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> Full
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> Read
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {g.assignments && g.assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {g.assignments.map((a) => (
                              <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                                <Users className="h-3 w-3" />
                                {a.support_users?.name || a.support_users?.email || "Unknown"}
                                <button
                                  onClick={() => unassign(a.id)}
                                  className="ml-1 rounded-full hover:bg-background/50 p-0.5"
                                  aria-label="Remove"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDistanceToNow(new Date(g.expires_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setAssignFor(g); setSelectedSupportUser(""); }}
                          >
                            <UserPlus className="h-3 w-3 mr-1" /> Assign
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openWorkspace(g.account_id)}
                          >
                            <LogIn className="h-3 w-3 mr-1" /> Open Workspace
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/users/${g.account_id}`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> Account
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSupportAccess;
