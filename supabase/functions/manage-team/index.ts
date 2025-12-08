import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * Enterprise-grade Team Management Edge Function
 * 
 * Handles all team member operations with Stripe seat billing sync.
 * 
 * Actions:
 * - invite: Invite a new team member
 * - deactivate: Disable a team member (reduces seat count)
 * - reactivate: Re-enable a disabled member (increases seat count)
 * - reassign: Transfer seat to new email (no billing change)
 * - resend_invite: Resend invitation email
 * - changeRole: Change member's role
 * - list: List all team members
 * - getAssignedTasksCount: Get count of assigned tasks
 * 
 * Invariants enforced:
 * - Owner row cannot be deactivated/reassigned/deleted
 * - Only owner/admin can manage team
 * - Seat count syncs to Stripe after activate/deactivate/reactivate
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Seat pricing configuration
const SEAT_PRICE_IDS = {
  month: 'price_1SbWueFaeMMSBqclnDqJkOQW',
  year: 'price_1SbWuuFaeMMSBqclX6xqgX9E',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-TEAM] ${step}${detailsStr}`);
};

interface TeamAction {
  action: 'invite' | 'deactivate' | 'reactivate' | 'reassign' | 'resend_invite' | 'changeRole' | 'list' | 'getAssignedTasksCount' | 'disable' | 'enable';
  email?: string;
  userId?: string;
  memberId?: string;
  role?: string;
  reassignTo?: string;
}

// Helper: Get billable seat count for an account
async function getBillableSeatCount(supabase: any, accountId: string): Promise<number> {
  const { data, error } = await supabase
    .from('account_users')
    .select('id', { count: 'exact' })
    .eq('account_id', accountId)
    .eq('is_owner', false)
    .eq('status', 'active');

  if (error) {
    logStep('Error getting seat count', { error });
    return 0;
  }
  return data?.length || 0;
}

// Helper: Update Stripe seat quantity
async function updateStripeSeatQuantity(
  supabase: any,
  accountId: string,
  seatCount: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    logStep('STRIPE_SECRET_KEY not configured');
    return { success: false, error: 'Stripe not configured' };
  }

  // Get account owner's subscription info
  const { data: ownerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_subscription_id, billing_interval')
    .eq('id', accountId)
    .single();

  if (profileError || !ownerProfile?.stripe_subscription_id) {
    logStep('No active subscription found', { accountId });
    return { success: true }; // Not an error, just no subscription to update
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
  const billingInterval = ownerProfile.billing_interval === 'year' ? 'year' : 'month';
  const seatPriceId = SEAT_PRICE_IDS[billingInterval];

  try {
    const subscription = await stripe.subscriptions.retrieve(ownerProfile.stripe_subscription_id);
    
    // Find seat line item
    const seatItem = subscription.items.data.find(
      (item: { price: { id: string } }) => 
        item.price.id === SEAT_PRICE_IDS.month || 
        item.price.id === SEAT_PRICE_IDS.year
    );

    const previousSeatCount = seatItem?.quantity || 0;

    if (seatItem) {
      if (seatCount === 0) {
        // Remove seat item if no billable seats
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        });
        logStep('Removed seat line item');
      } else if (seatItem.price.id !== seatPriceId) {
        // Price ID mismatch - swap for billing interval change
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        });
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: seatPriceId,
          quantity: seatCount,
          proration_behavior: 'create_prorations',
        });
        logStep('Swapped seat price', { from: seatItem.price.id, to: seatPriceId, quantity: seatCount });
      } else {
        // Update quantity
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: seatCount,
          proration_behavior: 'create_prorations',
        });
        logStep('Updated seat quantity', { from: previousSeatCount, to: seatCount });
      }
    } else if (seatCount > 0) {
      // Add new seat line item
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: seatPriceId,
        quantity: seatCount,
        proration_behavior: 'create_prorations',
      });
      logStep('Added seat line item', { quantity: seatCount });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action_type: 'seat_billing_sync',
      resource_type: 'subscription',
      resource_id: ownerProfile.stripe_subscription_id,
      old_values: { seat_count: previousSeatCount },
      new_values: { seat_count: seatCount, billing_interval: billingInterval },
      metadata: { account_id: accountId, action: 'team_management' },
    });

    return { success: true };
  } catch (error) {
    logStep('Stripe error', { error: error instanceof Error ? error.message : error });
    return { success: false, error: error instanceof Error ? error.message : 'Stripe update failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const user = userData.user;
    const body: TeamAction = await req.json();
    const { action, email, userId, memberId, role, reassignTo } = body;

    logStep('Action received', { action, userId: user.id });

    // Check if user has team features enabled
    const { data: effectiveFeatures } = await supabaseClient.functions.invoke(
      'get-effective-features',
      { headers: { Authorization: authHeader } }
    );

    if (!effectiveFeatures?.features?.can_have_team_users) {
      return new Response(
        JSON.stringify({
          error: true,
          code: 'FEATURE_NOT_AVAILABLE',
          message: 'Team and role management is available on Professional and Custom plans.',
          required_plan: 'Professional or Custom',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's membership to determine account context
    const { data: membershipCheck, error: membershipError } = await supabaseClient
      .from('account_users')
      .select('role, account_id, status, is_owner')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError && membershipError.code !== 'PGRST116') {
      logStep('Membership check error', { error: membershipError });
      throw membershipError;
    }

    // Validate caller has permission
    const isOwnerOrAdmin = membershipCheck && 
      (membershipCheck.role === 'owner' || membershipCheck.role === 'admin') && 
      membershipCheck.status === 'active';
    
    const isStandaloneOwner = !membershipCheck;

    if (!isOwnerOrAdmin && !isStandaloneOwner) {
      return new Response(
        JSON.stringify({ error: 'Only account owners and admins can manage team members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which account we're managing
    const managingAccountId = isStandaloneOwner ? user.id : membershipCheck!.account_id;
    let result: any;

    switch (action) {
      case 'invite': {
        // Check current team size
        const { count: currentTeamCount } = await supabaseClient
          .from('account_users')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', managingAccountId)
          .eq('is_owner', false)
          .neq('status', 'disabled');

        const maxInvitedUsers = effectiveFeatures?.features?.max_invited_users || 0;

        if (currentTeamCount !== null && currentTeamCount >= maxInvitedUsers) {
          return new Response(
            JSON.stringify({
              error: true,
              code: 'TEAM_LIMIT_REACHED',
              message: `You have reached the maximum of ${maxInvitedUsers} team members on your current plan.`,
              required_plan: 'Upgrade or contact support',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user exists
        const { data: existingUser } = await supabaseClient
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .maybeSingle();

        if (existingUser) {
          // Check if already a team member
          const { data: existingMember } = await supabaseClient
            .from('account_users')
            .select('id, status')
            .eq('account_id', managingAccountId)
            .eq('user_id', existingUser.id)
            .maybeSingle();

          if (existingMember) {
            return new Response(
              JSON.stringify({ error: 'This user is already a team member' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Add existing user to team (immediately active)
          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: existingUser.id,
              email: email,
              role: role || 'member',
              status: 'active',
              is_owner: false,
              accepted_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;

          // Sync billing - new active user
          const seatCount = await getBillableSeatCount(supabaseClient, managingAccountId);
          await updateStripeSeatQuantity(supabaseClient, managingAccountId, seatCount, user.id);

          result = { success: true, data, message: 'Team member added successfully' };
        } else {
          // Generate secure invite token
          logStep('Generating invite token for new user', { email });
          
          const { data: tokenData } = await supabaseClient.rpc('generate_invite_token');
          const inviteToken = tokenData as string;
          const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
          
          // Check for existing pending invite for this email
          const { data: existingPending } = await supabaseClient
            .from('account_users')
            .select('id')
            .eq('account_id', managingAccountId)
            .eq('email', email)
            .eq('status', 'pending')
            .maybeSingle();
          
          let accountUserEntry;
          
          if (existingPending) {
            // Update existing pending invite with new token
            const { data, error } = await supabaseClient
              .from('account_users')
              .update({
                invite_token: inviteToken,
                invite_expires_at: inviteExpiresAt,
                role: role || 'member',
                invited_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPending.id)
              .select()
              .single();
            
            if (error) throw error;
            accountUserEntry = data;
          } else {
            // Create pending account_users entry with invite token
            const { data, error } = await supabaseClient
              .from('account_users')
              .insert({
                account_id: managingAccountId,
                user_id: user.id, // Temporarily set to inviter, will be updated on acceptance
                email: email,
                role: role || 'member',
                status: 'pending',
                is_owner: false,
                invite_token: inviteToken,
                invite_expires_at: inviteExpiresAt,
              })
              .select()
              .single();

            if (error) throw error;
            accountUserEntry = data;
          }
          
          // Get inviter's profile for the email
          const { data: inviterProfile } = await supabaseClient
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .single();
          
          // Get account owner's name
          const { data: ownerProfile } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', managingAccountId)
            .single();
          
          // Send invite email via send-team-invite function
          try {
            await supabaseClient.functions.invoke('send-team-invite', {
              body: {
                email: email,
                role: role || 'member',
                inviterName: inviterProfile?.name || inviterProfile?.email || 'A team admin',
                accountOwnerName: ownerProfile?.name || 'your team',
                inviteToken: inviteToken,
              },
            });
            logStep('Invite email sent', { email });
          } catch (emailError) {
            logStep('Failed to send invite email', { error: emailError });
            // Don't fail the whole operation if email fails
          }

          result = { success: true, data: accountUserEntry, message: 'Invitation sent successfully' };
        }
        break;
      }

      case 'deactivate':
      case 'disable': {
        const targetUserId = userId || memberId;
        
        // Verify target is not owner
        const { data: targetMember } = await supabaseClient
          .from('account_users')
          .select('id, role, is_owner, status')
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .single();

        if (!targetMember) {
          return new Response(
            JSON.stringify({ error: 'Team member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (targetMember.is_owner || targetMember.role === 'owner') {
          return new Response(
            JSON.stringify({ error: 'Cannot deactivate the account owner' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Handle task reassignment
        if (reassignTo) {
          await supabaseClient
            .from('collection_tasks')
            .update({ assigned_to: reassignTo, updated_at: new Date().toISOString() })
            .eq('assigned_to', targetUserId)
            .in('status', ['open', 'in_progress']);
        } else {
          await supabaseClient
            .from('collection_tasks')
            .update({ assigned_to: null, updated_at: new Date().toISOString() })
            .eq('assigned_to', targetUserId)
            .in('status', ['open', 'in_progress']);
        }

        // Deactivate the member
        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ 
            status: 'disabled', 
            disabled_at: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .select()
          .single();

        if (error) throw error;

        // Sync billing - seat removed
        const seatCount = await getBillableSeatCount(supabaseClient, managingAccountId);
        await updateStripeSeatQuantity(supabaseClient, managingAccountId, seatCount, user.id);

        result = { success: true, data, message: 'Team member deactivated successfully', seatCount };
        break;
      }

      case 'reactivate':
      case 'enable': {
        const targetUserId = userId || memberId;

        // Verify target exists and is disabled
        const { data: targetMember } = await supabaseClient
          .from('account_users')
          .select('id, role, is_owner, status')
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .single();

        if (!targetMember) {
          return new Response(
            JSON.stringify({ error: 'Team member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Reactivate the member
        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ 
            status: 'active', 
            disabled_at: null,
            updated_at: new Date().toISOString() 
          })
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .select()
          .single();

        if (error) throw error;

        // Sync billing - seat added
        const seatCount = await getBillableSeatCount(supabaseClient, managingAccountId);
        await updateStripeSeatQuantity(supabaseClient, managingAccountId, seatCount, user.id);

        result = { success: true, data, message: 'Team member reactivated successfully', seatCount };
        break;
      }

      case 'reassign': {
        const targetUserId = userId || memberId;

        if (!email) {
          return new Response(
            JSON.stringify({ error: 'New email address is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current member
        const { data: currentMember, error: memberError } = await supabaseClient
          .from('account_users')
          .select('*, profiles!account_users_user_id_fkey (name, email)')
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .single();

        if (memberError || !currentMember) {
          return new Response(
            JSON.stringify({ error: 'Team member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (currentMember.is_owner || currentMember.role === 'owner') {
          return new Response(
            JSON.stringify({ error: 'Cannot reassign the owner seat' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if new email already exists in team
        const { data: existingMembers } = await supabaseClient
          .from('account_users')
          .select('id, user_id, email, profiles!account_users_user_id_fkey (email)')
          .eq('account_id', managingAccountId)
          .neq('status', 'reassigned');

        const emailExists = existingMembers?.some(
          (m: any) => 
            (m.email?.toLowerCase() === email.toLowerCase() || 
             m.profiles?.email?.toLowerCase() === email.toLowerCase()) && 
            m.user_id !== targetUserId
        );

        if (emailExists) {
          return new Response(
            JSON.stringify({ error: 'This email is already a team member' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // For pending invites, just update the email and resend with new token
        if (currentMember.status === 'pending') {
          // Generate new invite token
          const { data: tokenData } = await supabaseClient.rpc('generate_invite_token');
          const inviteToken = tokenData as string;
          const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          // Update email and token on the pending record
          await supabaseClient
            .from('account_users')
            .update({ 
              email: email, 
              invite_token: inviteToken,
              invite_expires_at: inviteExpiresAt,
              updated_at: new Date().toISOString() 
            })
            .eq('id', currentMember.id);

          // Get profiles for email
          const { data: inviterProfile } = await supabaseClient
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .single();
          
          const { data: ownerProfile } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', managingAccountId)
            .single();

          // Send invite email
          try {
            await supabaseClient.functions.invoke('send-team-invite', {
              body: {
                email: email,
                role: currentMember.role,
                inviterName: inviterProfile?.name || inviterProfile?.email || 'A team admin',
                accountOwnerName: ownerProfile?.name || 'your team',
                inviteToken: inviteToken,
              },
            });
          } catch (emailError) {
            logStep('Failed to send reassign invite email', { error: emailError });
          }

          result = { 
            success: true, 
            message: `Invitation reassigned to ${email}`,
            previousEmail: currentMember.email || currentMember.profiles?.email
          };
          break;
        }

        // For active/disabled members, mark old as reassigned and create new
        // Unassign tasks from old user
        await supabaseClient
          .from('collection_tasks')
          .update({ assigned_to: null, updated_at: new Date().toISOString() })
          .eq('assigned_to', targetUserId)
          .in('status', ['open', 'in_progress']);

        // Mark current entry as reassigned
        await supabaseClient
          .from('account_users')
          .update({ 
            status: 'reassigned', 
            disabled_at: new Date().toISOString(),
            invite_token: null,
            invite_expires_at: null,
            updated_at: new Date().toISOString() 
          })
          .eq('id', currentMember.id);

        // Check if new user exists
        const { data: existingUser } = await supabaseClient
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .maybeSingle();

        if (existingUser) {
          // Add existing user with same role (immediately active)
          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: existingUser.id,
              email: email,
              role: currentMember.role,
              status: 'active',
              is_owner: false,
              accepted_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;

          // No seat count change - seat is transferred
          result = { 
            success: true, 
            data, 
            message: `Seat reassigned to ${email} successfully`,
            previousUser: currentMember.profiles?.email
          };
        } else {
          // Generate invite token for new user
          const { data: tokenData } = await supabaseClient.rpc('generate_invite_token');
          const inviteToken = tokenData as string;
          const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          // Create pending entry with invite token
          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: user.id, // Temporarily set to inviter
              email: email,
              role: currentMember.role,
              status: 'pending',
              is_owner: false,
              invite_token: inviteToken,
              invite_expires_at: inviteExpiresAt,
            })
            .select()
            .single();

          if (error) throw error;

          // Get profiles for email
          const { data: inviterProfile } = await supabaseClient
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .single();
          
          const { data: ownerProfile } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', managingAccountId)
            .single();

          // Send invite email
          try {
            await supabaseClient.functions.invoke('send-team-invite', {
              body: {
                email: email,
                role: currentMember.role,
                inviterName: inviterProfile?.name || inviterProfile?.email || 'A team admin',
                accountOwnerName: ownerProfile?.name || 'your team',
                inviteToken: inviteToken,
              },
            });
          } catch (emailError) {
            logStep('Failed to send reassign invite email', { error: emailError });
          }

          result = { 
            success: true, 
            data, 
            message: `Invitation sent to ${email}. Seat will transfer when accepted.`,
            previousUser: currentMember.profiles?.email
          };
        }
        break;
      }

      case 'resend_invite': {
        const targetUserId = userId || memberId;

        // Get the pending member - try by user_id first, then by id
        let pendingMember;
        const { data: memberByUserId } = await supabaseClient
          .from('account_users')
          .select('id, email, role, status')
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .eq('status', 'pending')
          .maybeSingle();
        
        if (memberByUserId) {
          pendingMember = memberByUserId;
        } else {
          // Try by id
          const { data: memberById } = await supabaseClient
            .from('account_users')
            .select('id, email, role, status')
            .eq('account_id', managingAccountId)
            .eq('id', targetUserId)
            .eq('status', 'pending')
            .maybeSingle();
          pendingMember = memberById;
        }

        if (!pendingMember) {
          return new Response(
            JSON.stringify({ error: 'Team member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (pendingMember.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Can only resend invitations to pending members' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate new invite token
        const { data: tokenData } = await supabaseClient.rpc('generate_invite_token');
        const inviteToken = tokenData as string;
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Update with new token
        await supabaseClient
          .from('account_users')
          .update({ 
            invite_token: inviteToken,
            invite_expires_at: inviteExpiresAt,
            invited_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
          })
          .eq('id', pendingMember.id);

        // Get inviter's profile
        const { data: inviterProfile } = await supabaseClient
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single();
        
        // Get account owner's name
        const { data: ownerProfile } = await supabaseClient
          .from('profiles')
          .select('name')
          .eq('id', managingAccountId)
          .single();

        // Send invite email
        try {
          await supabaseClient.functions.invoke('send-team-invite', {
            body: {
              email: pendingMember.email,
              role: pendingMember.role,
              inviterName: inviterProfile?.name || inviterProfile?.email || 'A team admin',
              accountOwnerName: ownerProfile?.name || 'your team',
              inviteToken: inviteToken,
            },
          });
          logStep('Resend invite email sent', { email: pendingMember.email });
        } catch (emailError) {
          logStep('Failed to resend invite email', { error: emailError });
        }

        result = { success: true, message: 'Invitation resent successfully' };
        break;
      }

      case 'changeRole': {
        if (!effectiveFeatures?.features?.can_manage_roles) {
          return new Response(
            JSON.stringify({
              error: true,
              code: 'FEATURE_NOT_AVAILABLE',
              message: 'Role management is available on Professional and Custom plans.',
              required_plan: 'Professional or Custom',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const targetUserId = userId || memberId;

        // Verify not changing owner's role
        const { data: targetMember } = await supabaseClient
          .from('account_users')
          .select('id, role, is_owner')
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .single();

        if (targetMember?.is_owner || targetMember?.role === 'owner') {
          return new Response(
            JSON.stringify({ error: 'Cannot change owner role' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .select()
          .single();

        if (error) throw error;

        result = { success: true, data };
        break;
      }

      case 'getAssignedTasksCount': {
        const targetUserId = userId || memberId;
        
        const { data: tasks } = await supabaseClient
          .from('collection_tasks')
          .select('id', { count: 'exact' })
          .eq('assigned_to', targetUserId)
          .in('status', ['open', 'in_progress']);
        
        result = { success: true, count: tasks?.length || 0 };
        break;
      }

      case 'list': {
        const { data, error } = await supabaseClient
          .from('account_users')
          .select(`
            *,
            profiles!account_users_user_id_fkey (
              name,
              email
            )
          `)
          .eq('account_id', managingAccountId)
          .neq('status', 'reassigned') // Hide reassigned entries
          .order('is_owner', { ascending: false })
          .order('status', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate seat counts
        const activeNonOwners = data?.filter(m => m.status === 'active' && !m.is_owner) || [];
        const billableSeats = activeNonOwners.length;

        result = { 
          success: true, 
          data,
          billableSeats,
          totalMembers: data?.length || 0
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
