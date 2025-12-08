import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield, Eye, User, Lock, Check, X, DollarSign, AlertCircle, Loader2, UserX, UserCheck, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEAT_PRICING } from "@/lib/subscriptionConfig";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [features, setFeatures] = useState<EffectiveFeatures | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddingSeat, setIsAddingSeat] = useState(false);
  const [showAddSeatDialog, setShowAddSeatDialog] = useState(false);
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<TeamMember | null>(null);
  const [assignedTasksCount, setAssignedTasksCount] = useState(0);
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isSyncingBilling, setIsSyncingBilling] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [memberToReassign, setMemberToReassign] = useState<TeamMember | null>(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  // Handle checkout success/failure from URL params
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const seatsAdded = searchParams.get('seats_added');
    
    if (checkout === 'success') {
      if (seatsAdded) {
        toast.success(`Successfully added ${seatsAdded} seat(s) to your account!`);
      } else {
        toast.success('Payment successful! You can now invite team members.');
      }
      // Clean up URL params
      setSearchParams({});
    } else if (checkout === 'cancelled') {
      toast.info('Checkout was cancelled');
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

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

      toast.success(data.message || "Team member invited successfully");
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

  const handleOpenDeactivateDialog = async (member: TeamMember) => {
    setMemberToDeactivate(member);
    setReassignToUserId("");
    
    // Check if user has assigned tasks
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "getAssignedTasksCount",
          userId: member.user_id,
        },
      });
      
      if (!error && data) {
        setAssignedTasksCount(data.count || 0);
      }
    } catch (error) {
      console.error("Error checking assigned tasks:", error);
      setAssignedTasksCount(0);
    }
    
    setShowDeactivateDialog(true);
  };

  const handleDeactivateMember = async () => {
    if (!memberToDeactivate) return;
    
    setIsTogglingStatus(true);
    try {
      // First disable the user
      const { error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "disable",
          userId: memberToDeactivate.user_id,
          reassignTo: reassignToUserId || null,
        },
      });

      if (error) throw error;

      // Sync billing to adjust Stripe seat count
      await syncBilling();

      toast.success("Team member deactivated and billing updated");
      setShowDeactivateDialog(false);
      setMemberToDeactivate(null);
      await loadTeamMembers();
    } catch (error: any) {
      console.error("Error deactivating team member:", error);
      toast.error(error.message || "Failed to deactivate team member");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleReactivateMember = async (userId: string) => {
    setIsTogglingStatus(true);
    try {
      const { error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "enable",
          userId,
        },
      });

      if (error) throw error;

      // Sync billing to adjust Stripe seat count
      await syncBilling();

      toast.success("Team member reactivated and billing updated");
      await loadTeamMembers();
    } catch (error: any) {
      console.error("Error reactivating team member:", error);
      toast.error(error.message || "Failed to reactivate team member");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleOpenReassignDialog = (member: TeamMember) => {
    setMemberToReassign(member);
    setReassignEmail("");
    setShowReassignDialog(true);
  };

  const handleReassignSeat = async () => {
    if (!memberToReassign || !reassignEmail) {
      toast.error("Please enter the new email address");
      return;
    }

    setIsReassigning(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "reassign",
          userId: memberToReassign.user_id,
          email: reassignEmail,
        },
      });

      if (error) throw error;

      toast.success(data.message || "Seat reassigned successfully");
      setShowReassignDialog(false);
      setMemberToReassign(null);
      setReassignEmail("");
      await loadTeamMembers();
    } catch (error: any) {
      console.error("Error reassigning seat:", error);
      toast.error(error.message || "Failed to reassign seat");
    } finally {
      setIsReassigning(false);
    }
  };

  const syncBilling = async () => {
    setIsSyncingBilling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("sync-seat-billing", {
        body: {
          accountId: user.id,
          action: "recalculate",
        },
      });

      if (error) throw error;
      
      if (data?.stripeUpdated) {
        console.log("Billing synced:", data);
      }
    } catch (error) {
      console.error("Error syncing billing:", error);
      // Don't show error toast - billing sync is background operation
    } finally {
      setIsSyncingBilling(false);
    }
  };

  const handleAddSeat = async () => {
    setIsAddingSeat(true);
    try {
      const { data, error } = await supabase.functions.invoke("add-seat-checkout", {
        body: { quantity: seatQuantity },
      });

      if (error) throw error;

      if (data.redirect) {
        // Seats were added directly to existing subscription
        toast.success(data.message);
        setShowAddSeatDialog(false);
        setSeatQuantity(1);
        await loadTeamMembers();
        // Navigate to trigger the invite dialog
        setIsDialogOpen(true);
      } else if (data.url) {
        // Need to go through Stripe checkout
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error adding seat:", error);
      toast.error(error.message || "Failed to add seat");
    } finally {
      setIsAddingSeat(false);
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
                Team and role management is available on Professional and Custom plans.
                Upgrade your subscription to enable this feature.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => navigate("/upgrade")}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
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
          <div className="flex gap-2">
            {/* Add Seat Dialog */}
            <Dialog open={showAddSeatDialog} onOpenChange={setShowAddSeatDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Add Seat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Seat</DialogTitle>
                  <DialogDescription>
                    Purchase additional seats to invite more team members
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Alert className="bg-primary/5 border-primary/20">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      Each seat costs <strong>${SEAT_PRICING.monthlyPrice.toFixed(2)}/month</strong> or <strong>${SEAT_PRICING.annualPrice.toFixed(2)}/year</strong> (20% discount)
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Label htmlFor="seatQuantity">Number of Seats</Label>
                    <Select value={String(seatQuantity)} onValueChange={(value) => setSeatQuantity(Number(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 10].map((num) => (
                          <SelectItem key={num} value={String(num)}>{num} seat{num > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly cost:</span>
                      <span className="font-bold">${(seatQuantity * SEAT_PRICING.monthlyPrice).toFixed(2)}/mo</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddSeatDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddSeat} disabled={isAddingSeat}>
                    {isAddingSeat ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Purchase {seatQuantity} Seat{seatQuantity > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Invite Member Dialog */}
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
                {/* Pricing Note */}
                <Alert className="bg-primary/5 border-primary/20">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    This will add <strong>1 paid seat</strong> at <strong>${SEAT_PRICING.monthlyPrice.toFixed(2)}/month</strong> if accepted.
                  </AlertDescription>
                </Alert>
                
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
                  <div className="mt-2 p-3 bg-muted/50 rounded-md">
                    <p className="text-xs font-medium mb-2">This role can:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {inviteRole === "admin" && (
                        <>
                          <li>• Manage team members and roles</li>
                          <li>• Configure settings and integrations</li>
                          <li>• Full access to billing and plans</li>
                          <li>• Create and edit all data</li>
                        </>
                      )}
                      {inviteRole === "member" && (
                        <>
                          <li>• Create and edit invoices</li>
                          <li>• Manage debtors and contacts</li>
                          <li>• Create and manage AI workflows</li>
                          <li>• View reports and analytics</li>
                        </>
                      )}
                      {inviteRole === "viewer" && (
                        <>
                          <li>• View all invoices and debtors</li>
                          <li>• Access reports and analytics</li>
                          <li>• View AI workflows and drafts</li>
                          <li>• No ability to create or modify data</li>
                        </>
                      )}
                    </ul>
                  </div>
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
        </div>

        {/* Team Seats & Billing Summary */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Team Members & Seats
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Each additional active user is billed at <strong>${SEAT_PRICING.monthlyPrice.toFixed(2)} per month</strong>
                  </p>
                </div>
                <Badge variant="outline" className="text-sm">
                  {features?.plan_type.charAt(0).toUpperCase()}{features?.plan_type.slice(1)} Plan
                </Badge>
              </div>
              
              {/* Seat Count Summary */}
              {(() => {
                const activeMembers = teamMembers.filter(m => m.status === 'active');
                const ownerCount = activeMembers.filter(m => m.role === 'owner').length;
                const billableSeats = Math.max(0, activeMembers.length - ownerCount);
                const monthlyTotal = billableSeats * SEAT_PRICING.monthlyPrice;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-background rounded-lg border">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{activeMembers.length}</p>
                      <p className="text-xs text-muted-foreground">Active Users</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{billableSeats}</p>
                      <p className="text-xs text-muted-foreground">Billable Seats</p>
                      <p className="text-xs text-muted-foreground">(Owner is free)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">${monthlyTotal.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Est. Monthly</p>
                    </div>
                  </div>
                );
              })()}
              
              <Progress 
                value={(teamMembers.filter(m => m.role !== 'owner').length / ((features?.features as any)?.max_invited_users || 1)) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {teamMembers.filter(m => m.role !== 'owner').length} of {(features?.features as any)?.max_invited_users || 0} seats used
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""} in your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-[1fr,120px,120px,180px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                <div>Member</div>
                <div>Role</div>
                <div>Status</div>
                <div>Added</div>
              </div>
              
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col md:grid md:grid-cols-[1fr,120px,120px,180px] gap-4 items-start md:items-center p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      {getRoleIcon(member.role)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.profiles?.name || member.profiles?.email || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.profiles?.email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {member.role !== "owner" && features?.features.can_manage_roles ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleChangeRole(member.user_id, value as AppRole)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {member.role !== "owner" ? (
                      <>
                        {member.status === "active" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReassignDialog(member)}
                              disabled={isReassigning}
                              className="text-primary border-primary/30 hover:bg-primary/10"
                            >
                              <ArrowRightLeft className="h-3 w-3 mr-1" />
                              Reassign
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDeactivateDialog(member)}
                              disabled={isTogglingStatus}
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Deactivate
                            </Button>
                          </>
                        )}
                        {member.status === "disabled" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleReactivateMember(member.user_id)}
                            disabled={isTogglingStatus}
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Reactivate
                          </Button>
                        )}
                        {member.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReassignDialog(member)}
                            disabled={isReassigning}
                            className="text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                            Reassign
                          </Button>
                        )}
                        {member.status === "reassigned" && (
                          <Badge variant="outline" className="text-muted-foreground">Reassigned</Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                    {member.status === "disabled" && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {member.status === "pending" && (
                      <Badge variant="secondary">Invited</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {new Date(member.invited_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Deactivate Confirmation Dialog */}
            <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate Team Member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deactivating <strong>{memberToDeactivate?.profiles?.name || memberToDeactivate?.profiles?.email}</strong> will:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-3 py-2">
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Remove their access to your account
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Reduce your billable seats by 1
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Prorate your next invoice automatically
                    </li>
                    <li className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      Can be reactivated anytime
                    </li>
                  </ul>
                  
                  {assignedTasksCount > 0 && (
                    <div className="space-y-3 pt-2">
                      <Alert className="bg-warning/10 border-warning/30">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <AlertDescription>
                          This member has <strong>{assignedTasksCount}</strong> assigned task(s). Choose what to do with them:
                        </AlertDescription>
                      </Alert>
                      
                      <div className="space-y-2">
                        <Label>Reassign tasks to</Label>
                        <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Leave unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Leave unassigned</SelectItem>
                            {teamMembers
                              .filter(m => m.user_id !== memberToDeactivate?.user_id && m.status === 'active')
                              .map((m) => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                  {m.profiles?.name || m.profiles?.email}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
                
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isTogglingStatus}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeactivateMember}
                    disabled={isTogglingStatus}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isTogglingStatus ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deactivating...
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4 mr-2" />
                        Deactivate Member
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reassign Seat Dialog */}
            <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-primary" />
                    Reassign Seat
                  </DialogTitle>
                  <DialogDescription>
                    Transfer this seat to a new email address. Billing remains active.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <Alert className="bg-primary/5 border-primary/20">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <strong>No billing changes.</strong> The seat will remain active and transfer to the new user.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                    <p className="text-xs text-muted-foreground">Current user:</p>
                    <p className="font-medium">
                      {memberToReassign?.profiles?.name || memberToReassign?.profiles?.email || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground">{memberToReassign?.profiles?.email}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reassignEmail">New Email Address</Label>
                    <Input
                      id="reassignEmail"
                      type="email"
                      placeholder="newuser@example.com"
                      value={reassignEmail}
                      onChange={(e) => setReassignEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      An invitation will be sent if this user doesn't have an account.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                    <p className="text-sm text-warning-foreground">
                      <strong>Note:</strong> The current user will lose access immediately. Any assigned tasks will be unassigned.
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowReassignDialog(false)} disabled={isReassigning}>
                    Cancel
                  </Button>
                  <Button onClick={handleReassignSeat} disabled={isReassigning || !reassignEmail}>
                    {isReassigning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reassigning...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Reassign Seat
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Billing Info Footer */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Active users: {teamMembers.filter(m => m.status === 'active' && m.role !== 'owner').length} — 
                  Billed at ${SEAT_PRICING.monthlyPrice.toFixed(2)}/user/month
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={syncBilling}
                  disabled={isSyncingBilling}
                  className="text-xs"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isSyncingBilling ? 'animate-spin' : ''}`} />
                  Sync Billing
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Deactivated members don't count toward billing. Reactivate them anytime.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Permissions Matrix</CardTitle>
            <CardDescription>Detailed breakdown of what each role can do</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Permission</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Shield className="h-4 w-4" />
                      Owner
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Lock className="h-4 w-4" />
                      Admin
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <User className="h-4 w-4" />
                      Member
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />
                      Viewer
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Manage Billing & Plans</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Manage Team Members</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Configure Settings & Integrations</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Create & Edit Invoices</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Manage Debtors</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Create & Manage AI Workflows</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Approve & Send AI Drafts</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Assign & Manage Tasks</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><X className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Be Assigned to Tasks</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">View Reports & Analytics</TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                  <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-success" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Team;