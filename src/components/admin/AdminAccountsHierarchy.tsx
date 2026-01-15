import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Users,
  ChevronDown,
  ChevronRight,
  Building2,
  CreditCard,
  Receipt,
  UserPlus,
  Crown,
  Clock,
  AlertCircle,
  CheckCircle,
  Ban,
  TrendingUp,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const pageSize = 25;

  useEffect(() => {
    fetchAccounts();
  }, [currentPage]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("admin-list-accounts", {
        body: {
          search,
          limit: pageSize,
          offset: currentPage * pageSize,
        },
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
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const getSubscriptionBadge = (account: AccountData) => {
    if (account.is_blocked) {
      return <Badge variant="destructive" className="bg-red-900"><Ban className="h-3 w-3 mr-1" />Blocked</Badge>;
    }
    if (account.is_suspended) {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    
    const status = account.subscription_status;
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

  const getUsageProgress = (account: AccountData) => {
    const limit = account.plans?.invoice_limit || account.invoice_limit || 5;
    const used = account.current_month_usage || 0;
    const percentage = Math.min((used / limit) * 100, 100);
    return { used, limit, percentage };
  };

  const totalPages = Math.ceil(totalAccounts / pageSize);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Account Hierarchy
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              View accounts with team members and subscription details
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Search */}
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
                    {/* Parent Account Row */}
                    <div className="flex items-center gap-4 p-4 hover:bg-muted/50">
                      <CollapsibleTrigger asChild>
                        <div className="flex-shrink-0 cursor-pointer">
                          {account.team_member_count > 0 ? (
                            isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )
                          ) : (
                            <div className="w-5" />
                          )}
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
                                <Crown className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="truncate">{account.email}</span>
                            {account.company_name && (
                              <>
                                <span>•</span>
                                <span className="truncate">{account.company_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Plan & Subscription Info */}
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="text-center min-w-[80px]">
                          <Badge variant="outline">
                            {account.plans?.name || account.plan_type || "Free"}
                          </Badge>
                          {account.billing_interval && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {account.billing_interval}
                            </div>
                          )}
                        </div>

                        <div className="text-center min-w-[80px]">
                          {getSubscriptionBadge(account)}
                          {account.cancel_at_period_end && (
                            <div className="text-xs text-orange-500 mt-1">
                              Canceling
                            </div>
                          )}
                        </div>

                        {/* Usage */}
                        <div className="min-w-[120px]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Usage</span>
                            <span>{usage.used}/{usage.limit}</span>
                          </div>
                          <Progress value={usage.percentage} className="h-2" />
                        </div>

                        {/* Team */}
                        <div className="flex items-center gap-1 min-w-[60px]">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{account.team_member_count + 1}</span>
                        </div>

                        {/* Billing */}
                        <div className="min-w-[100px] text-right">
                          {account.stripe_customer_id ? (
                            <div className="flex items-center justify-end gap-1">
                              <CreditCard className="h-4 w-4 text-green-500" />
                              <span className="text-xs text-muted-foreground">
                                {account.stripe_customer_id.slice(0, 10)}...
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No billing</span>
                          )}
                          {account.current_period_end && (
                            <div className="text-xs text-muted-foreground">
                              Renews {formatDate(new Date(account.current_period_end), "MMM d")}
                            </div>
                          )}
                        </div>
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
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {account.team_members
                                .filter(m => !m.is_owner)
                                .map((member) => (
                                  <TableRow key={member.id}>
                                    <TableCell className="pl-14">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                          {member.profiles?.avatar_url && (
                                            <AvatarImage src={member.profiles.avatar_url} />
                                          )}
                                          <AvatarFallback className="text-xs">
                                            {member.profiles?.name?.charAt(0) || member.profiles?.email?.charAt(0) || "?"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <div className="font-medium text-sm">
                                            {member.profiles?.name || "Pending User"}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {member.profiles?.email || "Invite pending"}
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="capitalize">
                                        {member.role}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {member.status === 'active' ? (
                                        <Badge className="bg-green-500/10 text-green-600 border-green-500">
                                          Active
                                        </Badge>
                                      ) : member.status === 'pending' ? (
                                        <Badge variant="secondary">
                                          <Clock className="h-3 w-3 mr-1" />
                                          Pending
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">{member.status}</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {member.accepted_at ? (
                                        <span className="text-sm">
                                          {formatDate(new Date(member.accepted_at), "MMM d, yyyy")}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">—</span>
                                      )}
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
              <div className="text-center py-12 text-muted-foreground">
                No accounts found
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {currentPage * pageSize + 1} to{" "}
              {Math.min((currentPage + 1) * pageSize, totalAccounts)} of {totalAccounts} accounts
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
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
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAccountsHierarchy;
