import { ReactNode } from "react";
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
  FileText,
  AlertTriangle,
  Home,
  Zap,
  CreditCard,
} from "lucide-react";
import { useFounderAuth } from "@/hooks/useFounderAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: Home },
  { path: "/admin/users", label: "User Management", icon: Users },
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-destructive" />
            <div>
              <h2 className="font-bold text-foreground">Admin Center</h2>
              <p className="text-xs text-muted-foreground">Recouply.ai Internal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">SC</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{founderProfile?.name || "Founder"}</p>
              <p className="text-xs text-muted-foreground truncate">{founderProfile?.email}</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-destructive text-xs font-medium mb-1">
            <AlertTriangle className="h-3 w-3" />
            INTERNAL ADMIN - RESTRICTED ACCESS
          </div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
};
