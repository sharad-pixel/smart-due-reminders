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
  ownerAvatarUrl: string | null;
  memberRole: string | null;
  loading: boolean;
  // Business profile fields from parent account
  ownerBusinessName: string | null;
  ownerBusinessPhone: string | null;
  ownerBusinessAddressLine1: string | null;
  ownerBusinessAddressLine2: string | null;
  ownerBusinessCity: string | null;
  ownerBusinessState: string | null;
  ownerBusinessPostalCode: string | null;
  ownerBusinessCountry: string | null;
  ownerStripePaymentLinkUrl: string | null;
  ownerLogoUrl: string | null;
  ownerFromName: string | null;
  ownerFromEmail: string | null;
  ownerReplyToEmail: string | null;
  ownerEmailSignature: string | null;
  ownerEmailFooter: string | null;
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
    ownerAvatarUrl: null,
    memberRole: null,
    loading: true,
    ownerBusinessName: null,
    ownerBusinessPhone: null,
    ownerBusinessAddressLine1: null,
    ownerBusinessAddressLine2: null,
    ownerBusinessCity: null,
    ownerBusinessState: null,
    ownerBusinessPostalCode: null,
    ownerBusinessCountry: null,
    ownerStripePaymentLinkUrl: null,
    ownerLogoUrl: null,
    ownerFromName: null,
    ownerFromEmail: null,
    ownerReplyToEmail: null,
    ownerEmailSignature: null,
    ownerEmailFooter: null,
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
          setAccountInfo(prev => ({
            ...prev,
            effectiveAccountId: user.id,
            isTeamMember: false,
            loading: false,
          }));
          return;
        }

        const effectiveAccountId = effectiveData as string;
        const isTeamMember = effectiveAccountId !== user.id;

        if (isTeamMember) {
          // Get owner's profile info including company, plan, business profile, and avatar
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select(`
              name, email, company_name, plan_type, subscription_status, avatar_url,
              business_name, business_phone, business_address_line1, business_address_line2,
              business_city, business_state, business_postal_code, business_country,
              stripe_payment_link_url
            `)
            .eq('id', effectiveAccountId)
            .single();
          
          // Get owner's branding settings
          const { data: brandingSettings } = await supabase
            .from('branding_settings')
            .select('logo_url, from_name, from_email, reply_to_email, email_signature, email_footer')
            .eq('user_id', effectiveAccountId)
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
            ownerAvatarUrl: ownerProfile?.avatar_url || null,
            memberRole: memberData?.role || null,
            loading: false,
            // Business profile from parent
            ownerBusinessName: ownerProfile?.business_name || null,
            ownerBusinessPhone: ownerProfile?.business_phone || null,
            ownerBusinessAddressLine1: ownerProfile?.business_address_line1 || null,
            ownerBusinessAddressLine2: ownerProfile?.business_address_line2 || null,
            ownerBusinessCity: ownerProfile?.business_city || null,
            ownerBusinessState: ownerProfile?.business_state || null,
            ownerBusinessPostalCode: ownerProfile?.business_postal_code || null,
            ownerBusinessCountry: ownerProfile?.business_country || null,
            ownerStripePaymentLinkUrl: ownerProfile?.stripe_payment_link_url || null,
            ownerLogoUrl: brandingSettings?.logo_url || null,
            ownerFromName: brandingSettings?.from_name || null,
            ownerFromEmail: brandingSettings?.from_email || null,
            ownerReplyToEmail: brandingSettings?.reply_to_email || null,
            ownerEmailSignature: brandingSettings?.email_signature || null,
            ownerEmailFooter: brandingSettings?.email_footer || null,
          });
        } else {
          // Non-team member (account owner) - fetch their own branding
          const { data: ownBranding } = await supabase
            .from('branding_settings')
            .select('logo_url, from_name, from_email, reply_to_email, email_signature, email_footer')
            .eq('user_id', effectiveAccountId)
            .single();

          setAccountInfo(prev => ({
            ...prev,
            effectiveAccountId,
            isTeamMember: false,
            ownerAvatarUrl: null,
            ownerLogoUrl: ownBranding?.logo_url || null,
            ownerFromName: ownBranding?.from_name || null,
            ownerFromEmail: ownBranding?.from_email || null,
            ownerReplyToEmail: ownBranding?.reply_to_email || null,
            ownerEmailSignature: ownBranding?.email_signature || null,
            ownerEmailFooter: ownBranding?.email_footer || null,
            loading: false,
          }));
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
