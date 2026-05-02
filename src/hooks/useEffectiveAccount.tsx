import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateImpersonation } from "@/lib/supportImpersonation";

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
  ownerUserId: string | null;
  organizationId: string | null;
  organizationName: string | null;
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
    ownerUserId: null,
    organizationId: null,
    organizationName: null,
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
    let mounted = true;

    const fetchEffectiveAccount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (!user) {
          if (mounted) {
            setAccountInfo(prev => ({ ...prev, loading: false }));
          }
          return;
        }

        const { data: effectiveData, error: effectiveError } = await supabase
          .rpc('get_effective_account_id', { p_user_id: user.id });

        if (effectiveError) {
          console.error("Error getting effective account:", effectiveError);
          if (mounted) {
            setAccountInfo(prev => ({
              ...prev,
              effectiveAccountId: user.id,
              isTeamMember: false,
              loading: false,
            }));
          }
          return;
        }

        const effectiveAccountId = effectiveData as string;
        const isTeamMember = effectiveAccountId !== user.id;
        const { data: organizationId } = await supabase.rpc('get_user_organization_id', { p_user_id: effectiveAccountId || user.id });

        let organizationName: string | null = null;
        if (organizationId) {
          const { data: organization } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', organizationId)
            .maybeSingle();
          organizationName = organization?.name || null;
        }

        const { data: syncedSubscription } = await supabase.functions.invoke('sync-subscription');

        if (isTeamMember) {
          const [{ data: ownerInfoRows }, { data: brandingSettings }, { data: memberData }] = await Promise.all([
            supabase.rpc('get_owner_account_info', { p_account_id: effectiveAccountId }),
            supabase
              .from('branding_settings')
              .select('logo_url, from_name, from_email, reply_to_email, email_signature, email_footer')
              .eq('user_id', effectiveAccountId)
              .maybeSingle(),
            supabase
              .from('account_users')
              .select('role')
              .eq('user_id', user.id)
              .eq('account_id', effectiveAccountId)
              .eq('status', 'active')
              .maybeSingle(),
          ]);

          const ownerProfile = Array.isArray(ownerInfoRows) ? ownerInfoRows[0] : null;
          const resolvedPlanType = syncedSubscription?.plan_type || ownerProfile?.plan_type || null;
          const resolvedSubscriptionStatus = syncedSubscription?.subscription_status || ownerProfile?.subscription_status || null;

          if (mounted) {
            setAccountInfo({
              effectiveAccountId,
              isTeamMember: true,
              ownerName: ownerProfile?.name || null,
              ownerEmail: ownerProfile?.email || null,
              ownerCompanyName: ownerProfile?.company_name || null,
              ownerPlanType: resolvedPlanType,
              ownerSubscriptionStatus: resolvedSubscriptionStatus,
              ownerAvatarUrl: ownerProfile?.avatar_url || null,
              memberRole: memberData?.role || null,
              ownerUserId: ownerProfile?.id || effectiveAccountId,
              organizationId: organizationId || null,
              organizationName,
              loading: false,
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
          }
        } else {
          const { data: ownBranding } = await supabase
            .from('branding_settings')
            .select('logo_url, from_name, from_email, reply_to_email, email_signature, email_footer')
            .eq('user_id', effectiveAccountId)
            .maybeSingle();

          const resolvedPlanType = syncedSubscription?.plan_type || null;
          const resolvedSubscriptionStatus = syncedSubscription?.subscription_status || null;

          if (mounted) {
            setAccountInfo(prev => ({
              ...prev,
              effectiveAccountId,
              isTeamMember: false,
              ownerPlanType: resolvedPlanType,
              ownerSubscriptionStatus: resolvedSubscriptionStatus,
              ownerUserId: effectiveAccountId,
              organizationId: organizationId || null,
              organizationName,
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
        }
      } catch (error) {
        console.error("Error in useEffectiveAccount:", error);
        if (mounted) {
          setAccountInfo(prev => ({ ...prev, loading: false }));
        }
      }
    };

    fetchEffectiveAccount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchEffectiveAccount();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return accountInfo;
};
