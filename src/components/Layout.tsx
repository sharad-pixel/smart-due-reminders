import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  User as UserIcon,
  Workflow,
  Mail,
  CheckSquare,
  Shield,
  FolderOpen,
  Menu,
  X,
  Inbox,
  ChevronDown,
  Bot,
  Database,
  CalendarDays,
  ServerCog,
  Building2,
  Palette,
  Bell,
  BarChart3,
  ShieldCheck,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UsageIndicator } from "@/components/UsageIndicator";
import { SecurityAlert } from "@/components/SecurityAlert";
import { logAuditEvent } from "@/lib/auditLog";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import NicolasChat from "@/components/NicolasChat";
import { NicolasPageTip } from "@/components/NicolasPageTip";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { NavProfileAvatar } from "@/components/NavProfileAvatar";
import { AlertNotifications } from "@/components/alerts/AlertNotifications";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import { RequireSubscription } from "@/components/RequireSubscription";
import { TrialBanner } from "@/components/TrialBanner";
import { AccountLockoutBanner } from "@/components/AccountLockoutBanner";


interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>("free");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const { unreadCount: alertUnreadCount } = useUserAlerts();
  const { 
    isTeamMember, 
    ownerName, 
    ownerEmail, 
    ownerCompanyName,
    ownerPlanType, 
    ownerSubscriptionStatus,
    memberRole,
    loading: accountLoading 
  } = useEffectiveAccount();
  
  // Use owner's plan for team members, with proper fallback
  const displayPlanType = isTeamMember ? (ownerPlanType || 'free') : planType;
  const displaySubscriptionStatus = isTeamMember ? (ownerSubscriptionStatus || 'inactive') : subscriptionStatus;
  const canUpgrade = !isTeamMember; // Only account owners can upgrade

  const FOUNDER_EMAIL = "sharad@recouply.ai";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      // Avoid redirecting to /login before we've completed the initial session check.
      // This prevents breaking OAuth callback flows where the session is established asynchronously.
      if (!session?.user && authChecked) {
        const publicPaths = ["/login", "/signup", "/auth", "/legal", "/pricing", "/features", "/about", "/integrations", "/contact", "/coming-soon"]; 
        const isPublic = publicPaths.some((p) => location.pathname === p || location.pathname.startsWith(p));
        if (!isPublic) {
          navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
      if (!session?.user) {
        const publicPaths = ["/login", "/signup", "/auth", "/legal", "/pricing", "/features", "/about", "/integrations", "/contact", "/coming-soon"]; 
        const isPublic = publicPaths.some((p) => location.pathname === p || location.pathname.startsWith(p));
        if (!isPublic) {
          navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, location.search, authChecked]);

  const handleSignOut = async () => {
    if (user) {
      await logAuditEvent({
        action: "logout",
        resourceType: "profile",
        resourceId: user.id,
        metadata: { timestamp: new Date().toISOString() }
      });
    }
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email, avatar_url, plan_type, subscription_status, is_admin")
          .eq("id", user.id)
          .single();

        if (profile?.name) {
          setUserName(profile.name);
        } else if (profile?.email) {
          setUserName(profile.email.split('@')[0]);
        } else if (user.email) {
          setUserName(user.email.split('@')[0]);
        }

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }

        // Use subscription_status from profile (set by sync-subscription)
        if (profile?.subscription_status && profile.subscription_status !== 'inactive') {
          setSubscriptionStatus(profile.subscription_status);
        } else {
          setSubscriptionStatus(null);
        }

        if (profile?.plan_type) {
          setPlanType(profile.plan_type);
        }

        // Check if user is founder (email match + is_admin flag)
        if (user.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase() && profile?.is_admin) {
          setIsFounder(true);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        // Fallback to email username
        if (user.email) {
          setUserName(user.email.split('@')[0]);
        }
      }
    };

    const checkTeamAccess = async () => {
      if (!user) return;
      
      try {
        // Check if user is owner or admin - they should always see team management
        const { data: membershipData } = await supabase
          .from("account_users")
          .select("role, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        // Show team for:
        // 1. Users with no membership (they're managing their own account as owner)
        // 2. Users with owner or admin role
        if (!membershipData || membershipData.role === "owner" || membershipData.role === "admin") {
          setShowTeam(true);
        }
      } catch (error) {
        console.error("Error checking team access:", error);
        // Default to showing team for standalone users
        setShowTeam(true);
      }
    };

    fetchUserProfile();
    checkTeamAccess();
  }, [user]);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/debtors", label: "Accounts", icon: Users },
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/settings/ai-workflows", label: "AI Workflows", icon: Workflow },
    ...(showTeam ? [{ path: "/team", label: "Team & Roles", icon: Users }] : []),
    { path: "/profile", label: userName || "Profile", icon: UserIcon },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const coreNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/debtors", label: "Accounts", icon: Users },
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/data-center", label: "Data Center", icon: Database },
  ];

  const aiToolsItems = [
    { path: "/settings/ai-workflows", label: "AI Workflows", icon: Workflow },
    { path: "/inbound", label: "Inbound AI", icon: Inbox },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/outreach-history", label: "Outreach History", icon: Mail },
    { path: "/daily-digest", label: "Daily Digest", icon: CalendarDays },
    { path: "/alerts", label: "Alerts", icon: Bell, badge: alertUnreadCount },
    { path: "/reports/email-delivery", label: "Email Delivery", icon: BarChart3 },
  ];

  // Mobile nav items - excludes admin/settings items since they're in user dropdown
  const mobileNavItems = [...coreNavItems, ...aiToolsItems];

  const isAnyAIToolActive = aiToolsItems.some(item => isActive(item.path));

  // Check if trial banner should be shown (trial or free plan users)
  const showTrialBanner = planType === 'free' || subscriptionStatus === 'trialing';

  // Check if lockout banner should be shown (for degraded subscription states)
  // This runs after accountLoading is complete to ensure proper status checking
  const getLockoutReason = (): 'past_due' | 'expired' | 'canceled' | 'locked' | null => {
    // Don't show banner while still loading account info
    if (accountLoading) return null;
    
    const status = displaySubscriptionStatus;
    
    // Check for explicit degraded states
    if (status === 'past_due') return 'past_due';
    if (status === 'canceled') return 'canceled';
    if (status === 'expired') return 'expired';
    
    // For team members, check if owner's subscription is inactive/missing
    if (isTeamMember && (!status || status === 'inactive')) return 'expired';
    
    // For account owners, check for inactive subscription (excluding free trial users)
    if (!isTeamMember && subscriptionStatus === 'inactive' && planType !== 'free') return 'expired';
    
    return null;
  };
  
  const lockoutReason = getLockoutReason();
  const showLockoutBanner = lockoutReason !== null;

  return (
    <RequireSubscription>
    <div className="min-h-screen bg-background">
      {/* Trial countdown banner - shown at top of page for trial users */}
      <TrialBanner />
      
      <nav className={`fixed left-0 right-0 z-[100] border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm safe-top ${showTrialBanner ? 'top-[40px]' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              
              <Link to="/dashboard" className="shrink-0 hover:opacity-80 transition-opacity">
                <RecouplyLogo size="md" />
              </Link>
              
              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1">
                {coreNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        isActive(item.path)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {/* AI Tools Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={`flex items-center gap-1.5 px-3 py-2 h-auto text-sm font-medium ${
                        isAnyAIToolActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Bot className="h-4 w-4 shrink-0" />
                      <span>AI Tools</span>
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 z-[110] bg-card border shadow-lg">
                    {aiToolsItems.map((item) => {
                      const Icon = item.icon;
                      const badge = 'badge' in item ? item.badge : undefined;
                      return (
                        <DropdownMenuItem key={item.path} asChild>
                          <Link
                            to={item.path}
                            className={`flex items-center justify-between cursor-pointer ${
                              isActive(item.path) ? "bg-accent" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </div>
                            {badge !== undefined && badge > 0 && (
                              <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                                {badge > 9 ? '9+' : badge}
                              </span>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <AlertNotifications />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2 p-1.5 rounded-full hover:bg-accent/50">
                    <NavProfileAvatar 
                      avatarUrl={avatarUrl} 
                      userName={userName}
                      size="md"
                    />
                    <span className="hidden md:inline-block text-sm pr-1">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 sm:w-80 bg-card border shadow-lg z-[100]">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-3 space-y-3">
                    {isTeamMember && ownerCompanyName && (
                      <div className="pb-2 border-b">
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">{ownerCompanyName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Connected via {ownerName || ownerEmail}
                        </p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Plan:</span>
                        <span className="font-medium capitalize">{displayPlanType}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        {displaySubscriptionStatus && displaySubscriptionStatus !== 'inactive' ? (
                          <span className="text-green-600 font-medium capitalize">{displaySubscriptionStatus}</span>
                        ) : (
                          <span className="text-muted-foreground">Free Plan</span>
                        )}
                      </div>
                      {isTeamMember && memberRole && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Your Role:</span>
                          <span className="font-medium capitalize">{memberRole}</span>
                        </div>
                      )}
                    </div>
                    <UsageIndicator />
                    {canUpgrade && displayPlanType === 'free' && (
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => navigate("/upgrade")}
                      >
                        Upgrade Plan
                      </Button>
                    )}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/documents")}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Documents
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/branding")}>
                    <Palette className="mr-2 h-4 w-4" />
                    Branding
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/security")}>
                    <Shield className="mr-2 h-4 w-4" />
                    Security Settings
                  </DropdownMenuItem>
                  
                  {/* Admin Section */}
                  {(showTeam || isFounder) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Administration</DropdownMenuLabel>
                      {showTeam && (
                        <>
                          <DropdownMenuItem onClick={() => navigate("/team")}>
                            <Users className="mr-2 h-4 w-4" />
                            Team & Roles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/security")}>
                            <Shield className="mr-2 h-4 w-4" />
                            Security Dashboard
                          </DropdownMenuItem>
                        </>
                      )}
                      {isFounder && (
                        <DropdownMenuItem 
                          onClick={() => navigate("/admin")}
                          className="text-destructive focus:text-destructive"
                        >
                          <ServerCog className="mr-2 h-4 w-4" />
                          Admin Center
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 space-y-1 border-t bg-card">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all tap-target ${
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
      {/* Spacer for fixed navbar + optional trial banner */}
      <div className={showTrialBanner ? "h-[104px] sm:h-[120px]" : "h-16 sm:h-20"}></div>
      
      {/* Banners - placed after nav spacer so they flow with content */}
      <SecurityAlert />
      
      {/* Lockout banner for degraded subscription states */}
      {showLockoutBanner && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <AccountLockoutBanner
            lockoutReason={lockoutReason}
            isTeamMember={isTeamMember}
            ownerEmail={ownerEmail}
            ownerName={ownerName}
          />
        </div>
      )}
      {/* Team Member Banner */}
      {isTeamMember && !accountLoading && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Viewing account of <span className="font-medium text-foreground">{ownerName || ownerEmail}</span>
            </span>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t bg-card/50 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RecouplyLogo size="sm" />
              <span className="text-muted-foreground text-sm">
                Collection Intelligence Platform
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link to="/legal/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/legal/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <a 
                href="mailto:support@recouply.ai" 
                className="hover:text-foreground transition-colors"
              >
                Support
              </a>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">Responsible AI</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Recouply.ai. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
      
      <OnboardingWelcome />
      <NicolasPageTip />
      <NicolasChat />
    </div>
    </RequireSubscription>
  );
};

export default Layout;
