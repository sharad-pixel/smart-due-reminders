import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Users,
  Activity,
  Database,
  Mail,
  Shield,
  BarChart3,
  Settings,
  AlertTriangle,
  Home,
  Zap,
  CreditCard,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { useFounderAuth } from "@/hooks/useFounderAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: Home },
  { path: "/admin/user-management", label: "User Management", icon: Users },
  { path: "/admin/activity", label: "Activity Logs", icon: Activity },
  { path: "/admin/analytics", label: "Platform Analytics", icon: BarChart3 },
  { path: "/admin/waitlist", label: "Waitlist", icon: Mail },
  { path: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { path: "/admin/edge-functions", label: "Edge Functions", icon: Zap },
  { path: "/admin/database", label: "Database Health", icon: Database },
  { path: "/admin/security", label: "Security Center", icon: Shield },
  { path: "/admin/system", label: "System Config", icon: Settings },
];

export const AdminLayout = ({ children, title, description }: AdminLayoutProps) => {
  const { isFounder, loading, founderProfile } = useFounderAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-64 bg-card border-r border-border p-4">
          <Skeleton className="h-8 w-32 mb-8" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!isFounder) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Sidebar toggle for desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo / Brand */}
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-destructive" />
            <span className="font-bold text-foreground hidden sm:inline">Admin Center</span>
            <Badge variant="destructive" className="text-[10px] h-5">INTERNAL</Badge>
          </div>

          {/* Search */}
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users, logs..."
              className="pl-9 w-64 h-9 bg-muted/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Actions */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
          </Button>

          {/* Back to App */}
          <Button variant="outline" size="sm" asChild className="hidden sm:flex">
            <Link to="/dashboard">
              <ExternalLink className="h-4 w-4 mr-2" />
              Back to App
            </Link>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">SC</span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{founderProfile?.name || "Founder"}</p>
                  <p className="text-xs text-muted-foreground">Admin</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{founderProfile?.name}</span>
                  <span className="text-xs text-muted-foreground font-normal">{founderProfile?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/dashboard">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Back to App
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "bg-card border-r border-border flex flex-col transition-all duration-300 z-40",
            // Mobile styles
            "fixed lg:relative inset-y-0 left-0 top-14 lg:top-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            // Desktop width
            sidebarOpen ? "w-64" : "lg:w-16"
          )}
        >
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    !sidebarOpen && "lg:justify-center lg:px-2"
                  )}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn(!sidebarOpen && "lg:hidden")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className={cn("p-4 border-t border-border", !sidebarOpen && "lg:hidden")}>
            <div className="flex items-center gap-2 text-destructive text-xs font-medium">
              <AlertTriangle className="h-3 w-3" />
              RESTRICTED ACCESS
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <header className="bg-card/50 border-b border-border px-6 py-4">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};