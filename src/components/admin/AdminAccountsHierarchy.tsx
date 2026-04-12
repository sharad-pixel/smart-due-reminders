import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Loader2, Users, ChevronDown, ChevronRight, Building2, CreditCard, UserPlus, Crown, Clock, AlertCircle, CheckCircle, Ban, GitMerge, ArrowRightLeft, Shield, Trash2, MoreHorizontal, UserCog } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format as formatDate } from "date-fns";

interface TeamMember {
  id: string;
  user_id: string | null;
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

interface AccountData {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  plan_type: string | null;
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
  is_blocked: boolean;
  blocked_at: string | null;
  created_at: string;
  invoice_count: number;
  current_month_usage: number;
  team_member_count: number;
  team_members: TeamMember[];
  plans: {
    id: string;
    name: string;
    monthly_price: number;
    annual_price: number;
    invoice_limit: number;
    overage_amount: number;
  } | null;
}

const AdminAccountsHierarchy = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const pageSize = 15;

  // Dialog states
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; sourceAccount: AccountData | null }>({ open: false, sourceAccount: null });
  const [assignParentDialog, setAssignParentDialog] = useState<{ open: boolean; childAccount: AccountData | null }>({ open: false, childAccount: null });
  const [changeRoleDialog, setChangeRoleDialog] = useState<{ open: boolean; member: TeamMember | null; accountId: string }>({ open: false, member: null, accountId: '' });
  const [transferOwnerDialog, setTransferOwnerDialog] = useState<{ open: boolean; account: AccountData | null }>({ open: false, account: null });
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [targetAccountSearch, setTargetAccountSearch] = useState("");
  const [targetAccounts, setTargetAccounts] = useState<AccountData[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [currentPage]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-list-accounts", {
        body: { search, limit: pageSize, offset: currentPage * pageSize },
      });
      if (response.error) throw response.error;
      setAccounts(response.data?.accounts || []);
      setTotalAccounts(response.data?.total || 0);
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(0);
    fetchAccounts();
  };

  const toggleExpand = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) newExpanded.delete(accountId);
    else newExpanded.add(accountId);
    setExpandedAccounts(newExpanded);
  };

  const searchTargetAccounts = async (query: string) => {
    setTargetAccountSearch(query);
    if (query.length < 2) { setTargetAccounts([]); return; }
    const response = await supabase.functions.invoke("admin-list-accounts", {
      body: { search: query, limit: 10, offset: 0 },
    });
    setTargetAccounts(response.data?.accounts || []);
  };

  const handleMergeAccounts = async () => {
    if (!mergeDialog.sourceAccount || !selectedTargetId) return;
    setActionLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: {
          action: 'merge_accounts',
          sourceAccountId: mergeDialog.sourceAccount.id,
          targetAccountId: selectedTargetId,
        },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success(response.data?.message || "Accounts merged successfully");
      setMergeDialog({ open: false, sourceAccount: null });
      setSelectedTargetId("");
      setTargetAccountSearch("");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to merge accounts");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignParent = async () => {
    if (!assignParentDialog.childAccount || !selectedTargetId) return;
    setActionLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: {
          action: 'assign_parent',
          childUserId: assignParentDialog.childAccount.id,
          parentAccountId: selectedTargetId,
          role: selectedRole,
        },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success(response.data?.message || "Parent assigned successfully");
      setAssignParentDialog({ open: false, childAccount: null });
      setSelectedTargetId("");
      setSelectedRole("member");
      setTargetAccountSearch("");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign parent");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!changeRoleDialog.member) return;
    setActionLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: {
          action: 'change_role',
          membershipId: changeRoleDialog.member.id,
          newRole: selectedRole,
        },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success(response.data?.message || "Role updated");
      setChangeRoleDialog({ open: false, member: null, accountId: '' });
      setSelectedRole("member");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to change role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromParent = async (membershipId: string) => {
    if (!confirm("Remove this user from the parent account? They will become a standalone account.")) return;
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: { action: 'remove_from_parent', membershipId },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success("User removed from parent account");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove user");
    }
  };

  const handleDisableUser = async (accountId: string, userId: string, userName: string) => {
    if (!confirm(`Disable user "${userName}"? They will lose access to this account until re-enabled.`)) return;
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: { action: 'disable_user', accountId, userId },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success(response.data?.message || "User disabled");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to disable user");
    }
  };

  const handleEnableUser = async (accountId: string, userId: string, userName: string) => {
    if (!confirm(`Re-enable user "${userName}"?`)) return;
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: { action: 'enable_user', accountId, userId },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success(response.data?.message || "User re-enabled");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to enable user");
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferOwnerDialog.account || !selectedNewOwnerId) return;
    setActionLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-manage-accounts", {
        body: {
          action: 'transfer_ownership',
          accountId: transferOwnerDialog.account.id,
          newOwnerId: selectedNewOwnerId,
        },
      });
      if (response.error) throw new Error(response.data?.error || response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast.success(response.data?.message || "Ownership transferred successfully");
      setTransferOwnerDialog({ open: false, account: null });
      setSelectedNewOwnerId("");
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Failed to transfer ownership");
    } finally {
      setActionLoading(false);
    }
  };

  const getSubscriptionBadge = (account: AccountData) => {
    if (account.is_blocked) return <Badge variant="destructive" className="bg-red-900"><Ban className="h-3 w-3 mr-1" />Blocked</Badge>;
    if (account.is_suspended) return <Badge variant="destructive">Suspended</Badge>;
    const status = account.subscription_status;
    switch (status) {
      case 'active': return <Badge className="bg-green-500/10 text-green-600 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due': return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled': return <Badge variant="secondary">Canceled</Badge>;
      default: return <Badge variant="outline">Free</Badge>;
    }
  };

  const getUsageProgress = (account: AccountData) => {
    const limit = account.plans?.invoice_limit || account.invoice_limit || 5;
    const used = account.current_month_usage || 0;
    const percentage = Math.min((used / limit) * 100, 100);
    return { used, limit, percentage };
  };

  const totalPages = Math.ceil(totalAccounts / pageSize);

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Account Hierarchy Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage accounts, merge data, assign parent-child relationships, and change roles
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex gap-3 mb-4">
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
            <div className="space-y-3">
              {accounts.map((account) => {
                const isExpanded = expandedAccounts.has(account.id);
                const usage = getUsageProgress(account);

                return (
                  <Collapsible key={account.id} open={isExpanded} onOpenChange={() => toggleExpand(account.id)}>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-4 p-4 hover:bg-muted/50">
                        <CollapsibleTrigger asChild>
                          <div className="flex-shrink-0 cursor-pointer">
                            {account.team_member_count > 0 ? (
                              isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            ) : <div className="w-5" />}
                          </div>
                        </CollapsibleTrigger>

                        <div
                          className="flex items-center gap-4 flex-1 cursor-pointer"
                          onClick={() => navigate(`/admin/users/${account.id}`)}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {account.name?.charAt(0) || account.email?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate hover:underline">{account.name || account.email}</span>
                              {account.is_admin && (
                                <Badge variant="secondary" className="text-xs">
                                  <Crown className="h-3 w-3 mr-1" />Admin
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="truncate">{account.email}</span>
                              {account.company_name && <><span>•</span><span className="truncate">{account.company_name}</span></>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 flex-shrink-0">
                          <div className="text-center min-w-[80px]">
                            <Badge variant="outline">{account.plans?.name || account.plan_type || "Free"}</Badge>
                            {account.billing_interval && <div className="text-xs text-muted-foreground mt-1">{account.billing_interval}</div>}
                          </div>
                          <div className="text-center min-w-[80px]">{getSubscriptionBadge(account)}</div>
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Usage</span>
                              <span>{usage.used}/{usage.limit}</span>
                            </div>
                            <Progress value={usage.percentage} className="h-2" />
                          </div>
                          <div className="flex items-center gap-1 min-w-[60px]">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{account.team_member_count + 1}</span>
                          </div>
                          <div className="min-w-[100px] text-right">
                            {account.stripe_customer_id ? (
                              <div className="flex items-center justify-end gap-1">
                                <CreditCard className="h-4 w-4 text-green-500" />
                                <span className="text-xs text-muted-foreground">{account.stripe_customer_id.slice(0, 10)}...</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">No billing</span>}
                            {account.current_period_end && <div className="text-xs text-muted-foreground">Renews {formatDate(new Date(account.current_period_end), "MMM d")}</div>}
                          </div>

                          {/* Admin Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setMergeDialog({ open: true, sourceAccount: account });
                                setSelectedTargetId("");
                                setTargetAccountSearch("");
                                setTargetAccounts([]);
                              }}>
                                <GitMerge className="h-4 w-4 mr-2" />
                                Merge Into Another Account
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setAssignParentDialog({ open: true, childAccount: account });
                                setSelectedTargetId("");
                                setSelectedRole("member");
                                setTargetAccountSearch("");
                                setTargetAccounts([]);
                              }}>
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Assign to Parent Account
                              </DropdownMenuItem>
                              {account.team_members.filter(m => !m.is_owner && m.status === 'active').length > 0 && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setTransferOwnerDialog({ open: true, account });
                                  setSelectedNewOwnerId("");
                                }}>
                                  <UserCog className="h-4 w-4 mr-2" />
                                  Transfer Ownership
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {/* Disable/Enable the owner account */}
                              {account.team_members.find(m => m.is_owner && m.status === 'active' && m.user_id) && (
                                <DropdownMenuItem
                                  className="text-amber-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const owner = account.team_members.find(m => m.is_owner);
                                    if (owner?.user_id) {
                                      handleDisableUser(account.id, owner.user_id, account.name || account.email);
                                    }
                                  }}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Disable Owner
                                </DropdownMenuItem>
                              )}
                              {account.team_members.find(m => m.is_owner && m.status === 'disabled' && m.user_id) && (
                                <DropdownMenuItem
                                  className="text-green-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const owner = account.team_members.find(m => m.is_owner);
                                    if (owner?.user_id) {
                                      handleEnableUser(account.id, owner.user_id, account.name || account.email);
                                    }
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Re-enable Owner
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${account.id}`); }}>
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Child Team Members */}
                      <CollapsibleContent>
                        {account.team_members.filter(m => !m.is_owner).length > 0 ? (
                          <div className="border-t bg-muted/30">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="pl-14">Team Member</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Joined</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {account.team_members.filter(m => !m.is_owner).map((member) => (
                                  <TableRow key={member.id}>
                                    <TableCell className="pl-14">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                          {member.profiles?.avatar_url && <AvatarImage src={member.profiles.avatar_url} />}
                                          <AvatarFallback className="text-xs">
                                            {member.profiles?.name?.charAt(0) || member.profiles?.email?.charAt(0) || "?"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <div className="font-medium text-sm">{member.profiles?.name || "Pending User"}</div>
                                          <div className="text-xs text-muted-foreground">{member.profiles?.email || "Invite pending"}</div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="capitalize">{member.role}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {member.status === 'active' ? (
                                        <Badge className="bg-green-500/10 text-green-600 border-green-500">Active</Badge>
                                      ) : member.status === 'pending' ? (
                                        <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                                      ) : (
                                        <Badge variant="outline">{member.status}</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {member.accepted_at ? (
                                        <span className="text-sm">{formatDate(new Date(member.accepted_at), "MMM d, yyyy")}</span>
                                      ) : <span className="text-sm text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setChangeRoleDialog({ open: true, member, accountId: account.id });
                                            setSelectedRole(member.role);
                                          }}
                                        >
                                          <Shield className="h-3 w-3 mr-1" />
                                          Change Role
                                        </Button>
                                        {member.status === 'active' && member.user_id && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-amber-600 hover:text-amber-700"
                                            onClick={() => handleDisableUser(account.id, member.user_id!, member.profiles?.name || member.profiles?.email || 'user')}
                                          >
                                            <Ban className="h-3 w-3 mr-1" />
                                            Disable
                                          </Button>
                                        )}
                                        {member.status === 'disabled' && member.user_id && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-green-600 hover:text-green-700"
                                            onClick={() => handleEnableUser(account.id, member.user_id!, member.profiles?.name || member.profiles?.email || 'user')}
                                          >
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Enable
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => handleRemoveFromParent(member.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="border-t p-4 text-center text-muted-foreground text-sm bg-muted/30">
                            <UserPlus className="h-5 w-5 mx-auto mb-2 opacity-50" />
                            No team members
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}

              {accounts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No accounts found</div>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalAccounts)} of {totalAccounts} accounts
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>Previous</Button>
                <span className="text-sm">Page {currentPage + 1} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Accounts Dialog */}
      <Dialog open={mergeDialog.open} onOpenChange={(open) => setMergeDialog({ open, sourceAccount: open ? mergeDialog.sourceAccount : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Merge Account
            </DialogTitle>
            <DialogDescription>
              Move all data (debtors, invoices, payments, team members) from <strong>{mergeDialog.sourceAccount?.name || mergeDialog.sourceAccount?.email}</strong> into a target parent account. The source user will become a team member of the target.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source Account</Label>
              <div className="p-3 bg-muted rounded-md mt-1">
                <div className="font-medium">{mergeDialog.sourceAccount?.name || "—"}</div>
                <div className="text-sm text-muted-foreground">{mergeDialog.sourceAccount?.email}</div>
              </div>
            </div>
            <div>
              <Label>Target Parent Account</Label>
              <Input
                placeholder="Search target account by email or name..."
                value={targetAccountSearch}
                onChange={(e) => searchTargetAccounts(e.target.value)}
                className="mt-1"
              />
              {targetAccounts.length > 0 && (
                <div className="border rounded-md mt-2 max-h-48 overflow-y-auto">
                  {targetAccounts
                    .filter(a => a.id !== mergeDialog.sourceAccount?.id)
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className={`p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${selectedTargetId === acc.id ? 'bg-primary/10 border-primary' : ''}`}
                        onClick={() => setSelectedTargetId(acc.id)}
                      >
                        <div className="font-medium text-sm">{acc.name || acc.email}</div>
                        <div className="text-xs text-muted-foreground">{acc.email} • {acc.company_name || 'No company'}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            {selectedTargetId && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-sm text-amber-700">
                <strong>⚠️ Warning:</strong> This action is irreversible. All data will be moved to the target account. The source user will become a &quot;member&quot; of the target account.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog({ open: false, sourceAccount: null })}>Cancel</Button>
            <Button onClick={handleMergeAccounts} disabled={!selectedTargetId || actionLoading} variant="destructive">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitMerge className="h-4 w-4 mr-2" />}
              Merge Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Parent Dialog */}
      <Dialog open={assignParentDialog.open} onOpenChange={(open) => setAssignParentDialog({ open, childAccount: open ? assignParentDialog.childAccount : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Assign to Parent Account
            </DialogTitle>
            <DialogDescription>
              Add <strong>{assignParentDialog.childAccount?.name || assignParentDialog.childAccount?.email}</strong> as a child of another account. They will inherit the parent&apos;s data access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Child Account</Label>
              <div className="p-3 bg-muted rounded-md mt-1">
                <div className="font-medium">{assignParentDialog.childAccount?.name || "—"}</div>
                <div className="text-sm text-muted-foreground">{assignParentDialog.childAccount?.email}</div>
              </div>
            </div>
            <div>
              <Label>Parent Account</Label>
              <Input
                placeholder="Search parent account by email or name..."
                value={targetAccountSearch}
                onChange={(e) => searchTargetAccounts(e.target.value)}
                className="mt-1"
              />
              {targetAccounts.length > 0 && (
                <div className="border rounded-md mt-2 max-h-48 overflow-y-auto">
                  {targetAccounts
                    .filter(a => a.id !== assignParentDialog.childAccount?.id)
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className={`p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${selectedTargetId === acc.id ? 'bg-primary/10 border-primary' : ''}`}
                        onClick={() => setSelectedTargetId(acc.id)}
                      >
                        <div className="font-medium text-sm">{acc.name || acc.email}</div>
                        <div className="text-xs text-muted-foreground">{acc.email} • {acc.company_name || 'No company'}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div>
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Owner role cannot be assigned — only one owner per hierarchy.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignParentDialog({ open: false, childAccount: null })}>Cancel</Button>
            <Button onClick={handleAssignParent} disabled={!selectedTargetId || actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Assign Parent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={changeRoleDialog.open} onOpenChange={(open) => setChangeRoleDialog({ open, member: open ? changeRoleDialog.member : null, accountId: open ? changeRoleDialog.accountId : '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Change User Role
            </DialogTitle>
            <DialogDescription>
              Update role for <strong>{changeRoleDialog.member?.profiles?.name || changeRoleDialog.member?.profiles?.email || "user"}</strong>.
              Only one owner is allowed per account hierarchy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access except billing ownership</SelectItem>
                  <SelectItem value="member">Member — Can create/edit data</SelectItem>
                  <SelectItem value="viewer">Viewer — Read-only access</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Owner role is restricted to one user per hierarchy and cannot be reassigned.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleDialog({ open: false, member: null, accountId: '' })}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOwnerDialog.open} onOpenChange={(open) => setTransferOwnerDialog({ open, account: open ? transferOwnerDialog.account : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Transfer Account Ownership
            </DialogTitle>
            <DialogDescription>
              Disable the current owner and promote a team member to owner for <strong>{transferOwnerDialog.account?.name || transferOwnerDialog.account?.email}</strong>. The previous owner will be disabled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Owner</Label>
              <div className="p-3 bg-muted rounded-md mt-1">
                <div className="font-medium">{transferOwnerDialog.account?.name || "—"}</div>
                <div className="text-sm text-muted-foreground">{transferOwnerDialog.account?.email}</div>
              </div>
            </div>
            <div>
              <Label>New Owner (select from active team members)</Label>
              <Select value={selectedNewOwnerId} onValueChange={setSelectedNewOwnerId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a team member..." />
                </SelectTrigger>
                <SelectContent>
                  {transferOwnerDialog.account?.team_members
                    .filter(m => !m.is_owner && m.status === 'active' && m.user_id)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.user_id!}>
                        {member.profiles?.name || member.profiles?.email || "Unknown"} — {member.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedNewOwnerId && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                <strong>⚠️ Warning:</strong> The current owner will be <strong>disabled</strong> and the selected team member will become the new account owner. This affects billing ownership and all account-level permissions.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOwnerDialog({ open: false, account: null })}>Cancel</Button>
            <Button onClick={handleTransferOwnership} disabled={!selectedNewOwnerId || actionLoading} variant="destructive">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCog className="h-4 w-4 mr-2" />}
              Transfer Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminAccountsHierarchy;
