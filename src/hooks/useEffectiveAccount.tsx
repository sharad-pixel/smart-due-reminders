import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EffectiveAccountInfo {
  effectiveAccountId: string | null;
  isTeamMember: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  loading: boolean;
}

export const useEffectiveAccount = () => {
  const [accountInfo, setAccountInfo] = useState<EffectiveAccountInfo>({
    effectiveAccountId: null,
    isTeamMember: false,
    ownerName: null,
    ownerEmail: null,
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
            loading: false,
          });
          return;
        }

        const effectiveAccountId = effectiveData as string;
        const isTeamMember = effectiveAccountId !== user.id;

        if (isTeamMember) {
          // Get owner's profile info
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', effectiveAccountId)
            .single();

          setAccountInfo({
            effectiveAccountId,
            isTeamMember: true,
            ownerName: ownerProfile?.name || null,
            ownerEmail: ownerProfile?.email || null,
            loading: false,
          });
        } else {
          setAccountInfo({
            effectiveAccountId,
            isTeamMember: false,
            ownerName: null,
            ownerEmail: null,
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
