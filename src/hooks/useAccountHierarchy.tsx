import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  AccountHierarchyData, 
  AccountMember, 
  AccountOwner, 
  UseAccountHierarchyReturn,
  getPermissionsForRole 
} from "@/types/account";

const defaultHierarchy: AccountHierarchyData = {
  effectiveAccountId: '',
  currentUserId: '',
  isAccountOwner: true,
  memberRole: null,
  parentAccount: null,
  members: [],
  billing: {
    planType: null,
    subscriptionStatus: null,
    billingInterval: null,
    billableSeats: 0,
    totalMembers: 0,
    activeMembers: 0,
    pendingInvites: 0,
    disabledMembers: 0,
  },
  permissions: getPermissionsForRole(null, true),
};

export const useAccountHierarchy = (): UseAccountHierarchyReturn => {
  const [hierarchy, setHierarchy] = useState<AccountHierarchyData>(defaultHierarchy);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHierarchy(defaultHierarchy);
        setLoading(false);
        return;
      }

      // Get effective account ID using the database function
      const { data: effectiveAccountId, error: effectiveError } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });

      if (effectiveError) {
        console.error("Error getting effective account:", effectiveError);
        throw effectiveError;
      }

      const accountId = effectiveAccountId as string;
      const isOwner = accountId === user.id;

      // Fetch all data in parallel for performance
      const [
        ownerProfileResult,
        accountUsersResult,
        currentMemberResult
      ] = await Promise.all([
        // Get owner's profile (parent account data)
        supabase
          .from('profiles')
          .select('id, name, email, company_name, avatar_url, plan_type, subscription_status, billing_interval, stripe_customer_id, stripe_subscription_id')
          .eq('id', accountId)
          .single(),
        
        // Get all account users
        supabase
          .from('account_users')
          .select('id, user_id, email, role, status, is_owner, accepted_at, invited_at')
          .eq('account_id', accountId),
        
        // Get current user's membership if they're a team member
        !isOwner ? supabase
          .from('account_users')
          .select('role, status')
          .eq('user_id', user.id)
          .eq('account_id', accountId)
          .eq('status', 'active')
          .single() : Promise.resolve({ data: null, error: null })
      ]);

      const ownerProfile = ownerProfileResult.data;
      const accountUsers = accountUsersResult.data || [];
      const currentMember = currentMemberResult.data;

      // Build parent account object
      const parentAccount: AccountOwner | null = ownerProfile ? {
        id: ownerProfile.id,
        name: ownerProfile.name,
        email: ownerProfile.email,
        companyName: ownerProfile.company_name,
        avatarUrl: ownerProfile.avatar_url,
        planType: ownerProfile.plan_type,
        subscriptionStatus: ownerProfile.subscription_status,
        billingInterval: ownerProfile.billing_interval,
        stripeCustomerId: ownerProfile.stripe_customer_id,
        stripeSubscriptionId: ownerProfile.stripe_subscription_id,
      } : null;

      // Fetch profiles for all users with user_ids
      const userIds = accountUsers
        .filter(au => au.user_id)
        .map(au => au.user_id as string);

      let profilesMap: Record<string, { name: string | null; email: string | null; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { name: p.name, email: p.email, avatar_url: p.avatar_url };
            return acc;
          }, {} as typeof profilesMap);
        }
      }

      // Build members array
      const members: AccountMember[] = accountUsers.map(au => ({
        id: au.id,
        userId: au.user_id,
        email: au.email,
        role: au.role as AccountMember['role'],
        status: au.status as AccountMember['status'],
        isOwner: au.is_owner || false,
        acceptedAt: au.accepted_at,
        invitedAt: au.invited_at,
        profile: au.user_id && profilesMap[au.user_id] ? {
          displayName: profilesMap[au.user_id].name,
          email: profilesMap[au.user_id].email,
          avatarUrl: profilesMap[au.user_id].avatar_url,
        } : null,
      }));

      // Calculate billing stats
      const activeMembers = members.filter(m => m.status === 'active').length;
      const pendingInvites = members.filter(m => m.status === 'pending').length;
      const disabledMembers = members.filter(m => m.status === 'disabled').length;
      const billableSeats = members.filter(m => !m.isOwner && m.status === 'active').length;

      // Determine current user's role
      const memberRole = isOwner 
        ? 'owner' 
        : (currentMember?.role as AccountMember['role'] || null);

      // Always use owner profile for billing info (whether viewing as owner or team member)
      const hierarchyData: AccountHierarchyData = {
        effectiveAccountId: accountId,
        currentUserId: user.id,
        isAccountOwner: isOwner,
        memberRole,
        parentAccount: isOwner ? null : parentAccount,
        members,
        billing: {
          planType: ownerProfile?.plan_type || null,
          subscriptionStatus: ownerProfile?.subscription_status || null,
          billingInterval: ownerProfile?.billing_interval || null,
          billableSeats,
          totalMembers: members.length,
          activeMembers,
          pendingInvites,
          disabledMembers,
        },
        permissions: getPermissionsForRole(memberRole, isOwner),
      };

      setHierarchy(hierarchyData);
    } catch (err) {
      console.error("Error fetching account hierarchy:", err);
      setError(err instanceof Error ? err.message : "Failed to load account hierarchy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return {
    ...hierarchy,
    loading,
    error,
    refresh: fetchHierarchy,
  };
};
