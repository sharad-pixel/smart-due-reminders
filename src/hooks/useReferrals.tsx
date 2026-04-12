import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Referral {
  id: string;
  referral_code: string;
  referred_email: string | null;
  status: string;
  channel: string;
  created_at: string;
  completed_at: string | null;
}

interface ReferralCredit {
  id: string;
  credits_amount: number;
  credits_used: number;
  plan_at_referral: string | null;
  expires_at: string;
  created_at: string;
}

interface UseReferralsReturn {
  referrals: Referral[];
  credits: ReferralCredit[];
  referralCode: string | null;
  totalCreditsEarned: number;
  availableCredits: number;
  loading: boolean;
  sendEmailInvite: (email: string) => Promise<boolean | 'already_exists'>;
  generateShareLink: () => string;
  refresh: () => Promise<void>;
}

export function useReferrals(): UseReferralsReturn {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [credits, setCredits] = useState<ReferralCredit[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Generate or get referral code
      const { data: codeData } = await supabase.rpc('generate_referral_code', { p_user_id: user.id });
      
      if (codeData) {
        setReferralCode(codeData as string);
        
        // Check if a referral entry exists with this code, if not create one
        const { data: existingRef } = await supabase
          .from('referrals')
          .select('id')
          .eq('referrer_id', user.id)
          .eq('referral_code', codeData as string)
          .maybeSingle();
        
        if (!existingRef) {
          await supabase.from('referrals').insert({
            referrer_id: user.id,
            referral_code: codeData as string,
            channel: 'link',
          });
        }
      }

      // Fetch all referrals
      const { data: refs } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      setReferrals((refs || []) as Referral[]);

      // Fetch credits
      const { data: creds } = await supabase
        .from('referral_credits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setCredits((creds || []) as ReferralCredit[]);
    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendEmailInvite = async (email: string): Promise<boolean | 'already_exists'> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !referralCode) return false;

      const normalizedEmail = email.toLowerCase().trim();

      // Check if this email already has an account
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        return 'already_exists';
      }

      // Create referral record for this email
      const { error } = await supabase.from('referrals').insert({
        referrer_id: user.id,
        referral_code: referralCode,
        referred_email: normalizedEmail,
        channel: 'email',
      });

      // Duplicate key is fine - they already invited this person
      if (error && !error.message.includes('duplicate')) {
        console.error('Error creating referral:', error);
        return false;
      }

      // Send the invite email via edge function
      const siteUrl = window.location.origin;
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, company_name')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.functions.invoke('send-referral-invite', {
        body: {
          email: normalizedEmail,
          referralCode,
          referrerName: profile?.name || 'A Recouply user',
          referrerCompany: profile?.company_name || '',
          signupLink: `${siteUrl}/signup?ref=${referralCode}`,
        },
      });

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error sending referral invite:', err);
      return false;
    }
  };

  const generateShareLink = () => {
    const siteUrl = window.location.origin;
    return `${siteUrl}/signup?ref=${referralCode}`;
  };

  const totalCreditsEarned = credits.reduce((sum, c) => sum + c.credits_amount, 0);
  const availableCredits = credits
    .filter(c => new Date(c.expires_at) > new Date() && c.credits_used < c.credits_amount)
    .reduce((sum, c) => sum + (c.credits_amount - c.credits_used), 0);

  return {
    referrals,
    credits,
    referralCode,
    totalCreditsEarned,
    availableCredits,
    loading,
    sendEmailInvite,
    generateShareLink,
    refresh: fetchData,
  };
}
