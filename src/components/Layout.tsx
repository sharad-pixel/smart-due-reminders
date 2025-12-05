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
  CalendarDays
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
import { DigestNotificationBanner } from "@/components/DigestNotificationBanner";
import { logAuditEvent } from "@/lib/auditLog";
import recouplyLogo from "@/assets/recouply-logo.png";
import NicolasChat from "@/components/NicolasChat";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>("free");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [accessChecked, setAccessChecked] = useState(false);

  const checkEarlyAccess = async (userEmail: string, userId: string) => {
    try {
      // Check if user is admin first
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (profile?.is_admin) {
        setAccessChecked(true);
        return true;
      }

      // Check whitelist
      const { data: whitelistEntry } = await supabase
        .from('early_access_whitelist')
        .select('id, used_at')
        .ilike('email', userEmail)
        .maybeSingle();

      if (!whitelistEntry) {
        toast.error(
          "Your email is not on the early access list. Please request an invite to join.",
          { duration: 6000 }
        );
        await supabase.auth.signOut();
        navigate("/login");
        return false;
      }

      // Mark as used if not already
      if (!whitelistEntry.used_at) {
        await supabase
          .from('early_access_whitelist')
          .update({ used_at: new Date().toISOString() })
          .eq('id', whitelistEntry.id);
      }

      setAccessChecked(true);
      return true;
    } catch (error) {
      console.error('Error checking early access:', error);
      setAccessChecked(true);
      return true; // Allow access on error to prevent lockouts
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setAccessChecked(false);
        navigate("/login");
      } else if (session.user.email) {
        // Check early access for all logins (including OAuth)
        await checkEarlyAccess(session.user.email, session.user.id);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setAccessChecked(false);
        navigate("/login");
      } else if (session.user.email) {
        await checkEarlyAccess(session.user.email, session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email, avatar_url, stripe_subscription_id, plan_type")
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

        if (profile?.stripe_subscription_id) {
          setSubscriptionStatus("Active");
        } else {
          setSubscriptionStatus(null);
        }

        if (profile?.plan_type) {
          setPlanType(profile.plan_type);
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

  if (!user || !accessChecked) return null;

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
    { path: "/daily-digest", label: "Daily Digest", icon: CalendarDays },
  ];

  const adminItems = [
    ...(showTeam ? [
      { path: "/team", label: "Team & Roles", icon: Users },
      { path: "/security", label: "Security Dashboard", icon: Shield }
    ] : []),
  ];

  const mainNavItems = [...coreNavItems, ...aiToolsItems, ...adminItems];

  const isAnyAIToolActive = aiToolsItems.some(item => isActive(item.path));
  const isAnyAdminActive = adminItems.some(item => isActive(item.path));

  return (
    <div className="min-h-screen bg-background">
      <SecurityAlert />
      <DigestNotificationBanner />
      <nav className="fixed top-0 left-0 right-0 z-[100] border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm safe-top">
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
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  Recouply.ai
                </h1>
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
                      return (
                        <DropdownMenuItem key={item.path} asChild>
                          <Link
                            to={item.path}
                            className={`flex items-center gap-2 cursor-pointer ${
                              isActive(item.path) ? "bg-accent" : ""
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Admin Dropdown */}
                {adminItems.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={`flex items-center gap-1.5 px-3 py-2 h-auto text-sm font-medium ${
                          isAnyAdminActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        <span>Admin</span>
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 z-[110] bg-card border shadow-lg">
                      {adminItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem key={item.path} asChild>
                            <Link
                              to={item.path}
                              className={`flex items-center gap-2 cursor-pointer ${
                                isActive(item.path) ? "bg-accent" : ""
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarUrl || undefined} alt={userName} />
                      <AvatarFallback>
                        {userName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline-block text-sm">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 sm:w-80 bg-card border shadow-lg z-[100]">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-3 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Plan:</span>
                        <span className="font-medium capitalize">{planType}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        {subscriptionStatus ? (
                          <span className="text-green-600 font-medium">{subscriptionStatus}</span>
                        ) : (
                          <span className="text-muted-foreground">No Subscription</span>
                        )}
                      </div>
                    </div>
                    <UsageIndicator />
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
                  <DropdownMenuItem onClick={() => navigate("/security-settings")}>
                    <Shield className="mr-2 h-4 w-4" />
                    Security Settings
                  </DropdownMenuItem>
                  
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
              {mainNavItems.map((item) => {
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
      <div className="h-16 sm:h-20"></div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
      <NicolasChat />
    </div>
  );
};

export default Layout;
