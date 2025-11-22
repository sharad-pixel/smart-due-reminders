import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Shield, Users, Settings } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

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
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { search, limit: 50, offset: 0 },
      });

      if (error) throw error;
      setUsers(data.users || []);

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

      loadData();
    } catch (error) {
      console.error("Error toggling feature:", error);
      toast({
        title: "Error",
        description: "Failed to update feature override",
        variant: "destructive",
      });
    }
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
                className="pl-9"
              />
            </div>
            <Button onClick={loadData}>Search</Button>
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
                    onClick={() => {
                      setSelectedUser(user);
                      setDialogOpen(true);
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage User</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* Plan Management */}
              <div className="space-y-2">
                <Label>Subscription Plan</Label>
                <Select
                  value={selectedUser.plan_id || ""}
                  onValueChange={(value) => handleUpdatePlan(selectedUser.id, value)}
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
              </div>

              {/* Feature Overrides */}
              <div className="space-y-4">
                <Label>Feature Overrides</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Team Users</div>
                      <div className="text-sm text-muted-foreground">
                        Allow multi-user access and team management
                      </div>
                    </div>
                    <Switch
                      onCheckedChange={(checked) =>
                        handleToggleFeature(selectedUser.id, "can_have_team_users", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Role Management</div>
                      <div className="text-sm text-muted-foreground">
                        Allow role-based access control
                      </div>
                    </div>
                    <Switch
                      onCheckedChange={(checked) =>
                        handleToggleFeature(selectedUser.id, "can_manage_roles", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Invoice Line Items</div>
                      <div className="text-sm text-muted-foreground">
                        Enable detailed line items on invoices
                      </div>
                    </div>
                    <Switch
                      onCheckedChange={(checked) =>
                        handleToggleFeature(selectedUser.id, "can_use_invoice_line_items", checked)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
