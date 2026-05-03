import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LifeBuoy, ExternalLink, Clock, ShieldCheck, ShieldAlert, LogIn } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { setImpersonatedAccountId } from "@/lib/supportImpersonation";

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
}

const AdminSupportAccess = () => {
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
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
        return {
          ...g,
          account_email: p?.email || `Account ${g.account_id.slice(0, 8)}…`,
          account_name: p?.name || null,
          account_company: p?.business_name || p?.company_name || null,
        };
      })
    );
    setGrants(hydratedRows);
    setLoading(false);
  };

  useEffect(() => {
    load();
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
                    <TableHead>Reason</TableHead>
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
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {g.reason || "—"}
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
