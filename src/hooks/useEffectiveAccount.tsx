import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EffectiveAccountInfo {
  effectiveAccountId: string | null;
  isTeamMember: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerCompanyName: string | null;
  ownerPlanType: string | null;
  ownerSubscriptionStatus: string | null;
  memberRole: string | null;
  loading: boolean;
}

export const useEffectiveAccount = () => {
  const [accountInfo, setAccountInfo] = useState<EffectiveAccountInfo>({
    effectiveAccountId: null,
    isTeamMember: false,
    ownerName: null,
    ownerEmail: null,
    ownerCompanyName: null,
    ownerPlanType: null,
    ownerSubscriptionStatus: null,
    memberRole: null,
    loading: true,
  });

  useEffect(() => {
    const fetchEffectiveAccount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAccountInfo(prev => ({ ...prev, loading: false }));
          return;
        }

        // Get effective account ID using the database function
        const { data: effectiveData, error: effectiveError } = await supabase
          .rpc('get_effective_account_id', { p_user_id: user.id });

        if (effectiveError) {
          console.error("Error getting effective account:", effectiveError);
          // Fallback to user's own ID
          setAccountInfo({
            effectiveAccountId: user.id,
            isTeamMember: false,
            ownerName: null,
            ownerEmail: null,
            ownerCompanyName: null,
            ownerPlanType: null,
            ownerSubscriptionStatus: null,
            memberRole: null,
            loading: false,
          });
          return;
        }

        const effectiveAccountId = effectiveData as string;
        const isTeamMember = effectiveAccountId !== user.id;

        if (isTeamMember) {
          // Get owner's profile info including company and plan
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('name, email, company_name, plan_type, subscription_status')
            .eq('id', effectiveAccountId)
            .single();
          
          // Get user's role in the team
          const { data: memberData } = await supabase
            .from('account_users')
            .select('role')
            .eq('user_id', user.id)
            .eq('account_id', effectiveAccountId)
            .eq('status', 'active')
            .single();

          setAccountInfo({
            effectiveAccountId,
            isTeamMember: true,
            ownerName: ownerProfile?.name || null,
            ownerEmail: ownerProfile?.email || null,
            ownerCompanyName: ownerProfile?.company_name || null,
            ownerPlanType: ownerProfile?.plan_type || null,
            ownerSubscriptionStatus: ownerProfile?.subscription_status || null,
            memberRole: memberData?.role || null,
            loading: false,
          });
        } else {
          setAccountInfo({
            effectiveAccountId,
            isTeamMember: false,
            ownerName: null,
            ownerEmail: null,
            ownerCompanyName: null,
            ownerPlanType: null,
            ownerSubscriptionStatus: null,
            memberRole: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error("Error in useEffectiveAccount:", error);
        setAccountInfo(prev => ({ ...prev, loading: false }));
      }
    };

    fetchEffectiveAccount();
  }, []);

  return accountInfo;
};
