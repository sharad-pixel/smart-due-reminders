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

    const accountIds = Array.from(new Set((rows || []).map((g) => g.account_id)));
    let profileMap = new Map<string, any>();
    if (accountIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, company_name, business_name")
        .in("id", accountIds);
      profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    setGrants(
      (rows || []).map((g: any) => {
        const p = profileMap.get(g.account_id);
        return {
          ...g,
          account_email: p?.email,
          account_name: p?.name,
          account_company: p?.business_name || p?.company_name,
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
                        <div className="font-medium">{g.account_company || g.account_name || "—"}</div>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/users/${g.account_id}`)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" /> Open Account
                        </Button>
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
