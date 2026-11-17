import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useProgramHubAccess } from "@/hooks/useProgramHubAccess";

export function ProgramHubGuard({ children }: { children: React.ReactNode }) {
  const { hasAccess, loading } = useProgramHubAccess();
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!hasAccess) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
