import { ReactNode, useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Maintenance from '@/pages/Maintenance';

interface MaintenanceGuardProps {
  children: ReactNode;
}

// Routes that should be accessible even during maintenance
const ALLOWED_ROUTES = [
  '/admin',
  '/admin/',
  '/login',
  '/signup',
];

// Check if current path starts with any allowed route
const isAllowedRoute = (pathname: string): boolean => {
  if (pathname.startsWith('/admin')) return true;
  return ALLOWED_ROUTES.some(route => pathname === route);
};

// Cache maintenance status to prevent blank flashes on route changes
const CACHE_DURATION_MS = 60 * 1000; // 1 minute

export const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const lastCheckedRef = useRef(0);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const now = Date.now();

    // After initial load, only re-check if cache has expired
    if (hasInitializedRef.current && (now - lastCheckedRef.current) < CACHE_DURATION_MS) {
      return;
    }

    const checkMaintenanceAndAdmin = async () => {
      // Only show loading spinner on first check, not subsequent route changes
      if (!hasInitializedRef.current) {
        setLoading(true);
      }

      try {
        const { data: configData } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        const maintenanceEnabled = configData?.value === true || configData?.value === 'true';
        setIsMaintenanceMode(maintenanceEnabled);

        if (maintenanceEnabled) {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', user.id)
              .single();

            const isFounder = profile?.email === 'sharad@recouply.ai';
            setIsAdmin(isFounder);
          }
        }
      } catch (err) {
        console.error('Error checking maintenance status:', err);
      } finally {
        setLoading(false);
        hasInitializedRef.current = true;
        lastCheckedRef.current = Date.now();
      }
    };

    checkMaintenanceAndAdmin();
  }, [location.pathname]);

  if (loading && !hasInitializedRef.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isMaintenanceMode && !isAdmin && !isAllowedRoute(location.pathname)) {
    return <Maintenance />;
  }

  return <>{children}</>;
};
