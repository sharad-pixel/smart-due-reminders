import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  UserX,
  UserCheck,
  Shield,
  ShieldOff,
  Loader2,
  Download,
  Eye,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal,
  FileText,
  Building2,
  Calendar,
  Mail,
  DollarSign,
  BarChart3,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Ban,
  UserPlus,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format as formatDate, differenceInDays, subDays } from "date-fns";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  plan_type: string | null;
  plan_id: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  suspended_by: string | null;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plans: {
    name: string;
    monthly_price: number;
    invoice_limit: number;
  } | null;
  // Extended stats
  invoice_count?: number;
  debtor_count?: number;
  last_login?: string | null;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  paidUsers: number;
  freeUsers: number;
  recentSignups7d: number;
  recentSignups30d: number;
}

interface UserDetailData {
  profile: UserProfile;
  overrides: any[];
  actions: any[];
  stats: {
    invoice_count: number;
    debtor_count: number;
    usage_history: any[];
  };
}

const AdminUserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userDetailData, setUserDetailData] = useState<UserDetailData | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage, filterStatus, filterPlan]);

  const fetchStats = async () => {
    try {
      const sevenDaysAgo = subDays(new Date(), 7);
      const thirtyDaysAgo = subDays(new Date(), 30);

      const [
        { count: total },
        { count: suspended },
        { count: admins },
        { count: recent7d },
        { count: recent30d },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_suspended", true),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_admin", true),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
      ]);

      // Count paid vs free (based on stripe_subscription_id presence)
      const { count: paid } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("stripe_subscription_id", "is", null);

      setStats({
        totalUsers: total || 0,
        activeUsers: (total || 0) - (suspended || 0),
        suspendedUsers: suspended || 0,
        adminUsers: admins || 0,
        paidUsers: paid || 0,
        freeUsers: (total || 0) - (paid || 0),
        recentSignups7d: recent7d || 0,
        recentSignups30d: recent30d || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-list-users", {
        body: {
          search,
          limit: pageSize,
          offset: currentPage * pageSize,
        },
      });

      if (response.error) throw response.error;

      let filteredUsers = response.data?.users || [];

      // Apply local filters
      if (filterStatus !== "all") {
        if (filterStatus === "active") {
          filteredUsers = filteredUsers.filter((u: UserProfile) => !u.is_suspended && !u.is_blocked);
        } else if (filterStatus === "suspended") {
          filteredUsers = filteredUsers.filter((u: UserProfile) => u.is_suspended);
        } else if (filterStatus === "blocked") {
          filteredUsers = filteredUsers.filter((u: UserProfile) => u.is_blocked);
        } else if (filterStatus === "admin") {
          filteredUsers = filteredUsers.filter((u: UserProfile) => u.is_admin);
        }
      }

      if (filterPlan !== "all") {
        if (filterPlan === "paid") {
          filteredUsers = filteredUsers.filter((u: UserProfile) => u.stripe_subscription_id);
        } else if (filterPlan === "free") {
          filteredUsers = filteredUsers.filter((u: UserProfile) => !u.stripe_subscription_id);
        }
      }

      setUsers(filteredUsers);
      setTotalUsers(response.data?.total || 0);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-get-user-details", {
        body: { userId },
      });

      if (error) throw error;
      setUserDetailData(data);
    } catch (error) {
      console.error("Error fetching user details:", error);
      toast.error("Failed to load user details");
    }
  };

  const handleViewDetails = async (user: UserProfile) => {
    setSelectedUser(user);
    setDetailDialogOpen(true);
    await fetchUserDetails(user.id);
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
      await fetchUsers();
      await fetchStats();
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
      await fetchUsers();
      await fetchStats();
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
      await fetchUsers();
      await fetchStats();
    } catch (error: any) {
      console.error("Error toggling admin:", error);
      toast.error("Failed to update admin status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (user: UserProfile) => {
    setSelectedUser(user);
    setDeleteConfirmEmail("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || deleteConfirmEmail !== selectedUser.email) return;

    setActionLoading(selectedUser.id);
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: selectedUser.id },
      });

      if (error) throw error;

      toast.success(`User ${selectedUser.email} and all related data have been deleted`);
      setDeleteDialogOpen(false);
      await fetchUsers();
      await fetchStats();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockClick = (user: UserProfile) => {
    setSelectedUser(user);
    setBlockReason("");
    setBlockDialogOpen(true);
  };

  const handleBlock = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser.id);
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: selectedUser.id,
          action: "block_user",
          updates: { reason: blockReason },
        },
      });

      if (error) throw error;

      toast.success(`User ${selectedUser.email} has been blocked and cannot re-register`);
      setBlockDialogOpen(false);
      await fetchUsers();
      await fetchStats();
    } catch (error: any) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (user: UserProfile) => {
    setActionLoading(user.id);
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "unblock_user",
        },
      });

      if (error) throw error;

      toast.success(`User ${user.email} has been unblocked`);
      await fetchUsers();
      await fetchStats();
    } catch (error: any) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = () => {
    setCurrentPage(0);
    fetchUsers();
  };

  const exportUsers = async (format: "csv" | "json") => {
    try {
      // Fetch all users for export
      const response = await supabase.functions.invoke("admin-list-users", {
        body: { limit: 10000 },
      });

      if (response.error) throw response.error;

      const allUsers = response.data?.users || [];

      if (format === "csv") {
        const headers = [
          "ID",
          "Email",
          "Name",
          "Company",
          "Plan",
          "Status",
          "Is Admin",
          "Created At",
          "Stripe Customer ID",
        ];
        const csvRows = [
          headers.join(","),
          ...allUsers.map((u: UserProfile) =>
            [
              u.id,
              `"${u.email}"`,
              `"${u.name || ""}"`,
              `"${u.company_name || ""}"`,
              u.plans?.name || "Free",
              u.is_suspended ? "Suspended" : "Active",
              u.is_admin ? "Yes" : "No",
              new Date(u.created_at).toISOString(),
              u.stripe_customer_id || "",
            ].join(",")
          ),
        ];

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recouply-users-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(allUsers, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recouply-users-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`Users exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export users");
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active", value: stats?.activeUsers || 0, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Suspended", value: stats?.suspendedUsers || 0, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Admins", value: stats?.adminUsers || 0, icon: Shield, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Paid", value: stats?.paidUsers || 0, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Free", value: stats?.freeUsers || 0, icon: Users, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "7-Day Signups", value: stats?.recentSignups7d || 0, icon: TrendingUp, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "30-Day Signups", value: stats?.recentSignups30d || 0, icon: Calendar, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <AdminLayout title="User Management" description="Complete user data analysis, management, and exports">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-2`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Users
              </CardTitle>
              <CardDescription>
                Manage platform users, view details, and export data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchUsers()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportUsers("csv")}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportUsers("json")}>
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="free">Free</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Stripe ID</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow
                          key={user.id}
                          className={user.is_suspended ? "bg-destructive/5" : ""}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {user.name || "—"}
                                {user.is_admin && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {user.company_name || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.stripe_subscription_id ? "default" : "outline"}>
                              {user.plans?.name || "Free"}
                            </Badge>
                            {user.plans?.monthly_price && (
                              <div className="text-xs text-muted-foreground mt-1">
                                ${user.plans.monthly_price}/mo
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.is_blocked ? (
                              <div>
                                <Badge variant="destructive" className="bg-red-900">
                                  <Ban className="h-3 w-3 mr-1" />
                                  Blocked
                                </Badge>
                                {user.blocked_at && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {formatDate(new Date(user.blocked_at), "MMM d, yyyy")}
                                  </div>
                                )}
                              </div>
                            ) : user.is_suspended ? (
                              <div>
                                <Badge variant="destructive">Suspended</Badge>
                                {user.suspended_at && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {formatDate(new Date(user.suspended_at), "MMM d, yyyy")}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="border-green-500 text-green-600">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(new Date(user.created_at), "MMM d, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {differenceInDays(new Date(), new Date(user.created_at))} days ago
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.stripe_customer_id ? (
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {user.stripe_customer_id.slice(0, 14)}...
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.is_suspended ? (
                                  <DropdownMenuItem
                                    onClick={() => handleUnsuspend(user)}
                                    disabled={actionLoading === user.id}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Unsuspend User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleSuspendClick(user)}
                                    disabled={actionLoading === user.id}
                                    className="text-destructive"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Suspend User
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleToggleAdmin(user)}
                                  disabled={actionLoading === user.id}
                                >
                                  {user.is_admin ? (
                                    <>
                                      <ShieldOff className="h-4 w-4 mr-2" />
                                      Remove Admin
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4 mr-2" />
                                      Make Admin
                                    </>
                                  )}
                                </DropdownMenuItem>
                                {/* Block/Unblock Actions */}
                                {user.is_blocked ? (
                                  <DropdownMenuItem
                                    onClick={() => handleUnblock(user)}
                                    disabled={actionLoading === user.id}
                                  >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Unblock User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleBlockClick(user)}
                                    disabled={actionLoading === user.id}
                                    className="text-destructive"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Block User (Permanent)
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(user)}
                                  disabled={actionLoading === user.id}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {currentPage * pageSize + 1} to{" "}
                  {Math.min((currentPage + 1) * pageSize, totalUsers)} of {totalUsers} users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
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

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Block User Permanently
            </DialogTitle>
            <DialogDescription>
              This will add {selectedUser?.email} to the blocked list. They will not be able to:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Access the platform</li>
                <li>Re-register with this email address</li>
                <li>Sign in with OAuth providers (Google, etc.)</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">Reason for blocking (optional)</Label>
              <Textarea
                id="blockReason"
                placeholder="Enter reason for blocking..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={actionLoading === selectedUser?.id}
            >
              {actionLoading === selectedUser?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Block User Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              User Details
            </DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <Tabs defaultValue="profile" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">User ID</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">{selectedUser.id}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm">{selectedUser.email}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="text-sm">{selectedUser.name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Company</Label>
                    <p className="text-sm">{selectedUser.company_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <p className="text-sm">{formatDate(new Date(selectedUser.created_at), "PPpp")}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="flex gap-2">
                      {selectedUser.is_suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Active
                        </Badge>
                      )}
                      {selectedUser.is_admin && <Badge variant="secondary">Admin</Badge>}
                    </div>
                  </div>
                </div>

                {selectedUser.is_suspended && selectedUser.suspended_reason && (
                  <div className="p-4 bg-destructive/10 rounded-lg">
                    <Label className="text-xs text-destructive">Suspension Reason</Label>
                    <p className="text-sm mt-1">{selectedUser.suspended_reason}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Suspended on {formatDate(new Date(selectedUser.suspended_at!), "PPpp")}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="usage" className="space-y-4 mt-4">
                {userDetailData ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-purple-500" />
                          <span className="text-sm text-muted-foreground">Invoices</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {userDetailData.stats.invoice_count.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-muted-foreground">Accounts</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {userDetailData.stats.debtor_count.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {userDetailData?.stats.usage_history && userDetailData.stats.usage_history.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Monthly Usage History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Invoices Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userDetailData.stats.usage_history.map((usage: any) => (
                            <TableRow key={usage.month}>
                              <TableCell>{formatDate(new Date(usage.month), "MMM yyyy")}</TableCell>
                              <TableCell>{usage.invoices_created}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="billing" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Plan</Label>
                    <p className="text-sm font-medium">{selectedUser.plans?.name || "Free"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Monthly Price</Label>
                    <p className="text-sm">
                      {selectedUser.plans?.monthly_price
                        ? `$${selectedUser.plans.monthly_price}`
                        : "$0"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Invoice Limit</Label>
                    <p className="text-sm">
                      {selectedUser.plans?.invoice_limit || 15} invoices/mo
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Stripe Customer ID</Label>
                    <p className="text-sm font-mono text-xs">
                      {selectedUser.stripe_customer_id || "—"}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">Stripe Subscription ID</Label>
                    <p className="text-sm font-mono text-xs">
                      {selectedUser.stripe_subscription_id || "—"}
                    </p>
                  </div>
                  {selectedUser.trial_ends_at && (
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-muted-foreground">Trial Ends</Label>
                      <p className="text-sm">
                        {formatDate(new Date(selectedUser.trial_ends_at), "PPpp")}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4 mt-4">
                {userDetailData?.actions && userDetailData.actions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userDetailData.actions.map((action: any) => (
                        <TableRow key={action.id}>
                          <TableCell>{action.action}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{action.action_type || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {action.admin?.email || "System"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(new Date(action.created_at), "MMM d, h:mm a")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No admin actions recorded for this user
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Permanently
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>{selectedUser?.email}</strong> and all associated data including:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All invoices and payment records</li>
              <li>All accounts/debtors</li>
              <li>All documents and files</li>
              <li>All collection activities and tasks</li>
              <li>All AI drafts and workflows</li>
              <li>Team memberships and settings</li>
              <li>Branding and organization data</li>
            </ul>
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm font-medium mb-2">
                To confirm, type the user's email address:
              </p>
              <Input
                placeholder={selectedUser?.email}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={actionLoading === selectedUser?.id || deleteConfirmEmail !== selectedUser?.email}
            >
              {actionLoading === selectedUser?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete User Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUserManagement;
