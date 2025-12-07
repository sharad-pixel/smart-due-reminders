import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, UserX, UserCheck, Shield, ShieldOff, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  plan_type: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  suspended_by: string | null;
  created_at: string;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndFetchUsers();
  }, []);

  const checkAdminAndFetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();

      if (!profile?.is_admin) {
        toast.error("Access denied: Admin privileges required");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await fetchUsers();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/dashboard");
    }
  };

  const fetchUsers = async (searchTerm = "") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: null,
        method: "GET",
      });

      // Use query params via headers workaround or fetch all
      const response = await supabase.functions.invoke("admin-list-users");
      
      if (response.error) throw response.error;
      
      let filteredUsers = response.data?.users || [];
      
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredUsers = filteredUsers.filter((u: UserProfile) =>
          u.email?.toLowerCase().includes(lowerSearch) ||
          u.name?.toLowerCase().includes(lowerSearch) ||
          u.company_name?.toLowerCase().includes(lowerSearch)
        );
      }
      
      setUsers(filteredUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendClick = (user: UserProfile) => {
    setSelectedUser(user);
    setSuspendReason("");
    setSuspendDialogOpen(true);
  };

  const handleSuspend = async () => {
    if (!selectedUser) return;
    
    setActionLoading(selectedUser.id);
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: selectedUser.id,
          action: "suspend_user",
          updates: { reason: suspendReason },
        },
      });

      if (error) throw error;

      toast.success(`User ${selectedUser.email} has been suspended`);
      setSuspendDialogOpen(false);
      await fetchUsers(search);
    } catch (error: any) {
      console.error("Error suspending user:", error);
      toast.error("Failed to suspend user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (user: UserProfile) => {
    setActionLoading(user.id);
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "unsuspend_user",
        },
      });

      if (error) throw error;

      toast.success(`User ${user.email} has been unsuspended`);
      await fetchUsers(search);
    } catch (error: any) {
      console.error("Error unsuspending user:", error);
      toast.error("Failed to unsuspend user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (user: UserProfile) => {
    setActionLoading(user.id);
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "toggle_admin",
        },
      });

      if (error) throw error;

      toast.success(`Admin status updated for ${user.email}`);
      await fetchUsers(search);
    } catch (error: any) {
      console.error("Error toggling admin:", error);
      toast.error("Failed to update admin status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = () => {
    fetchUsers(search);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id} className={user.is_suspended ? "bg-destructive/5" : ""}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.name || "—"}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{user.company_name || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {user.is_suspended ? (
                                <Badge variant="destructive">Suspended</Badge>
                              ) : (
                                <Badge variant="outline" className="border-green-500 text-green-600">Active</Badge>
                              )}
                              {user.is_admin && (
                                <Badge variant="secondary">Admin</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.plan_type || "free"}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {user.is_suspended ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnsuspend(user)}
                                  disabled={actionLoading === user.id}
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4 mr-1" />
                                      Unsuspend
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuspendClick(user)}
                                  disabled={actionLoading === user.id}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserX className="h-4 w-4 mr-1" />
                                      Suspend
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleAdmin(user)}
                                disabled={actionLoading === user.id}
                                title={user.is_admin ? "Remove admin" : "Make admin"}
                              >
                                {user.is_admin ? (
                                  <ShieldOff className="h-4 w-4" />
                                ) : (
                                  <Shield className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suspend Dialog */}
        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspend User</DialogTitle>
              <DialogDescription>
                This will prevent {selectedUser?.email} from accessing the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for suspension (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for suspension..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSuspend}
                disabled={actionLoading === selectedUser?.id}
              >
                {actionLoading === selectedUser?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Suspend User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminUsers;
