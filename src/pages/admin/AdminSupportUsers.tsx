import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LifeBuoy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface SupportUser {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const AdminSupportUsers = () => {
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("support-user-admin", {
      body: { action: "list" },
    });
    if (error) toast.error("Failed to load support users");
    else setUsers(data?.users ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("support-user-admin", {
      body: { action: "create", email: email.trim(), name: name.trim() || null },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message || "Failed to add"); return; }
    toast.success("Support user added");
    setEmail(""); setName("");
    load();
  };

  const toggle = async (u: SupportUser) => {
    const { error } = await supabase.functions.invoke("support-user-admin", {
      body: { action: "toggle", id: u.id, is_active: !u.is_active },
    });
    if (error) toast.error("Failed"); else load();
  };

  const remove = async (u: SupportUser) => {
    if (!confirm(`Remove support access for ${u.email}?`)) return;
    const { error } = await supabase.functions.invoke("support-user-admin", {
      body: { action: "delete", id: u.id },
    });
    if (error) toast.error("Failed to remove"); else { toast.success("Removed"); load(); }
  };

  return (
    <AdminLayout title="Support Users">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><LifeBuoy className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Support Users</h1>
            <p className="text-sm text-muted-foreground">
              Recouply support team members allowed to log in via email + 6-digit code.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Support User</CardTitle>
            <CardDescription>They can sign in at <code>/support/login</code> with this email.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="email@recouply.ai" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
              <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
              <Button onClick={add} disabled={submitting || !email}><Plus className="h-4 w-4 mr-1" />Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Support Users</CardTitle>
            <CardDescription>{loading ? "Loading…" : `${users.length} total`}</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No support users yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.name || "—"}</TableCell>
                      <TableCell>
                        {u.is_active
                          ? <Badge variant="default">Active</Badge>
                          : <Badge variant="secondary">Disabled</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => toggle(u)}>
                          {u.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(u)}>
                          <Trash2 className="h-4 w-4" />
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

export default AdminSupportUsers;
