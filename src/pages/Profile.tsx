import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Shield, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  ExternalLink,
  Users,
  Settings as SettingsIcon,
  FileText,
  Zap,
  Info
} from "lucide-react";
import { PLAN_FEATURES } from "@/lib/planGating";

type AppRole = "owner" | "admin" | "member" | "viewer";
type PlanType = "free" | "starter" | "growth" | "pro";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  plan_type: PlanType | null;
  plan_id: string | null;
  stripe_customer_id: string | null;
}

interface Membership {
  role: AppRole;
  status: string;
  account_id: string;
}

interface Organization {
  id: string;
  name: string;
  owner_user_id: string;
}

interface PermissionSet {
  manage_billing: boolean;
  manage_users: boolean;
  manage_workflows: boolean;
  edit_invoices: boolean;
  edit_debtors: boolean;
  view_reports: boolean;
  use_ai_features: boolean;
}

interface PlanInfo {
  name: string;
  description?: string | null;
  monthly_price: number | null;
  invoice_limit: number | null;
  feature_flags: any;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Get membership (check if user is part of an organization)
      const { data: membershipData } = await supabase
        .from("account_users")
        .select("role, status, account_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      setMembership(membershipData);

      // Get organization details
      const { data: orgData } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_user_id", user.id)
        .single();

      setOrganization(orgData);

      // Get plan details from database
      if (profileData?.plan_id) {
        const { data: planData } = await supabase
          .from("plans")
          .select("*")
          .eq("id", profileData.plan_id)
          .single();

        if (planData) {
          setPlanInfo(planData);
        }
      }

      // Get team member count
      const accountId = membershipData?.account_id || user.id;
      const { data: teamMembers } = await supabase
        .from("account_users")
        .select("id")
        .eq("account_id", accountId)
        .eq("status", "active");

      setTeamMemberCount(teamMembers?.length || 0);

    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (): AppRole => {
    if (membership) {
      return membership.role;
    }
    // If no membership, user is the owner of their own account
    return "owner";
  };

  const getPermissions = (role: AppRole): PermissionSet => {
    switch (role) {
      case "owner":
        return {
          manage_billing: true,
          manage_users: true,
          manage_workflows: true,
          edit_invoices: true,
          edit_debtors: true,
          view_reports: true,
          use_ai_features: true,
        };
      case "admin":
        return {
          manage_billing: true,
          manage_users: true,
          manage_workflows: true,
          edit_invoices: true,
          edit_debtors: true,
          view_reports: true,
          use_ai_features: true,
        };
      case "member":
        return {
          manage_billing: false,
          manage_users: false,
          manage_workflows: true,
          edit_invoices: true,
          edit_debtors: true,
          view_reports: true,
          use_ai_features: true,
        };
      case "viewer":
        return {
          manage_billing: false,
          manage_users: false,
          manage_workflows: false,
          edit_invoices: false,
          edit_debtors: false,
          view_reports: true,
          use_ai_features: false,
        };
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      case "member":
        return "outline";
      case "viewer":
        return "outline";
    }
  };

  const getInitials = (name: string | null, email: string | null): string => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getPlanName = (): string => {
    if (planInfo?.name) return planInfo.name;
    if (profile?.plan_type) {
      return profile.plan_type.charAt(0).toUpperCase() + profile.plan_type.slice(1);
    }
    return "Free";
  };

  const getPlanFeatures = () => {
    const planType = profile?.plan_type || "free";
    return PLAN_FEATURES[planType as keyof typeof PLAN_FEATURES];
  };

  const handleManageBilling = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to manage billing",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error opening billing portal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </Layout>
    );
  }

  const role = getUserRole();
  const permissions = getPermissions(role);
  const canManageBilling = permissions.manage_billing;
  const planFeatures = getPlanFeatures();
  const maxUsers = planFeatures.max_invited_users;

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-primary">Profile & Account</h1>
          <p className="text-muted-foreground mt-2">
            View your account details, permissions, and subscription plan
          </p>
        </div>

        {/* User Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {getInitials(profile.name, profile.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-lg font-semibold">{profile.name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Workspace:</span>
                  <span className="font-medium">
                    {organization?.name || profile.name || "Personal Workspace"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Role:</span>
                  <Badge variant={getRoleBadgeVariant(role)}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Permissions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your Access & Permissions
            </CardTitle>
            <CardDescription>
              Your role determines what you can do in this workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {permissions.manage_billing && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Can manage billing & subscriptions</span>
                </div>
              )}
              {!permissions.manage_billing && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cannot access billing & subscriptions</span>
                </div>
              )}

              {permissions.manage_users && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Can invite and manage team members</span>
                </div>
              )}
              {!permissions.manage_users && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cannot invite team members or change roles</span>
                </div>
              )}

              {permissions.manage_workflows && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Can configure workflows & AI templates</span>
                </div>
              )}
              {!permissions.manage_workflows && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cannot configure workflows</span>
                </div>
              )}

              {permissions.edit_invoices && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Can create and edit invoices & debtors</span>
                </div>
              )}
              {!permissions.edit_invoices && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cannot create or edit invoices</span>
                </div>
              )}

              {permissions.view_reports && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Can view reports and dashboards</span>
                </div>
              )}

              {permissions.use_ai_features && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Can use AI-powered collection features</span>
                </div>
              )}
              {!permissions.use_ai_features && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cannot use AI features</span>
                </div>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your role determines what you can do in this workspace. If you need more access, please contact an Owner or Admin.
              </AlertDescription>
            </Alert>

            {permissions.manage_users && (
              <div className="pt-2">
                <Button variant="outline" onClick={() => navigate("/team")}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan & Billing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan & Billing
            </CardTitle>
            <CardDescription>
              You are on the <strong>{getPlanName()}</strong> plan for this workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Summary */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{getPlanName()} Plan</p>
                  {planInfo?.monthly_price !== null && (
                    <p className="text-2xl font-bold text-primary">
                      ${planInfo?.monthly_price || 0}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                  )}
                  {planInfo?.monthly_price === null && (
                    <p className="text-lg text-muted-foreground">Custom Pricing</p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => window.open("/pricing", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Plans
                </Button>
              </div>

              <Separator />

              {/* Key Features */}
              <div>
                <p className="text-sm font-medium mb-3">Plan Features:</p>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Monthly Invoice Allowance
                    </span>
                    <span className="font-medium">
                      {planFeatures.invoice_limit === null
                        ? "Unlimited"
                        : `${planFeatures.invoice_limit} invoices`}
                    </span>
                  </div>
                  {planInfo?.feature_flags?.overage_amount && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Overage Rate</span>
                      <span className="font-medium">${planInfo.feature_flags.overage_amount} per invoice</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Team Access
                    </span>
                    <span className="font-medium">
                      {planFeatures.can_have_team_users
                        ? `Up to ${maxUsers} users`
                        : "Single user only"}
                    </span>
                  </div>
                  {planFeatures.can_have_team_users && (
                    <div className="pl-6">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Current Usage</span>
                        <span>{teamMemberCount} of {maxUsers} seats</span>
                      </div>
                      <Progress 
                        value={(teamMemberCount / maxUsers) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      Line Items Support
                    </span>
                    <span className="font-medium">
                      {planFeatures.can_use_invoice_line_items ? "Enabled" : "Not available"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                      Role Management
                    </span>
                    <span className="font-medium">
                      {planFeatures.can_manage_roles ? "Enabled" : "Not available"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Billing Actions */}
            {canManageBilling && (
              <div className="space-y-3">
                <Button 
                  onClick={handleManageBilling}
                  disabled={processing}
                  className="w-full"
                >
                  {processing ? "Loading..." : "Manage Subscription"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Change your plan, update payment method, or view billing history
                </p>
              </div>
            )}

            {!canManageBilling && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Only Owners and Admins can change the plan for this workspace. Contact your workspace owner to upgrade or manage billing.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Profile;
