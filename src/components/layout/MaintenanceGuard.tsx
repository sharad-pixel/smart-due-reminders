import { ReactNode, useEffect, useState } from 'react';
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
  // Allow all admin routes
  if (pathname.startsWith('/admin')) return true;
  return ALLOWED_ROUTES.some(route => pathname === route);
};

export const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkMaintenanceAndAdmin = async () => {
      try {
        // Check maintenance mode
        const { data: configData } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        const maintenanceEnabled = configData?.value === true || configData?.value === 'true';
        setIsMaintenanceMode(maintenanceEnabled);

        // If maintenance is enabled, check if current user is admin
        if (maintenanceEnabled) {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Check if user is the founder/admin
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', user.id)
              .single();

            // Admin email check (founder email)
            const isFounder = profile?.email === 'sharad@recouply.ai';
            setIsAdmin(isFounder);
          }
        }
      } catch (err) {
        console.error('Error checking maintenance status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenanceAndAdmin();
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show maintenance page if:
  // - Maintenance mode is on
  // - User is not an admin
  // - Current route is not in the allowed list
  if (isMaintenanceMode && !isAdmin && !isAllowedRoute(location.pathname)) {
    return <Maintenance />;
  }

  return <>{children}</>;
};
