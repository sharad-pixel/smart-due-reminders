import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield, Eye, User, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type AppRole = "owner" | "admin" | "member" | "viewer";

interface TeamMember {
  id: string;
  user_id: string;
  role: AppRole;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  profiles: {
    name: string | null;
    email: string | null;
  };
}

interface EffectiveFeatures {
  plan_type: string;
  features: {
    can_have_team_users: boolean;
    can_manage_roles: boolean;
  };
}

const Team = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [features, setFeatures] = useState<EffectiveFeatures | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    checkFeatureAccess();
  }, []);

  const checkFeatureAccess = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-effective-features");

      if (error) throw error;

      setFeatures(data);

      if (!data.features.can_have_team_users) {
        // User doesn't have access to team features
        setLoading(false);
        return;
      }

      await loadTeamMembers();
    } catch (error) {
      console.error("Error checking feature access:", error);
      toast.error("Failed to load team settings");
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: { action: "list" },
      });

      if (error) throw error;

      setTeamMembers(data.data || []);
    } catch (error) {
      console.error("Error loading team members:", error);
      toast.error("Failed to load team members");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setIsInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "invite",
          email: inviteEmail,
          role: inviteRole,
        },
      });

      if (error) throw error;

      toast.success("Team member invited successfully");
      setInviteEmail("");
      setInviteRole("member");
      setIsDialogOpen(false);
      await loadTeamMembers();
    } catch (error: any) {
      console.error("Error inviting team member:", error);
      toast.error(error.message || "Failed to invite team member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "changeRole",
          userId,
          role: newRole,
        },
      });

      if (error) throw error;

      toast.success("Role updated successfully");
      await loadTeamMembers();
    } catch (error: any) {
      console.error("Error changing role:", error);
      toast.error(error.message || "Failed to change role");
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const action = currentStatus === "active" ? "disable" : "enable";

    try {
      const { error } = await supabase.functions.invoke("manage-team", {
        body: {
          action,
          userId,
        },
      });

      if (error) throw error;

      toast.success(`User ${action === "disable" ? "disabled" : "enabled"} successfully`);
      await loadTeamMembers();
    } catch (error: any) {
      console.error("Error toggling status:", error);
      toast.error(error.message || "Failed to update status");
    }
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case "owner":
        return <Shield className="h-4 w-4" />;
      case "admin":
        return <Lock className="h-4 w-4" />;
      case "member":
        return <User className="h-4 w-4" />;
      case "viewer":
        return <Eye className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  // Show feature lock screen if team features are not available
  if (!features?.features.can_have_team_users) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Team & Role Management
            </CardTitle>
            <CardDescription>
              Collaborate with your team and manage access levels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-6 text-center space-y-3">
              <h3 className="text-lg font-semibold">Upgrade to Access Team Features</h3>
              <p className="text-sm text-muted-foreground">
                Team and role management is available on Growth and Custom plans.
                Contact Recouply.ai or upgrade to enable this feature.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate("/pricing")}>View Pricing</Button>
                <Button variant="outline" onClick={() => navigate("/contact")}>
                  Contact Sales
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Team & Roles</h1>
            <p className="text-muted-foreground mt-1">
              Manage your team members and their access levels
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Add a new member to your team and assign their role
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {inviteRole === "admin" && "Can manage team members and settings"}
                    {inviteRole === "member" && "Can manage invoices, debtors, and AI drafts"}
                    {inviteRole === "viewer" && "Read-only access to all data"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={isInviting}>
                  {isInviting ? "Inviting..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""} in your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      {getRoleIcon(member.role)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {member.profiles?.name || member.profiles?.email || "Unknown"}
                        </p>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                        {member.status === "disabled" && (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.profiles?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role !== "owner" && features?.features.can_manage_roles && (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleChangeRole(member.user_id, value as AppRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {member.role !== "owner" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(member.user_id, member.status)}
                      >
                        {member.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>Understanding what each role can do</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Owner</p>
                  <p className="text-sm text-muted-foreground">
                    Full access to everything including billing and team management
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Admin</p>
                  <p className="text-sm text-muted-foreground">
                    Manage team members, settings, workflows, and all data
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Member</p>
                  <p className="text-sm text-muted-foreground">
                    Can manage invoices, debtors, and AI drafts
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Viewer</p>
                  <p className="text-sm text-muted-foreground">
                    Read-only access to all data (no writes)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Team;