import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "owner" | "admin" | "member" | "viewer" | null;

export const useUserRole = () => {
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);
  const [canManageBilling, setCanManageBilling] = useState(false);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is a member of an account (team member)
      const { data: membership, error } = await supabase
        .from('account_users')
        .select('role, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" which is fine
        console.error('Error checking membership:', error);
      }

      if (!membership) {
        // No membership record = standalone owner managing their own account
        setRole('owner');
        setCanManageBilling(true);
      } else if (membership.status === 'active') {
        setRole(membership.role as AppRole);
        // Owner and Admin can manage billing
        setCanManageBilling(
          membership.role === 'owner' || membership.role === 'admin'
        );
      } else {
        setRole(membership.role as AppRole);
        setCanManageBilling(false);
      }
    } catch (error) {
      console.error('Error in useUserRole:', error);
    } finally {
      setLoading(false);
    }
  };

  return { role, loading, canManageBilling, refetch: checkUserRole };
};
