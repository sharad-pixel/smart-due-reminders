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
  Upload
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
import recouplyLogo from "@/assets/recouply-logo.png";

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
    { path: "/debtors", label: "Debtors", icon: Users },
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/collections/drafts", label: "AI Drafts", icon: Mail },
    { path: "/settings/ai-workflows", label: "AI Workflows", icon: Workflow },
    ...(showTeam ? [{ path: "/team", label: "Team & Roles", icon: Users }] : []),
    { path: "/profile", label: userName || "Profile", icon: UserIcon },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  if (!user) return null;

  const mainNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/debtors", label: "Debtors", icon: Users },
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/import/ar-aging", label: "Import AR", icon: Upload },
    { path: "/collections/drafts", label: "AI Drafts", icon: Mail },
    { path: "/tasks", label: "Tasks", icon: CheckSquare },
    { path: "/settings/ai-workflows", label: "AI Workflows", icon: Workflow },
    ...(showTeam ? [
      { path: "/team", label: "Team & Roles", icon: Users },
      { path: "/security", label: "Security Dashboard", icon: Shield }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SecurityAlert />
      <nav className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="shrink-0 hover:opacity-80 transition-opacity">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  Recouply.ai
                </h1>
              </Link>
              <div className="hidden lg:flex items-center gap-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive(item.path)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarUrl || undefined} alt={userName} />
                      <AvatarFallback>
                        {userName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline-block">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 bg-card border shadow-lg z-[100]">
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
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
