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
  ServerCog
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
  const [isFounder, setIsFounder] = useState(false);

  const FOUNDER_EMAIL = "sharad@recouply.ai";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/login");
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
          .select("name, email, avatar_url, stripe_subscription_id, plan_type, is_admin")
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
    { path: "/daily-digest", label: "Daily Digest", icon: CalendarDays },
  ];

  // Mobile nav items - excludes admin/settings items since they're in user dropdown
  const mobileNavItems = [...coreNavItems, ...aiToolsItems];

  const isAnyAIToolActive = aiToolsItems.some(item => isActive(item.path));

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
                          <span className="text-muted-foreground">Free Plan</span>
                        )}
                      </div>
                    </div>
                    <UsageIndicator />
                    {planType === 'free' && (
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
                  <DropdownMenuItem onClick={() => navigate("/security-settings")}>
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
      <div className="h-16 sm:h-20"></div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t bg-card/50 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Recouply.ai
              </span>
              <span className="text-muted-foreground text-sm">
                AI-Powered CashOps Platform
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
            </div>
            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Recouply.ai. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
      
      <NicolasChat />
    </div>
  );
};

export default Layout;
