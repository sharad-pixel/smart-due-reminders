import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Mail
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);

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
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
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

    checkTeamAccess();
  }, [user]);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/debtors", label: "Debtors", icon: Users },
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/collections/drafts", label: "AI Drafts", icon: Mail },
    { path: "/settings/ai-workflows", label: "AI Workflows", icon: Workflow },
    ...(showTeam ? [{ path: "/team", label: "Team & Roles", icon: Users }] : []),
    { path: "/profile", label: "Profile", icon: UserIcon },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/dashboard" className="text-2xl font-bold text-primary">
                Recouply.ai
              </Link>
              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
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
