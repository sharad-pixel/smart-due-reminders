import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Users,
  Settings as SettingsIcon,
  FileText,
  Zap,
  Info,
  UserX,
  AlertTriangle,
  Crown,
  Building2,
  Pencil,
  Copy,
  Bell,
  KeyRound,
  Lock,
  Mail
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PLAN_FEATURES } from "@/lib/planGating";
import BillingSection from "@/components/BillingSection";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { AccountHierarchy } from "@/components/AccountHierarchy";
import { ProfileAvatarEditor } from "@/components/ProfileAvatarEditor";
import { useNicolasPreferences } from "@/hooks/useNicolasPreferences";
import nicolasAvatar from "@/assets/personas/nicolas.png";
import { TrialCountdown } from "@/components/TrialCountdown";

type AppRole = "owner" | "admin" | "member" | "viewer";
type PlanType = "free" | "starter" | "growth" | "pro" | "professional" | "enterprise";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  plan_type: PlanType | null;
  subscription_status: string | null;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  avatar_url: string | null;
  daily_digest_email_enabled: boolean | null;
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

// Nicolas Assistant Card Component
const NicolasAssistantCard = () => {
  const { preferences, toggleAssistant, resetOnboarding } = useNicolasPreferences();
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img src={nicolasAvatar} alt="Nicolas" className="h-5 w-5 rounded-full" />
          Nicolas Assistant
        </CardTitle>
        <CardDescription>
          Configure your AI assistant and onboarding preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Assistant Enabled</Label>
            <p className="text-sm text-muted-foreground">
              Show Nicolas chat helper on all pages
            </p>
          </div>
          <Switch
            checked={preferences.assistantEnabled}
            onCheckedChange={(checked) => {
              toggleAssistant(checked);
              toast({
                title: checked ? "Nicolas Enabled" : "Nicolas Disabled",
                description: checked 
                  ? "Nicolas will appear on all pages to help you." 
                  : "Nicolas has been hidden. You can re-enable anytime.",
              });
            }}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Restart Onboarding</Label>
            <p className="text-sm text-muted-foreground">
              See the welcome tour and page tips again
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetOnboarding();
              toast({
                title: "Onboarding Reset",
                description: "Refresh the page to see the welcome tour.",
              });
            }}
          >
            Restart Tour
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [savingWorkspaceName, setSavingWorkspaceName] = useState(false);
  const [dailyDigestEmailEnabled, setDailyDigestEmailEnabled] = useState(true);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [authProvider, setAuthProvider] = useState<'email' | 'google' | 'other' | null>(null);
  
  // Get effective account info for parent/child display
  const { 
    isTeamMember, 
    ownerName, 
    ownerEmail, 
    ownerCompanyName,
    ownerPlanType, 
    ownerSubscriptionStatus,
    ownerAvatarUrl,
    memberRole 
  } = useEffectiveAccount();

  useEffect(() => {
    loadProfileData();
    
    // Handle checkout success/cancel
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast({
        title: "Subscription Updated",
        description: "Your subscription has been updated successfully. It may take a moment to reflect.",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/profile');
    } else if (checkoutStatus === 'canceled') {
      toast({
        title: "Checkout Canceled",
        description: "You can upgrade your plan anytime.",
        variant: "default",
      });
      window.history.replaceState({}, '', '/profile');
    }
  }, [searchParams]);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Determine auth provider
      const provider = user.app_metadata?.provider;
      if (provider === 'google') {
        setAuthProvider('google');
      } else if (provider === 'email' || !provider) {
        setAuthProvider('email');
      } else {
        setAuthProvider('other');
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setDailyDigestEmailEnabled(profileData.daily_digest_email_enabled !== false);

      // Get membership (check if user is part of an organization)
      const { data: membershipData } = await supabase
        .from("account_users")
        .select("role, status, account_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      setMembership(membershipData);

      // Get organization details - use RPC to get org for both owners and team members
      const { data: orgId } = await supabase.rpc('get_user_organization_id', {
        p_user_id: user.id
      });

      if (orgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", orgId)
          .single();

        setOrganization(orgData);
        if (orgData?.name) {
          setNewWorkspaceName(orgData.name);
        }
      }

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

  // handleManageBilling and handleCancelSubscription moved to BillingSection component

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    if (!profile) return;

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}.${fileExt}`;
    const filePath = `${profile.id}/${fileName}`;

    setUploading(true);
    try {
      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });

      // Reload to update navigation
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!profile || !profile.avatar_url) return;

    setUploading(true);
    try {
      // Delete from storage
      const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
      await supabase.storage.from('avatars').remove([oldPath]);

      // Update profile to remove avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: null });
      toast({
        title: "Success",
        description: "Profile picture deleted successfully",
      });

      // Reload to update navigation
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      console.error("Error deleting avatar:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete profile picture",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!organization || !newWorkspaceName.trim()) return;
    
    setSavingWorkspaceName(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: newWorkspaceName.trim() })
        .eq('id', organization.id);

      if (error) throw error;

      setOrganization({ ...organization, name: newWorkspaceName.trim() });
      setRenameDialogOpen(false);
      toast({
        title: "Success",
        description: "Workspace name updated successfully",
      });
    } catch (error: any) {
      console.error("Error renaming workspace:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to rename workspace",
        variant: "destructive",
      });
    } finally {
      setSavingWorkspaceName(false);
    }
  };

  const copyOrgId = () => {
    if (organization?.id) {
      navigator.clipboard.writeText(organization.id);
      toast({
        title: "Copied",
        description: "Organization ID copied to clipboard",
      });
    }
  };

  const handleDailyDigestToggle = async (enabled: boolean) => {
    if (!profile) return;
    
    setSavingEmailPrefs(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ daily_digest_email_enabled: enabled })
        .eq('id', profile.id);

      if (error) throw error;

      setDailyDigestEmailEnabled(enabled);
      setProfile({ ...profile, daily_digest_email_enabled: enabled });
      toast({
        title: enabled ? "Daily Digest Enabled" : "Daily Digest Disabled",
        description: enabled 
          ? "You will receive daily health summary emails." 
          : "You will no longer receive daily health summary emails.",
      });
    } catch (error: any) {
      console.error("Error updating email preferences:", error);
      toast({
        title: "Error",
        description: "Failed to update email preferences",
        variant: "destructive",
      });
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully",
      });
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!profile) return;
    
    setRequestingDeletion(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: ['support@recouply.ai'],
          from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
          subject: `Account Deletion Request - ${profile.email}`,
          html: `
            <h2>Account Deletion Request</h2>
            <p>A user has requested to delete their account.</p>
            <hr />
            <p><strong>User ID:</strong> ${profile.id}</p>
            <p><strong>Email:</strong> ${profile.email}</p>
            <p><strong>Name:</strong> ${profile.name || 'Not provided'}</p>
            <p><strong>Organization:</strong> ${organization?.name || 'Not available'}</p>
            <p><strong>Request Time:</strong> ${new Date().toISOString()}</p>
            <hr />
            <p>Please process this deletion request according to your data retention policies.</p>
          `,
          reply_to: profile.email || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your account deletion request has been sent to our support team. We'll process it within 48 hours.",
      });
    } catch (error: any) {
      console.error("Error requesting deletion:", error);
      toast({
        title: "Error",
        description: "Failed to submit deletion request. Please email support@recouply.ai directly.",
        variant: "destructive",
      });
    } finally {
      setRequestingDeletion(false);
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
            View your account details, permissions, and plan
          </p>
        </div>

        {/* Parent Account Banner for Child Accounts */}
        {isTeamMember && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0">
                  <Crown className="h-3 w-3 mr-1" />
                  Parent Account
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  {ownerAvatarUrl && <AvatarImage src={ownerAvatarUrl} alt={ownerName || "Owner"} />}
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {ownerName ? ownerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                     ownerEmail ? ownerEmail.slice(0, 2).toUpperCase() : 'O'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{ownerName || ownerEmail || 'Account Owner'}</p>
                  {ownerEmail && ownerName && (
                    <p className="text-sm text-muted-foreground">{ownerEmail}</p>
                  )}
                  {ownerCompanyName && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {ownerCompanyName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {ownerPlanType || 'free'} Plan
                    </Badge>
                    {ownerSubscriptionStatus === 'active' && (
                      <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trial Countdown - Shows only for trial/free users */}
        <TrialCountdown variant="card" />

        {/* User Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </div>
              {/* Account Type Badge */}
              {isTeamMember ? (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Child Account
                </Badge>
              ) : (
                <Badge className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0 text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Parent Account
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <ProfileAvatarEditor
                avatarUrl={profile.avatar_url}
                name={profile.name}
                email={profile.email}
                uploading={uploading}
                onUpload={handleAvatarUpload}
                onDelete={handleAvatarDelete}
                size="lg"
              />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-lg font-semibold">{profile.name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  {uploading && (
                    <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Workspace:</span>
                  <span className="font-medium">
                    {organization?.name || profile.name || "Personal Workspace"}
                  </span>
                  {!isTeamMember && organization && (
                    <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rename Workspace</DialogTitle>
                          <DialogDescription>
                            Enter a new name for your workspace.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="workspace-name">Workspace Name</Label>
                            <Input
                              id="workspace-name"
                              value={newWorkspaceName}
                              onChange={(e) => setNewWorkspaceName(e.target.value)}
                              placeholder="My Workspace"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleRenameWorkspace}
                            disabled={savingWorkspaceName || !newWorkspaceName.trim()}
                          >
                            {savingWorkspaceName ? "Saving..." : "Save"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {organization && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Org ID:</span>
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      {organization.id}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={copyOrgId}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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

        {/* Security & Authentication Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Security & Authentication
            </CardTitle>
            <CardDescription>
              Manage how you sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auth Method Display */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {authProvider === 'google' ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-white border flex items-center justify-center">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Google Account</p>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Email & Password</p>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                    </div>
                  </>
                )}
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>

            {/* Password Change - Only for email/password users */}
            {authProvider === 'email' && (
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                </div>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Change Password</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter a new password for your account. Password must be at least 8 characters.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setPasswordDialogOpen(false);
                        setNewPassword("");
                        setConfirmPassword("");
                      }}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword || !confirmPassword}
                      >
                        {changingPassword ? "Updating..." : "Update Password"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Info for Google users */}
            {authProvider === 'google' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your account is linked to Google. Password management is handled through your Google account settings.
                </AlertDescription>
              </Alert>
            )}
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
                  <span className="text-sm">Can manage billing</span>
                </div>
              )}
              {!permissions.manage_billing && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cannot access billing</span>
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

            <div className="pt-2 flex flex-wrap gap-2">
              {permissions.manage_users && (
                <Button variant="outline" onClick={() => navigate("/team")}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team
                </Button>
              )}
              {permissions.manage_billing && (
                <Button variant="outline" onClick={() => navigate("/billing")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Billing & Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Hierarchy - Shows for all users (both owners and team members) */}
        <AccountHierarchy />

        {/* Billing Section - Using new component */}
        {profile && (
          <BillingSection 
            profile={{
              id: profile.id,
              email: profile.email,
              // Team members inherit parent's plan, not their own "free" plan
              plan_type: isTeamMember ? (ownerPlanType as PlanType | null) : profile.plan_type,
              subscription_status: isTeamMember ? (ownerSubscriptionStatus || null) : profile.subscription_status,
              stripe_customer_id: profile.stripe_customer_id,
              stripe_subscription_id: profile.stripe_subscription_id,
            }}
            canManageBilling={canManageBilling}
            onRefresh={loadProfileData}
            isTeamMember={isTeamMember}
          />
        )}

        {/* Email Alerts Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Email Alerts
            </CardTitle>
            <CardDescription>
              Configure which email notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="daily-digest-toggle" className="text-base font-medium">
                  Daily Health Summary
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily email with your collections health score, AR summary, and key metrics
                </p>
              </div>
              <Switch
                id="daily-digest-toggle"
                checked={dailyDigestEmailEnabled}
                onCheckedChange={handleDailyDigestToggle}
                disabled={savingEmailPrefs}
              />
            </div>
          </CardContent>
        </Card>

        {/* Nicolas Assistant Section */}
        <NicolasAssistantCard />

        {/* Account Deletion Request */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              Delete Account
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once your account is deleted, all of your data will be permanently removed. 
              This action cannot be undone. Our team will process your request within 48 hours.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <UserX className="h-4 w-4" />
                  Request Account Deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Delete Your Account?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>Are you sure you want to delete your account?</p>
                    <p className="text-sm">
                      This will send a deletion request to our support team. All your data, 
                      including invoices, accounts, and AI drafts will be permanently deleted.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRequestDeletion}
                    disabled={requestingDeletion}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {requestingDeletion ? "Submitting..." : "Yes, Delete My Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Profile;
