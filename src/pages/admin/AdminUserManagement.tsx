import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import AdminAccountsHierarchy from "@/components/admin/AdminAccountsHierarchy";
import { Search, UserX, UserCheck, Shield, ShieldOff, Loader2, Download, Eye, Users, TrendingUp, AlertTriangle, CheckCircle, MoreHorizontal, FileText, Building2, Calendar, DollarSign, RefreshCw, Filter, ChevronLeft, ChevronRight, Trash2, Ban, UserPlus } from "lucide-react";
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
  subscription_status: string | null;
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
  // Onboarding
  onboarding_pct?: number;
  onboarding_completed?: number;
  onboarding_total?: number;
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
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [_deleteDialogOpen, _setDeleteDialogOpen] = useState(false); // kept for compat
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userDetailData, setUserDetailData] = useState<UserDetailData | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [scheduledDeleteDialogOpen, setScheduledDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"immediate" | "scheduled">("scheduled");
  const [deleteReason, setDeleteReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeView, setActiveView] = useState<"users" | "accounts">("users");
  const pageSize = 15;

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
      toast.error(error?.message ? `Failed to load users: ${error.message}` : "Failed to load users");
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

      // Automatically schedule deletion for suspended users (24hr notice)
      const legalNotice = generateLegalNoticeText(selectedUser.email, selectedUser.name);
      const adminUser = (await supabase.auth.getUser()).data.user;
      
      await supabase.from("scheduled_deletions").insert({
        user_id: selectedUser.id,
        user_email: selectedUser.email,
        user_name: selectedUser.name,
        scheduled_by: adminUser?.id,
        reason: suspendReason || "Account suspended — automatic deletion scheduled",
        legal_notice_text: legalNotice,
      });

      // Send deletion notice email
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: selectedUser.email,
            subject: "Important: Your Recouply.ai Account Has Been Suspended & Scheduled for Deletion",
            html: generateDeletionNoticeEmail(selectedUser.email, selectedUser.name),
          },
        });
      } catch (emailErr) {
        console.warn("Could not send deletion notice email:", emailErr);
      }

      // Notify support@recouply.ai about suspension + scheduled deletion
      try {
        const adminUser = (await supabase.auth.getUser()).data.user;
        await supabase.functions.invoke("send-email", {
          body: {
            to: "support@recouply.ai",
            subject: `[Admin Action] User Suspended & Deletion Scheduled: ${selectedUser.email}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#dc2626;">⚠️ User Suspended &amp; Deletion Scheduled</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">User</td><td style="padding:8px;border-bottom:1px solid #eee;">${selectedUser.name || "—"} (${selectedUser.email})</td></tr>
                <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">User ID</td><td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${selectedUser.id}</td></tr>
                <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Initiated By</td><td style="padding:8px;border-bottom:1px solid #eee;">${adminUser?.email || "Unknown Admin"}</td></tr>
                <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Action</td><td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626;font-weight:700;">Suspended + Auto-Deletion (24hr)</td></tr>
                <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Reason</td><td style="padding:8px;border-bottom:1px solid #eee;">${suspendReason || "No reason provided"}</td></tr>
                <tr><td style="padding:8px;font-weight:600;">Deletion Date</td><td style="padding:8px;">${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
              </table>
              <p style="color:#71717a;font-size:12px;margin-top:20px;">This is an automated notification from the Recouply.ai admin panel.</p>
            </div>`,
          },
        });
      } catch (supportEmailErr) {
        console.warn("Could not send support notification:", supportEmailErr);
      }

      // Create in-app notification
      await supabase.from("user_notifications").insert({
        user_id: selectedUser.id,
        type: "account_deletion_scheduled",
        title: "⚠️ Account Suspended & Deletion Scheduled",
        message: "Your account has been suspended and is scheduled for permanent deletion in 24 hours. All data will be permanently removed. Contact support immediately if you believe this is an error.",
        severity: "critical",
      }).then(() => {});

      toast.success(`User ${selectedUser.email} suspended. Deletion auto-scheduled in 24 hours.`);
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
    setDeleteReason("");
    setDeleteMode("scheduled");
    setScheduledDeleteDialogOpen(true);
  };

  const handleScheduledDelete = async () => {
    if (!selectedUser || deleteConfirmEmail !== selectedUser.email) return;

    setActionLoading(selectedUser.id);
    try {
      if (deleteMode === "immediate") {
        const { error } = await supabase.functions.invoke("delete-user", {
          body: { userId: selectedUser.id, reason: deleteReason || "Immediate deletion by admin" },
        });
        if (error) throw error;
        // Notify support for immediate deletions too
        try {
          const adminUser = (await supabase.auth.getUser()).data.user;
          await supabase.functions.invoke("send-email", {
            body: {
              to: "support@recouply.ai",
              subject: `[Admin Action] User IMMEDIATELY Deleted: ${selectedUser.email}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#dc2626;">⚡ Immediate User Deletion</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">User</td><td style="padding:8px;border-bottom:1px solid #eee;">${selectedUser.name || "—"} (${selectedUser.email})</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">User ID</td><td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${selectedUser.id}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Initiated By</td><td style="padding:8px;border-bottom:1px solid #eee;">${adminUser?.email || "Unknown Admin"}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Mode</td><td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626;font-weight:700;">IMMEDIATE</td></tr>
                  <tr><td style="padding:8px;font-weight:600;">Reason</td><td style="padding:8px;">${deleteReason || "No reason provided"}</td></tr>
                </table>
                <p style="color:#71717a;font-size:12px;margin-top:20px;">This is an automated notification from the Recouply.ai admin panel.</p>
              </div>`,
            },
          });
        } catch (supportEmailErr) {
          console.warn("Could not send support notification:", supportEmailErr);
        }
        toast.success(`User ${selectedUser.email} has been permanently deleted`);
      } else {
        const legalNotice = generateLegalNoticeText(selectedUser.email, selectedUser.name);
        
        // Insert scheduled deletion record
        const { error: schedError } = await supabase.from("scheduled_deletions").insert({
          user_id: selectedUser.id,
          user_email: selectedUser.email,
          user_name: selectedUser.name,
          scheduled_by: (await supabase.auth.getUser()).data.user?.id,
          reason: deleteReason || "Account deletion requested by administrator",
          legal_notice_text: legalNotice,
        });
        if (schedError) throw schedError;

        // Send notice email to user
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: selectedUser.email,
              subject: "Important: Your Recouply.ai Account Scheduled for Deletion",
              html: generateDeletionNoticeEmail(selectedUser.email, selectedUser.name),
            },
          });
        } catch (emailErr) {
          console.warn("Could not send deletion notice email:", emailErr);
        }

        // Create user notification
        await supabase.from("user_notifications").insert({
          user_id: selectedUser.id,
          type: "account_deletion_scheduled",
          title: "⚠️ Account Deletion Scheduled",
          message: "Your account has been scheduled for permanent deletion in 24 hours. All data will be permanently removed. Contact support immediately if this was not requested.",
          severity: "critical",
        });
        // Ignore notification insert errors

        // Notify support@recouply.ai
        try {
          const adminUser = (await supabase.auth.getUser()).data.user;
          await supabase.functions.invoke("send-email", {
            body: {
              to: "support@recouply.ai",
              subject: `[Admin Action] Account Deletion Scheduled: ${selectedUser.email}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#dc2626;">Account Deletion Scheduled</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">User</td><td style="padding:8px;border-bottom:1px solid #eee;">${selectedUser.name || "—"} (${selectedUser.email})</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">User ID</td><td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${selectedUser.id}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Initiated By</td><td style="padding:8px;border-bottom:1px solid #eee;">${adminUser?.email || "Unknown Admin"}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Mode</td><td style="padding:8px;border-bottom:1px solid #eee;">Scheduled (24hr notice)</td></tr>
                  <tr><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">Reason</td><td style="padding:8px;border-bottom:1px solid #eee;">${deleteReason || "No reason provided"}</td></tr>
                  <tr><td style="padding:8px;font-weight:600;">Deletion Date</td><td style="padding:8px;">${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
                </table>
                <p style="color:#71717a;font-size:12px;margin-top:20px;">This is an automated notification from the Recouply.ai admin panel.</p>
              </div>`,
            },
          });
        } catch (supportEmailErr) {
          console.warn("Could not send support notification:", supportEmailErr);
        }

        toast.success(`Deletion notice sent to ${selectedUser.email}. Account will be deleted in 24 hours.`);
      }

      setScheduledDeleteDialogOpen(false);
      await fetchUsers();
      await fetchStats();
    } catch (error: any) {
      console.error("Error scheduling deletion:", error);
      toast.error(error.message || "Failed to schedule deletion");
    } finally {
      setActionLoading(null);
    }
  };

  const _handleCancelScheduledDeletion = async (deletionId: string) => {
    try {
      const adminUser = (await supabase.auth.getUser()).data.user;
      await supabase.from("scheduled_deletions").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: adminUser?.id,
        cancellation_reason: "Cancelled by admin",
        updated_at: new Date().toISOString(),
      }).eq("id", deletionId);
      toast.success("Scheduled deletion has been cancelled");
      await fetchUsers();
    } catch (_error: any) {
      toast.error("Failed to cancel deletion");
    }
  };

  const generateLegalNoticeText = (email: string, name: string | null) => {
    return `ACCOUNT DELETION NOTICE

To: ${name || email}
Email: ${email}
Date of Notice: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
Effective Deletion Date: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} (24 hours from notice)

PLEASE READ CAREFULLY:

This notice confirms that your Recouply.ai account has been scheduled for permanent deletion. This action was initiated by an authorized administrator of the platform.

WHAT WILL BE DELETED:
Upon the effective deletion date, the following data will be permanently and irreversibly removed:
- All account profile information and settings
- All invoices, payment records, and financial data
- All accounts/debtors and contact information
- All uploaded documents and files
- All collection activities, tasks, and workflows
- All AI-generated drafts, communications, and logs
- All team memberships and organizational data
- All branding configurations and email settings
- All audit logs and activity history associated with this account

DATA RETENTION:
In accordance with our data retention policy and applicable privacy regulations (including GDPR and CCPA), once deletion is executed:
- No copies of your data will be retained on our servers
- Backups containing your data will be purged within 30 days
- This action is IRREVERSIBLE and cannot be undone

YOUR RIGHTS:
- You may request cancellation of this deletion by contacting support@recouply.ai before the effective deletion date
- You may request a data export before deletion by contacting support
- If you believe this deletion was made in error, contact support immediately

LEGAL BASIS:
This deletion is performed under the authority granted to platform administrators per the Recouply.ai Terms of Service (Section 9 - Account Termination) and in compliance with applicable data protection regulations.

© ${new Date().getFullYear()} RecouplyAI Inc. All rights reserved.
Delaware, USA`;
  };

  const generateDeletionNoticeEmail = (email: string, name: string | null) => {
    const deletionDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#dc2626;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">⚠️ Account Deletion Notice</h1>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;color:#18181b;">Dear ${name || email},</p>
    <p style="font-size:15px;color:#3f3f46;line-height:1.6;">
      This email confirms that your <strong>Recouply.ai</strong> account has been scheduled for 
      <strong style="color:#dc2626;">permanent deletion</strong>.
    </p>
    
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#dc2626;font-size:15px;">🕐 Deletion Scheduled For:</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#991b1b;">
        ${deletionDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} 
        at ${deletionDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
      </p>
    </div>

    <h3 style="color:#18181b;margin:24px 0 12px;">What Will Be Permanently Deleted:</h3>
    <ul style="color:#3f3f46;font-size:14px;line-height:2;padding-left:20px;">
      <li>All account profile information and settings</li>
      <li>All invoices, payment records, and financial data</li>
      <li>All accounts/debtors and contact information</li>
      <li>All uploaded documents and files</li>
      <li>All collection activities, tasks, and AI workflows</li>
      <li>All team memberships and organizational data</li>
      <li>All branding, email configurations, and audit logs</li>
    </ul>

    <div style="background:#fffbeb;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">
        ⚠️ This action is IRREVERSIBLE. Once executed, your data cannot be recovered.
      </p>
    </div>

    <h3 style="color:#18181b;margin:24px 0 12px;">Your Rights:</h3>
    <ul style="color:#3f3f46;font-size:14px;line-height:2;padding-left:20px;">
      <li>You may request cancellation by contacting <a href="mailto:support@recouply.ai" style="color:#2563eb;">support@recouply.ai</a> before the deletion date</li>
      <li>You may request a full data export before deletion</li>
      <li>If you believe this was made in error, contact support immediately</li>
    </ul>

    <div style="border-top:1px solid #e4e4e7;margin-top:32px;padding-top:20px;">
      <p style="font-size:12px;color:#71717a;line-height:1.6;">
        <strong>Legal Notice:</strong> This deletion is performed under the authority granted to platform 
        administrators per the Recouply.ai Terms of Service (Section 9 — Account Termination) and in 
        compliance with applicable data protection regulations including GDPR (Article 17 — Right to Erasure) 
        and CCPA. No copies of your data will be retained on our servers after deletion. Backups will be 
        purged within 30 days of the deletion date.
      </p>
      <p style="font-size:12px;color:#a1a1aa;margin-top:16px;">
        © ${new Date().getFullYear()} RecouplyAI Inc. All rights reserved. Delaware, USA.
      </p>
    </div>
  </div>
</div>
</div>
</body>
</html>`;
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
              u.plans?.name || (u.plan_type && u.plan_type !== 'free' ? u.plan_type.replace('_', ' ') : "Free"),
              u.is_blocked ? "Blocked" : u.is_suspended ? "Suspended" : (u.subscription_status || "Inactive"),
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

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeView === "accounts" ? "default" : "outline"}
          onClick={() => setActiveView("accounts")}
          className="flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          Account Hierarchy
        </Button>
        <Button
          variant={activeView === "users" ? "default" : "outline"}
          onClick={() => setActiveView("users")}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          All Users
        </Button>
      </div>

      {/* Account Hierarchy View */}
      {activeView === "accounts" && <AdminAccountsHierarchy />}

      {/* Users Table View */}
      {activeView === "users" && (
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
                      <TableHead>Onboarding</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow
                          key={user.id}
                          className={`cursor-pointer ${user.is_suspended ? "bg-destructive/5" : ""}`}
                          onClick={() => navigate(`/admin/users/${user.id}`)}
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
                              {user.plans?.name || (user.plan_type && user.plan_type !== 'free' ? user.plan_type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Free")}
                            </Badge>
                            {(user.plans?.monthly_price || (user.plan_type && user.plan_type !== 'free')) && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {user.plans?.monthly_price ? `$${user.plans.monthly_price}/mo` : ''}
                              </div>
                            )}
                          </TableCell>
                          {/* Onboarding Progress */}
                          <TableCell>
                            <div className="w-24">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`text-xs font-semibold ${
                                  (user.onboarding_pct ?? 0) === 100 ? 'text-green-600' :
                                  (user.onboarding_pct ?? 0) >= 50 ? 'text-amber-600' :
                                  'text-destructive'
                                }`}>
                                  {user.onboarding_pct ?? 0}%
                                </span>
                                {(user.onboarding_pct ?? 0) === 100 && (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                )}
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    (user.onboarding_pct ?? 0) === 100 ? 'bg-green-500' :
                                    (user.onboarding_pct ?? 0) >= 50 ? 'bg-amber-500' :
                                    'bg-destructive'
                                  }`}
                                  style={{ width: `${user.onboarding_pct ?? 0}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {user.onboarding_completed ?? 0}/{user.onboarding_total ?? 6} steps
                              </div>
                            </div>
                          </TableCell>
                          {/* Usage Stats */}
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">{user.debtor_count ?? 0}</span>
                                <span className="text-muted-foreground">accounts</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">{user.invoice_count ?? 0}</span>
                                <span className="text-muted-foreground">invoices</span>
                              </div>
                            </div>
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
                            ) : user.subscription_status === 'active' ? (
                              <Badge variant="outline" className="border-green-500 text-green-600">
                                Active
                              </Badge>
                            ) : user.subscription_status === 'trialing' ? (
                              <div>
                                <Badge variant="outline" className="border-blue-500 text-blue-600">
                                  Trial
                                </Badge>
                                {user.trial_ends_at && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Ends {formatDate(new Date(user.trial_ends_at), "MMM d")}
                                  </div>
                                )}
                              </div>
                            ) : user.subscription_status === 'past_due' ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-600">
                                Past Due
                              </Badge>
                            ) : user.subscription_status === 'canceled' ? (
                              <Badge variant="outline" className="border-red-400 text-red-500">
                                Canceled
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                                {user.subscription_status || 'Inactive'}
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
                            {user.last_login ? (
                              <div>
                                <div className="text-sm">
                                  {formatDate(new Date(user.last_login), "MMM d, yyyy")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(new Date(user.last_login), "h:mm a")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Never</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.is_suspended && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteClick(user)}
                                  disabled={actionLoading === user.id}
                                  className="gap-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              )}
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
                            </div>
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
      )}

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
                      {selectedUser.is_blocked ? (
                        <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Blocked</Badge>
                      ) : selectedUser.is_suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : selectedUser.subscription_status === 'active' ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">Active</Badge>
                      ) : selectedUser.subscription_status === 'trialing' ? (
                        <Badge variant="outline" className="border-blue-500 text-blue-600">Trial</Badge>
                      ) : selectedUser.subscription_status === 'past_due' ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">Past Due</Badge>
                      ) : selectedUser.subscription_status === 'canceled' ? (
                        <Badge variant="outline" className="border-red-400 text-red-500">Canceled</Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                          {selectedUser.subscription_status || 'Inactive'}
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
                    <p className="text-sm font-medium">{selectedUser.plans?.name || (selectedUser.plan_type && selectedUser.plan_type !== 'free' ? selectedUser.plan_type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Free")}</p>
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
              {/* Danger Zone - Delete Account */}
              <div className="mt-6 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Danger Zone
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permanently delete this user and all associated data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      handleDeleteClick(selectedUser);
                    }}
                    disabled={actionLoading === selectedUser.id}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </div>

                {/* Preview of deletion notice */}
                <details className="mt-3">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    📄 Preview deletion notice that will be sent
                  </summary>
                  <div className="mt-2 p-3 bg-background rounded border text-xs text-muted-foreground max-h-48 overflow-y-auto space-y-2">
                    <div className="p-3 bg-destructive/10 rounded text-center mb-2">
                      <p className="font-bold text-destructive text-sm">⚠️ Account Deletion Notice</p>
                    </div>
                    <p>Dear <strong>{selectedUser.name || selectedUser.email}</strong>,</p>
                    <p>This email confirms that your <strong>Recouply.ai</strong> account has been scheduled for <strong className="text-destructive">permanent deletion</strong>.</p>
                    <p className="font-semibold mt-2">🕐 Deletion Scheduled For:</p>
                    <p className="font-bold">
                      {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                    <p className="font-semibold mt-2">DATA TO BE PERMANENTLY DELETED:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>All account profile information and settings</li>
                      <li>All invoices, payment records, and financial data</li>
                      <li>All accounts/debtors and contact information</li>
                      <li>All uploaded documents and files</li>
                      <li>All collection activities, tasks, and AI workflows</li>
                      <li>All team memberships and organizational data</li>
                      <li>All branding, email configurations, and audit logs</li>
                    </ul>
                    <p className="font-semibold mt-2">YOUR RIGHTS:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>Contact support@recouply.ai to cancel before effective date</li>
                      <li>Request a data export before deletion</li>
                    </ul>
                    <p className="font-semibold mt-2">LEGAL BASIS:</p>
                    <p>Performed under Recouply.ai Terms of Service (Section 9) in compliance with GDPR (Article 17) and CCPA. No data copies retained; backups purged within 30 days.</p>
                    <p className="mt-2 text-center">© {new Date().getFullYear()} RecouplyAI Inc.</p>
                  </div>
                </details>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Scheduled/Immediate Delete User Dialog */}
      <Dialog open={scheduledDeleteDialogOpen} onOpenChange={setScheduledDeleteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              Schedule or immediately delete <strong>{selectedUser?.email}</strong> and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Deletion Mode */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Deletion Mode</Label>
              <Select value={deleteMode} onValueChange={(v: "immediate" | "scheduled") => setDeleteMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">📋 Schedule Deletion (24-hour notice)</SelectItem>
                  <SelectItem value="immediate">⚡ Delete Immediately</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deleteMode === "scheduled" && (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">📧 24-Hour Notice Period</p>
                <p className="text-xs text-muted-foreground">
                  The user will receive an email notification with full legal terms detailing that their account 
                  and all associated data will be permanently deleted in 24 hours. After the notice period expires, 
                  deletion is performed automatically.
                </p>
              </div>
            )}

            {deleteMode === "immediate" && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-1">⚠️ Immediate & Irreversible</p>
                <p className="text-xs text-muted-foreground">
                  The user and ALL data will be permanently deleted right now without any notice period.
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason for Deletion</Label>
              <Textarea
                placeholder="e.g., User requested account deletion, Terms of Service violation..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={2}
              />
            </div>

            {/* Legal Terms Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Legal Terms (included in notice)</Label>
              <div className="p-3 bg-muted rounded-lg border text-xs text-muted-foreground max-h-40 overflow-y-auto space-y-2">
                <p className="font-semibold text-foreground">ACCOUNT DELETION NOTICE</p>
                <p>This notice confirms that the account associated with <strong>{selectedUser?.email}</strong> has been scheduled for permanent deletion.</p>
                <p className="font-semibold mt-2">DATA TO BE PERMANENTLY DELETED:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>All account profile information and settings</li>
                  <li>All invoices, payment records, and financial data</li>
                  <li>All accounts/debtors and contact information</li>
                  <li>All uploaded documents and files</li>
                  <li>All collection activities, tasks, and AI workflows</li>
                  <li>All team memberships and organizational data</li>
                  <li>All branding, email configurations, and audit logs</li>
                </ul>
                <p className="font-semibold mt-2">LEGAL BASIS:</p>
                <p>Performed under Recouply.ai Terms of Service (Section 9 — Account Termination) in compliance with GDPR (Article 17 — Right to Erasure) and CCPA. No data copies retained after deletion; backups purged within 30 days.</p>
                <p className="mt-1">© {new Date().getFullYear()} RecouplyAI Inc. All rights reserved.</p>
              </div>
            </div>

            {/* Confirm Email */}
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
            <Button variant="outline" onClick={() => setScheduledDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleScheduledDelete}
              disabled={actionLoading === selectedUser?.id || deleteConfirmEmail !== selectedUser?.email}
            >
              {actionLoading === selectedUser?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {deleteMode === "scheduled" ? "Send Notice & Schedule Deletion" : "Delete Permanently Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUserManagement;
