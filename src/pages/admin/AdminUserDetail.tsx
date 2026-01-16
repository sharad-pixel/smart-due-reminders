import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  User,
  Building2,
  CreditCard,
  Receipt,
  Users,
  Crown,
  Clock,
  AlertCircle,
  CheckCircle,
  Ban,
  Mail,
  Phone,
  Calendar,
  Shield,
  Settings,
  Trash2,
  Save,
  RefreshCw,
  ExternalLink,
  FileText,
  Activity,
  UserMinus,
  UserPlus,
  Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format as formatDate } from "date-fns";

interface UserDetails {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  plan_type: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  invoice_limit: number | null;
  overage_rate: number | null;
  trial_ends_at: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  plans: {
    id: string;
    name: string;
    monthly_price: number;
    invoice_limit: number;
    overage_amount: number;
  } | null;
}

interface AccountRelationship {
  id: string;
  account_id: string;
  user_id: string | null;
  role: string;
  status: string;
  is_owner: boolean;
  email: string | null;
  accepted_at: string | null;
  invited_at: string;
  account_owner: {
    id: string;
    name: string | null;
    email: string;
    company_name: string | null;
  } | null;
}

interface TeamMember {
  id: string;
  user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  is_owner: boolean;
  accepted_at: string | null;
  profiles: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

interface UsageData {
  month: string;
  count: number;
}

interface AdminAction {
  id: string;
  action: string;
  action_type: string | null;
  details: any;
  created_at: string;
  admin_id: string;
}

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<UserDetails | null>(null);
  const [accountRelationships, setAccountRelationships] = useState<AccountRelationship[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Editable fields
  const [editedName, setEditedName] = useState("");
  const [editedCompany, setEditedCompany] = useState("");
  const [editedPlanType, setEditedPlanType] = useState("");
  const [editedInvoiceLimit, setEditedInvoiceLimit] = useState("");
  const [editedSubscriptionStatus, setEditedSubscriptionStatus] = useState("");
  const [editedTrialEndsAt, setEditedTrialEndsAt] = useState("");
  const [editedCurrentPeriodEnd, setEditedCurrentPeriodEnd] = useState("");
  
  // Dialogs
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
    }
  }, [userId]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        navigate("/login");
        return;
      }

      // Fetch user details via edge function
      const response = await supabase.functions.invoke("admin-get-user-details", {
        body: { userId },
      });

      if (response.error) throw response.error;
      
      const data = response.data;
      setUser(data.user);
      setAccountRelationships(data.accountRelationships || []);
      setTeamMembers(data.teamMembers || []);
      setUsageData(data.usageData || []);
      setAdminActions(data.adminActions || []);
      
      // Set editable fields
      if (data.user) {
        setEditedName(data.user.name || "");
        setEditedCompany(data.user.company_name || "");
        setEditedPlanType(data.user.plan_type || "free");
        setEditedInvoiceLimit(String(data.user.invoice_limit || 5));
        setEditedSubscriptionStatus(data.user.subscription_status || "inactive");
        setEditedTrialEndsAt(data.user.trial_ends_at ? data.user.trial_ends_at.slice(0, 10) : "");
        setEditedCurrentPeriodEnd(data.user.current_period_end ? data.user.current_period_end.slice(0, 10) : "");
      }
    } catch (error: any) {
      console.error("Error fetching user details:", error);
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "update_profile",
          updates: {
            name: editedName,
            company_name: editedCompany,
            plan_type: editedPlanType,
            invoice_limit: parseInt(editedInvoiceLimit) || 5,
            subscription_status: editedSubscriptionStatus,
            trial_ends_at: editedTrialEndsAt ? new Date(editedTrialEndsAt).toISOString() : null,
            current_period_end: editedCurrentPeriodEnd ? new Date(editedCurrentPeriodEnd).toISOString() : null,
          },
        },
      });

      if (response.error) throw response.error;
      
      toast.success("User updated successfully");
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    try {
      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "block_user",
          updates: { reason: blockReason },
        },
      });

      if (response.error) throw response.error;
      
      toast.success("User blocked successfully");
      setBlockDialogOpen(false);
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    try {
      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "unblock_user",
        },
      });

      if (response.error) throw response.error;
      
      toast.success("User unblocked successfully");
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    }
  };

  const handleSuspend = async () => {
    if (!user) return;
    try {
      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "suspend_user",
          updates: { reason: suspendReason },
        },
      });

      if (response.error) throw response.error;
      
      toast.success("User suspended successfully");
      setSuspendDialogOpen(false);
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error suspending user:", error);
      toast.error("Failed to suspend user");
    }
  };

  const handleUnsuspend = async () => {
    if (!user) return;
    try {
      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: user.id,
          action: "unsuspend_user",
        },
      });

      if (response.error) throw response.error;
      
      toast.success("User unsuspended successfully");
      fetchUserDetails();
    } catch (error: any) {
      console.error("Error unsuspending user:", error);
      toast.error("Failed to unsuspend user");
    }
  };

  const getStatusBadge = () => {
    if (!user) return null;
    if (user.is_blocked) {
      return <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Blocked</Badge>;
    }
    if (user.is_suspended) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Suspended</Badge>;
    }
    const status = user.subscription_status;
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  const getCurrentMonthUsage = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = usageData.find(u => u.month === currentMonth);
    return usage?.count || 0;
  };

  const getUsageLimit = () => {
    return user?.plans?.invoice_limit || user?.invoice_limit || 5;
  };

  if (loading) {
    return (
      <AdminLayout title="User Details">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout title="User Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">User not found</p>
          <Button variant="outline" onClick={() => navigate("/admin/user-management")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const usagePercentage = Math.min((getCurrentMonthUsage() / getUsageLimit()) * 100, 100);
  const isOwnerOfAccount = accountRelationships.some(r => r.is_owner);
  const belongsToAccounts = accountRelationships.filter(r => !r.is_owner);

  return (
    <AdminLayout title={`User: ${user.name || user.email}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/user-management")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{user.name || user.email}</h1>
                  {user.is_admin && (
                    <Badge variant="secondary">
                      <Crown className="h-3 w-3 mr-1" />
                      Platform Admin
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button variant="outline" onClick={fetchUserDetails}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="account">Account Relationships</TabsTrigger>
            <TabsTrigger value="billing">Billing & Usage</TabsTrigger>
            <TabsTrigger value="actions">Admin Actions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input 
                      value={editedName} 
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder="Enter name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input 
                      value={editedCompany} 
                      onChange={(e) => setEditedCompany(e.target.value)}
                      placeholder="Enter company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user.email} disabled className="bg-muted" />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created</span>
                      <p className="font-medium">
                        {formatDate(new Date(user.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Sign In</span>
                      <p className="font-medium">
                        {user.last_sign_in_at 
                          ? formatDate(new Date(user.last_sign_in_at), "MMM d, yyyy")
                          : "Never"
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Plan Type</Label>
                    <Select value={editedPlanType} onValueChange={setEditedPlanType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Subscription Status</Label>
                    <Select value={editedSubscriptionStatus} onValueChange={setEditedSubscriptionStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="trialing">Trialing</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="past_due">Past Due</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Invoice Limit</Label>
                    <Input 
                      type="number"
                      value={editedInvoiceLimit} 
                      onChange={(e) => setEditedInvoiceLimit(e.target.value)}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>Trial Ends At</Label>
                    <Input 
                      type="date"
                      value={editedTrialEndsAt} 
                      onChange={(e) => setEditedTrialEndsAt(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                    <p className="text-xs text-muted-foreground">
                      Set or extend the trial period. Leave empty for no trial.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Current Period End</Label>
                    <Input 
                      type="date"
                      value={editedCurrentPeriodEnd} 
                      onChange={(e) => setEditedCurrentPeriodEnd(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                    <p className="text-xs text-muted-foreground">
                      Extend the subscription period without Stripe changes.
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Usage</span>
                      <span>{getCurrentMonthUsage()} / {getUsageLimit()}</span>
                    </div>
                    <Progress value={usagePercentage} />
                  </div>
                  
                  {user.stripe_customer_id && (
                    <div className="pt-2">
                      <a 
                        href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View in Stripe
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSaveChanges} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                  
                  {user.is_blocked ? (
                    <Button variant="outline" onClick={handleUnblock}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Unblock User
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={() => setBlockDialogOpen(true)}>
                      <Ban className="h-4 w-4 mr-2" />
                      Block User
                    </Button>
                  )}
                  
                  {user.is_suspended ? (
                    <Button variant="outline" onClick={handleUnsuspend}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Unsuspend
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => setSuspendDialogOpen(true)}>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Suspend Account
                    </Button>
                  )}
                </div>
                
                {user.is_blocked && user.blocked_at && (
                  <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <p className="text-sm font-medium text-red-600">
                      Blocked on {formatDate(new Date(user.blocked_at), "MMM d, yyyy")}
                    </p>
                    {user.blocked_reason && (
                      <p className="text-sm text-muted-foreground mt-1">{user.blocked_reason}</p>
                    )}
                  </div>
                )}
                
                {user.is_suspended && user.suspended_at && (
                  <div className="mt-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <p className="text-sm font-medium text-orange-600">
                      Suspended on {formatDate(new Date(user.suspended_at), "MMM d, yyyy")}
                    </p>
                    {user.suspended_reason && (
                      <p className="text-sm text-muted-foreground mt-1">{user.suspended_reason}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Relationships Tab */}
          <TabsContent value="account" className="space-y-6">
            {/* Owns These Accounts */}
            {isOwnerOfAccount && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    Account Owner
                  </CardTitle>
                  <CardDescription>
                    This user owns their own account and can have team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamMembers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  {member.profiles?.avatar_url && (
                                    <AvatarImage src={member.profiles.avatar_url} />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {member.profiles?.name?.charAt(0) || member.email?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {member.profiles?.name || member.email || "Pending"}
                                    {member.is_owner && (
                                      <Badge variant="secondary" className="ml-2 text-xs">Owner</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {member.profiles?.email || member.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">{member.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {member.status === 'active' ? (
                                <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                              ) : (
                                <Badge variant="secondary">{member.status}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {member.accepted_at 
                                ? formatDate(new Date(member.accepted_at), "MMM d, yyyy")
                                : "—"
                              }
                            </TableCell>
                            <TableCell>
                              {member.user_id && member.user_id !== userId && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => navigate(`/admin/users/${member.user_id}`)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No team members</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Belongs To Other Accounts */}
            {belongsToAccounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Member Of
                  </CardTitle>
                  <CardDescription>
                    This user is a team member of these accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Owner</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {belongsToAccounts.map((rel) => (
                        <TableRow key={rel.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {rel.account_owner?.name?.charAt(0) || rel.account_owner?.email?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {rel.account_owner?.name || rel.account_owner?.email}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {rel.account_owner?.company_name || rel.account_owner?.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{rel.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {rel.status === 'active' ? (
                              <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                            ) : (
                              <Badge variant="secondary">{rel.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {rel.accepted_at 
                              ? formatDate(new Date(rel.accepted_at), "MMM d, yyyy")
                              : "—"
                            }
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/admin/users/${rel.account_id}`)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {!isOwnerOfAccount && belongsToAccounts.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No account relationships found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">
                    {user.plans?.name || user.plan_type || "Free"}
                  </div>
                  {user.billing_interval && (
                    <p className="text-sm text-muted-foreground capitalize">{user.billing_interval}</p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {getCurrentMonthUsage()} / {getUsageLimit()}
                  </div>
                  <Progress value={usagePercentage} className="mt-2" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Next Renewal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {user.current_period_end 
                      ? formatDate(new Date(user.current_period_end), "MMM d, yyyy")
                      : "—"
                    }
                  </div>
                  {user.cancel_at_period_end && (
                    <p className="text-sm text-orange-500">Canceling at period end</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Usage History</CardTitle>
              </CardHeader>
              <CardContent>
                {usageData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Invoices Processed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageData.slice(0, 12).map((usage) => (
                        <TableRow key={usage.month}>
                          <TableCell>{usage.month}</TableCell>
                          <TableCell>{usage.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No usage data</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Actions Tab */}
          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Admin Action History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adminActions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminActions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell>
                            {formatDate(new Date(action.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{action.action}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{action.action_type || "—"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {action.details ? JSON.stringify(action.details) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No admin actions recorded</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Block Dialog */}
      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently block the user from accessing the platform. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason (optional)</Label>
            <Input 
              value={blockReason} 
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Enter reason for blocking"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlock} className="bg-red-600 hover:bg-red-700">
              Block User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Dialog */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will temporarily suspend the user's account. They will not be able to access features until unsuspended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason (optional)</Label>
            <Input 
              value={suspendReason} 
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter reason for suspension"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} className="bg-orange-600 hover:bg-orange-700">
              Suspend Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUserDetail;
