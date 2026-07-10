import { useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";
import { NavProfileAvatar } from "@/components/layout/NavProfileAvatar";
import { OnboardingProgressRing } from "@/components/layout/OnboardingProgressRing";
import { CreditsWalletBadge } from "@/components/billing/CreditsWalletBadge";
import { AlertNotifications } from "@/components/alerts/AlertNotifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  FileSignature,
  Library,
  ShieldAlert,
  Workflow,
  Inbox,
  CheckSquare,
  Mail,
  CalendarDays,
  Bell,
  BarChart3,
  Users,
  Database,
  Sparkles,
  User as UserIcon,
  Settings,
  Palette,
  Wallet,
  Shield,
  FolderOpen,
  LogOut,
  ServerCog,
  Building2,
  Gift,
  LineChart as LineChartIcon,
  Plug,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface AppSidebarProps {
  userName: string;
  avatarUrl: string | null;
  showRing: boolean;
  onboardingPct: number;
  alertUnreadCount: number;
  showTeam: boolean;
  isFounder: boolean;
  displayPlanType: string;
  displaySubscriptionStatus: string;
  isTeamMember: boolean;
  memberRole: string | null;
  ownerCompanyName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  canUpgrade: boolean;
  onOpenSmartIngestion: () => void;
  onSignOut: () => void;
}

export function AppSidebar(props: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const revenueHub: NavItem[] = useMemo(() => [
    { path: "/hub", label: "Revenue Hub", icon: Sparkles },
    { path: "/dashboard", label: "Overview", icon: LayoutDashboard },
  ], []);

  const collectionIntel: NavItem[] = useMemo(() => [
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/payments", label: "Payments", icon: DollarSign },
    { path: "/ar-aging", label: "AR Aging", icon: BarChart3 },
  ], []);

  const contractIntel: NavItem[] = useMemo(() => [
    { path: "/contracts", label: "Contracts", icon: FileSignature },
    { path: "/revenue-library", label: "Revenue Library", icon: Library },
    { path: "/revenue-risk", label: "Revenue Risk", icon: ShieldAlert },
  ], []);

  const aiTools: NavItem[] = useMemo(() => [
    { path: "/settings/ai-workflows", label: "AI Workflows", icon: Workflow },
    { path: "/inbound", label: "Inbound AI", icon: Inbox },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/outreach-history", label: "Outreach History", icon: Mail },
    { path: "/daily-digest", label: "Daily Digest", icon: CalendarDays },
    { path: "/alerts", label: "Alerts", icon: Bell, badge: props.alertUnreadCount },
    { path: "/reports/email-delivery", label: "Email Delivery", icon: BarChart3 },
  ], [props.alertUnreadCount]);

  const dataItems: NavItem[] = useMemo(() => [
    { path: "/debtors", label: "Accounts", icon: Users },
    { path: "/data-center", label: "Data Center", icon: Database },
  ], []);

  const analyticsItems: NavItem[] = useMemo(() => [
    { path: "/dashboards", label: "Dashboards", icon: LayoutDashboard },
    { path: "/reports", label: "Reports", icon: LineChartIcon },
  ], []);

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.path + item.label}>
        <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
          <NavLink to={item.path} className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <NavLink to="/hub" className="flex items-center gap-2 hover:opacity-80">
            <RecouplyLogo size="sm" />
          </NavLink>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Revenue Hub</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{revenueHub.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Collection Intelligence</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{collectionIntel.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Contract Intelligence</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{contractIntel.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>AI Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={props.onOpenSmartIngestion}
                  tooltip="AI Smart Ingestion"
                >
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">AI Smart Ingestion</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {aiTools.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{dataItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{analyticsItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => window.dispatchEvent(new Event("open-referral-modal"))}
                  tooltip="Invite & Earn"
                >
                  <Gift className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">Invite & Earn</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && (
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <CreditsWalletBadge />
            <AlertNotifications />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2 h-auto py-2"
            >
              {props.showRing ? (
                <OnboardingProgressRing percentage={props.onboardingPct}>
                  <NavProfileAvatar avatarUrl={props.avatarUrl} userName={props.userName} size="sm" />
                </OnboardingProgressRing>
              ) : (
                <NavProfileAvatar avatarUrl={props.avatarUrl} userName={props.userName} size="sm" />
              )}
              {!collapsed && (
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-medium truncate max-w-full">{props.userName}</span>
                  <span className="text-[11px] text-muted-foreground capitalize truncate max-w-full">
                    {props.displayPlanType} · {props.displaySubscriptionStatus || "free"}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64 z-[100]">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {props.isTeamMember && props.ownerCompanyName && (
              <>
                <div className="px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {props.ownerCompanyName}
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    Connected via {props.ownerName || props.ownerEmail}
                  </p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/documents")}>
              <FolderOpen className="mr-2 h-4 w-4" /> Documents
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/branding")}>
              <Palette className="mr-2 h-4 w-4" /> Branding
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/billing")}>
              <Wallet className="mr-2 h-4 w-4" /> Wallet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/security")}>
              <Shield className="mr-2 h-4 w-4" /> Security
            </DropdownMenuItem>
            {props.canUpgrade && props.displayPlanType === "free" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/upgrade")}>
                  <Sparkles className="mr-2 h-4 w-4 text-primary" /> Upgrade Plan
                </DropdownMenuItem>
              </>
            )}
            {(props.showTeam || props.isFounder) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Administration
                </DropdownMenuLabel>
                {props.showTeam && (
                  <DropdownMenuItem onClick={() => navigate("/team")}>
                    <Users className="mr-2 h-4 w-4" /> Team & Roles
                  </DropdownMenuItem>
                )}
                {props.isFounder && (
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="text-destructive focus:text-destructive"
                  >
                    <ServerCog className="mr-2 h-4 w-4" /> Admin Center
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={props.onSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
