import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Shield, Users, Settings, Activity, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  email: string;
  name: string;
  company_name: string;
  plan_type: string;
  plan_id: string;
  is_admin: boolean;
  created_at: string;
  plans?: {
    name: string;
    monthly_price: number;
  };
}

interface UserDetails extends User {
  overrides: Array<{
    feature_key: string;
    value: boolean;
  }>;
  actions: Array<{
    action: string;
    created_at: string;
    admin_name: string;
    details: any;
  }>;
  stats: {
    total_invoices: number;
    total_debtors: number;
    recent_usage: Array<{
      month: string;
      included_invoices_used: number;
      overage_invoices: number;
    }>;
  };
}

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  invoice_limit: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [limit] = useState(10);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [currentPage, search]);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();

      if (!profile?.is_admin) {
        toast({
          title: "Access Denied",
          description: "You don't have admin access",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      loadData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/dashboard");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { search, limit, offset: currentPage * limit },
      });

      if (error) throw error;
      setUsers(data.users || []);
      setTotalCount(data.total || 0);

      // Load plans
      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("*")
        .order("monthly_price", { ascending: true });

      if (plansError) throw plansError;
      setPlans(plansData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-get-user-details", {
        body: { userId },
      });

      if (error) throw error;
      setUserDetails(data);
    } catch (error) {
      console.error("Error loading user details:", error);
      toast({
        title: "Error",
        description: "Failed to load user details",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdatePlan = async (userId: string, planId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId,
          action: "update_plan",
          updates: { plan_id: planId },
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User plan updated successfully",
      });

      loadData();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        title: "Error",
        description: "Failed to update user plan",
        variant: "destructive",
      });
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId,
          action: "toggle_admin",
          updates: {},
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Admin status toggled successfully",
      });

      loadData();
      if (selectedUser?.id === userId) {
        loadUserDetails(userId);
      }
    } catch (error) {
      console.error("Error toggling admin:", error);
      toast({
        title: "Error",
        description: "Failed to toggle admin status",
        variant: "destructive",
      });
    }
  };

  const handleToggleFeature = async (userId: string, featureKey: string, value: boolean) => {
    try {
      const action = value ? "set_feature_override" : "remove_feature_override";
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId,
          action,
          updates: { feature_key: featureKey, value },
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Feature override ${value ? "enabled" : "disabled"}`,
      });

      loadUserDetails(userId);
    } catch (error) {
      console.error("Error toggling feature:", error);
      toast({
        title: "Error",
        description: "Failed to update feature override",
        variant: "destructive",
      });
    }
  };

  const getFeatureOverrideValue = (featureKey: string): boolean => {
    return userDetails?.overrides?.find(o => o.feature_key === featureKey)?.value || false;
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Recouply.ai Admin
          </h1>
          <p className="text-muted-foreground">
            Manage users, plans, and feature overrides
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Search and manage customer accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(0);
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setCurrentPage(0)}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          users.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.name || user.email}</h3>
                      {user.is_admin && (
                        <Badge variant="destructive">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.company_name && (
                      <p className="text-sm text-muted-foreground">
                        Company: {user.company_name}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {user.plans?.name || user.plan_type || "No plan"}
                      </Badge>
                      {user.plans?.monthly_price && (
                        <Badge variant="secondary">
                          ${user.plans.monthly_price}/mo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setSelectedUser(user);
                      setDialogOpen(true);
                      await loadUserDetails(user.id);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* User Management Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage User</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : userDetails && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="space-y-4">
                  {/* User Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">User Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="text-sm font-medium">{userDetails.name || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <span className="text-sm font-medium">{userDetails.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Company</span>
                        <span className="text-sm font-medium">{userDetails.company_name || "Not set"}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Admin Access</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={userDetails.is_admin ? "destructive" : "outline"}>
                            {userDetails.is_admin ? "Admin" : "User"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleAdmin(userDetails.id)}
                          >
                            Toggle
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Plan Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Subscription Plan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select
                        value={userDetails.plan_id || ""}
                        onValueChange={(value) => handleUpdatePlan(userDetails.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - ${plan.monthly_price}/mo ({plan.invoice_limit} invoices)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Usage Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Usage Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Total Invoices</p>
                          <p className="text-2xl font-bold">{userDetails.stats?.total_invoices || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Total Debtors</p>
                          <p className="text-2xl font-bold">{userDetails.stats?.total_debtors || 0}</p>
                        </div>
                      </div>
                      {userDetails.stats?.recent_usage && userDetails.stats.recent_usage.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Recent Monthly Usage</p>
                            {userDetails.stats.recent_usage.map((usage: any) => (
                              <div key={usage.month} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{usage.month}</span>
                                <span>
                                  {usage.included_invoices_used} included + {usage.overage_invoices} overage
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Features Tab */}
              <TabsContent value="features" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Feature Overrides</CardTitle>
                    <CardDescription>
                      Override plan-based features for this user
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-medium">Team Users</div>
                        <div className="text-sm text-muted-foreground">
                          Allow multi-user access and team management
                        </div>
                      </div>
                      <Switch
                        checked={getFeatureOverrideValue("can_have_team_users")}
                        onCheckedChange={(checked) =>
                          handleToggleFeature(userDetails.id, "can_have_team_users", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-medium">Role Management</div>
                        <div className="text-sm text-muted-foreground">
                          Allow role-based access control
                        </div>
                      </div>
                      <Switch
                        checked={getFeatureOverrideValue("can_manage_roles")}
                        onCheckedChange={(checked) =>
                          handleToggleFeature(userDetails.id, "can_manage_roles", checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-medium">Invoice Line Items</div>
                        <div className="text-sm text-muted-foreground">
                          Enable detailed line items on invoices
                        </div>
                      </div>
                      <Switch
                        checked={getFeatureOverrideValue("can_use_invoice_line_items")}
                        onCheckedChange={(checked) =>
                          handleToggleFeature(userDetails.id, "can_use_invoice_line_items", checked)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Admin Actions
                    </CardTitle>
                    <CardDescription>
                      Recent administrative actions for this user
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userDetails.actions && userDetails.actions.length > 0 ? (
                      <div className="space-y-3">
                        {userDetails.actions.map((action: any, index: number) => (
                          <div key={index} className="border-l-2 border-border pl-4 pb-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{action.action}</p>
                                <p className="text-xs text-muted-foreground">
                                  by {action.admin_name || "System"}
                                </p>
                                {action.details && (
                                  <p className="text-xs text-muted-foreground">
                                    {JSON.stringify(action.details)}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {new Date(action.created_at).toLocaleDateString()}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No admin actions recorded
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {!loading && totalCount > limit && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {currentPage * limit + 1} to {Math.min((currentPage + 1) * limit, totalCount)} of {totalCount} users
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={(currentPage + 1) * limit >= totalCount}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Admin;
