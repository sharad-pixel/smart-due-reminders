import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Download,
  Users,
  UserX,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Calendar,
  TrendingDown,
  Mail,
  Copy,
  MessageSquare,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format as formatDate, differenceInDays } from "date-fns";
import { reEngagementTemplates, hydrateTemplate, FounderMessage } from "@/lib/founderMessaging";

interface StaleUser {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  created_at: string;
  subscription_status: string | null;
  plan_type: string | null;
  stripe_subscription_id: string | null;
  last_sign_in_at: string | null;
  has_invoices: boolean;
  has_debtors: boolean;
}

interface StaleStats {
  total: number;
  noInvoices: number;
  noDebtors: number;
  partialEngagement: number;
  totalProfiles: number;
}

const PAGE_SIZE = 25;

const ReEngagementTemplatePanel = ({ user }: { user: StaleUser | null }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<FounderMessage | null>(null);
  const daysSinceSignup = user ? differenceInDays(new Date(), new Date(user.created_at)) : 0;

  // Auto-select best template based on inactivity
  const recommendedTemplates = useMemo(() => {
    return reEngagementTemplates.map((t) => {
      const isRecommended =
        (t.daysInactiveMin === undefined || daysSinceSignup >= t.daysInactiveMin) &&
        (t.daysInactiveMax === undefined || daysSinceSignup <= t.daysInactiveMax);
      return { ...t, isRecommended };
    });
  }, [daysSinceSignup]);

  const getHydratedBody = (template: FounderMessage) => {
    return hydrateTemplate(template.body, {
      name: user?.name || user?.email?.split("@")[0] || "there",
    });
  };

  const getHydratedSubject = (template: FounderMessage) => {
    return hydrateTemplate(template.subject || "", {
      name: user?.name || user?.email?.split("@")[0] || "there",
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Re-Engagement Templates</h3>
        <Badge variant="outline" className="text-xs ml-auto">
          {daysSinceSignup} days inactive
        </Badge>
      </div>

      <div className="grid gap-2">
        {recommendedTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              selectedTemplate?.id === template.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{template.title}</span>
              {template.isRecommended && (
                <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">
                  Recommended
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {template.targetAudience}
            </p>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <div className="space-y-3 mt-4 p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Preview</h4>
            <div className="flex gap-1">
              {selectedTemplate.subject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(getHydratedSubject(selectedTemplate), "Subject")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Subject
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(getHydratedBody(selectedTemplate), "Body")}
              >
                <Copy className="h-3 w-3 mr-1" />
                Body
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const full = selectedTemplate.subject
                    ? `Subject: ${getHydratedSubject(selectedTemplate)}\n\n${getHydratedBody(selectedTemplate)}`
                    : getHydratedBody(selectedTemplate);
                  copyToClipboard(full, "Full message");
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                All
              </Button>
            </div>
          </div>

          {selectedTemplate.subject && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
              <p className="text-sm font-medium text-foreground">{getHydratedSubject(selectedTemplate)}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Body:</p>
            <div className="text-sm text-foreground whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto">
              {getHydratedBody(selectedTemplate)}
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              <Mail className="h-3 w-3 inline mr-1" />
              Send to: {user.email}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminStaleUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<StaleUser[]>([]);
  const [stats, setStats] = useState<StaleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [daysInactive, setDaysInactive] = useState("7");
  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<StaleUser | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const fetchStaleUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-stale-users", {
        body: { daysInactive: parseInt(daysInactive) },
      });

      if (error) throw error;

      setUsers(data?.staleUsers || []);
      setStats(data?.stats || null);
      setCurrentPage(0);
    } catch (error: any) {
      console.error("Error fetching stale users:", error);
      toast.error("Failed to load stale users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaleUsers();
  }, [daysInactive]);

  const filteredUsers = useMemo(() => {
    let result = users;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.email?.toLowerCase().includes(s) ||
          u.name?.toLowerCase().includes(s) ||
          u.company_name?.toLowerCase().includes(s)
      );
    }

    if (engagementFilter === "zero") {
      result = result.filter((u) => !u.has_invoices && !u.has_debtors);
    } else if (engagementFilter === "partial") {
      result = result.filter((u) => u.has_debtors && !u.has_invoices);
    } else if (engagementFilter === "never_logged_in") {
      result = result.filter((u) => !u.last_sign_in_at);
    }

    return result;
  }, [users, search, engagementFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const exportCSV = () => {
    const csv = [
      ["Email", "Name", "Company", "Signed Up", "Last Login", "Has Debtors", "Has Invoices", "Plan"].join(","),
      ...filteredUsers.map((u) =>
        [
          u.email,
          u.name || "",
          u.company_name || "",
          u.created_at,
          u.last_sign_in_at || "Never",
          u.has_debtors ? "Yes" : "No",
          u.has_invoices ? "Yes" : "No",
          u.plan_type || "Free",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stale-users-${formatDate(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getEngagementBadge = (user: StaleUser) => {
    if (!user.has_debtors && !user.has_invoices) {
      return (
        <Badge variant="destructive" className="text-xs">
          Zero Activity
        </Badge>
      );
    }
    if (user.has_debtors && !user.has_invoices) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
          Partial
        </Badge>
      );
    }
    return null;
  };

  const getDaysSinceSignup = (createdAt: string) => {
    return differenceInDays(new Date(), new Date(createdAt));
  };

  const handleOpenTemplates = (user: StaleUser, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setTemplateModalOpen(true);
  };

  return (
    <AdminLayout title="Stale Users" description="Users who signed up but haven't engaged with the product">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Stale Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.noDebtors || 0}</p>
                <p className="text-xs text-muted-foreground">Zero Activity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.partialEngagement || 0}</p>
                <p className="text-xs text-muted-foreground">Partial Engagement</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalProfiles || 0}</p>
                <p className="text-xs text-muted-foreground">Total Profiles Checked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Inactive Users</CardTitle>
              <CardDescription>
                Users who signed up {daysInactive}+ days ago with no invoices uploaded
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }}
                  className="pl-9 w-48"
                />
              </div>
              <Select value={daysInactive} onValueChange={(v) => setDaysInactive(v)}>
                <SelectTrigger className="w-36">
                  <Calendar className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3+ days</SelectItem>
                  <SelectItem value="7">7+ days</SelectItem>
                  <SelectItem value="14">14+ days</SelectItem>
                  <SelectItem value="30">30+ days</SelectItem>
                  <SelectItem value="60">60+ days</SelectItem>
                  <SelectItem value="90">90+ days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={engagementFilter} onValueChange={(v) => { setEngagementFilter(v); setCurrentPage(0); }}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stale</SelectItem>
                  <SelectItem value="zero">Zero Activity</SelectItem>
                  <SelectItem value="partial">Partial Only</SelectItem>
                  <SelectItem value="never_logged_in">Never Logged In</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchStaleUsers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" size="icon" onClick={exportCSV} disabled={filteredUsers.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              No stale users found for the selected criteria
            </p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Signed Up</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name || "—"}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{user.company_name || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(new Date(user.created_at), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getDaysSinceSignup(user.created_at)} days ago
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at ? (
                            <div>
                              <div className="text-sm">
                                {formatDate(new Date(user.last_sign_in_at), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {differenceInDays(new Date(), new Date(user.last_sign_in_at))} days ago
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs border-destructive text-destructive">
                              Never
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getEngagementBadge(user)}</TableCell>
                        <TableCell>
                          <Badge variant={user.stripe_subscription_id ? "default" : "outline"} className="text-xs">
                            {user.plan_type || "Free"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Re-engagement templates"
                              onClick={(e) => handleOpenTemplates(user, e)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/users/${user.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {currentPage * PAGE_SIZE + 1} to{" "}
                  {Math.min((currentPage + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
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

      {/* Re-Engagement Template Modal */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Re-Engage {selectedUser?.name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              Founder pre-drafted messages with Recouply.ai branding. Select a template, preview, and copy.
            </DialogDescription>
          </DialogHeader>
          <ReEngagementTemplatePanel user={selectedUser} />
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminStaleUsers;
