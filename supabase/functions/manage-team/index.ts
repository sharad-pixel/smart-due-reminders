import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

// Seat pricing configuration - must match src/lib/subscriptionConfig.ts STRIPE_PRICES.seat
// Updated December 2024 with correct Stripe price IDs
const SEAT_PRICE_IDS = {
  month: 'price_1ScbGhBfb0dWgtCDZukktOuA',  // $75/user/month
  year: 'price_1ScbGiBfb0dWgtCDOrLwli7A',   // $720/user/year (20% discount)
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-TEAM] ${step}${detailsStr}`);
};

interface TeamAction {
  action: 'invite' | 'deactivate' | 'reactivate' | 'reassign' | 'resend_invite' | 'resend_welcome' | 'changeRole' | 'list' | 'getAssignedTasksCount' | 'disable' | 'enable' | 'transfer_ownership';
  email?: string;
  userId?: string;
  memberId?: string;
  role?: string;
  reassignTo?: string;
  newOwnerId?: string;
}

// Helper: Get billable seat count for an account
// Includes active users AND disabled users still within their billing period
async function getBillableSeatCount(supabase: any, accountId: string): Promise<number> {
  const now = new Date().toISOString();
  
  // Count active users
  const { data: activeData, error: activeError } = await supabase
    .from('account_users')
    .select('id')
    .eq('account_id', accountId)
    .eq('is_owner', false)
    .eq('status', 'active');

  if (activeError) {
    logStep('Error getting active seat count', { error: activeError });
    return 0;
  }

  // Count disabled users still in billing period
  const { data: billingData, error: billingError } = await supabase
    .from('account_users')
    .select('id')
    .eq('account_id', accountId)
    .eq('is_owner', false)
    .eq('status', 'disabled')
    .not('seat_billing_ends_at', 'is', null)
    .gt('seat_billing_ends_at', now);

  if (billingError) {
    logStep('Error getting billing period seats', { error: billingError });
  }

  const activeCount = activeData?.length || 0;
  const billingPeriodCount = billingData?.length || 0;
  
  logStep('Billable seat calculation', { activeCount, billingPeriodCount, total: activeCount + billingPeriodCount });
  return activeCount + billingPeriodCount;
}

// Helper: Get subscription period end date from Stripe
async function getSubscriptionPeriodEnd(supabase: any, accountId: string): Promise<Date | null> {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    logStep('STRIPE_SECRET_KEY not configured for period end lookup');
    return null;
  }

  const { data: ownerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_subscription_id, billing_interval, current_period_end')
    .eq('id', accountId)
    .single();

  if (profileError || !ownerProfile) {
    logStep('No profile found for period end', { accountId });
    return null;
  }

  // First try to use cached current_period_end from profiles
  if (ownerProfile.current_period_end) {
    return new Date(ownerProfile.current_period_end);
  }

  // Fall back to fetching from Stripe
  if (!ownerProfile.stripe_subscription_id) {
    logStep('No subscription ID for period end lookup', { accountId });
    return null;
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
    const subscription = await stripe.subscriptions.retrieve(ownerProfile.stripe_subscription_id);
    
    const periodEnd = new Date(subscription.current_period_end * 1000);
    logStep('Retrieved subscription period end', { periodEnd: periodEnd.toISOString() });
    return periodEnd;
  } catch (error) {
    logStep('Error fetching subscription period end', { error: error instanceof Error ? error.message : error });
    return null;
  }
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
    const { action, email, userId, memberId, role, reassignTo, newOwnerId } = body;

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
    
    // Team members (including non-admins) can use 'list' action for task assignment
    const isActiveMember = membershipCheck && membershipCheck.status === 'active';
    const isReadOnlyAction = action === 'list' || action === 'getAssignedTasksCount';

    // Allow read-only actions for any active team member
    if (!isOwnerOrAdmin && !isStandaloneOwner && !(isActiveMember && isReadOnlyAction)) {
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
        if (!email || !email.trim()) {
          return new Response(
            JSON.stringify({ error: 'Email address is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const normalizedEmail = email.toLowerCase().trim();
        let existingUserInviteToken: string | null = null; // For existing users who need to accept

        // Check if this email is already a pending invite for THIS account
        const { data: existingPendingInvite } = await supabaseClient
          .from('account_users')
          .select('id, status')
          .eq('account_id', managingAccountId)
          .eq('email', normalizedEmail)
          .in('status', ['pending', 'active'])
          .maybeSingle();

        if (existingPendingInvite) {
          const statusMsg = existingPendingInvite.status === 'pending' 
            ? 'already has a pending invite' 
            : 'is already an active team member';
          return new Response(
            JSON.stringify({ error: `This email ${statusMsg} for this account` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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

        // Check if user exists in profiles
        const { data: existingUser } = await supabaseClient
          .from('profiles')
          .select('id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (existingUser) {
          // Check if already a team member (by user_id)
          const { data: existingMember } = await supabaseClient
            .from('account_users')
            .select('id, status')
            .eq('account_id', managingAccountId)
            .eq('user_id', existingUser.id)
            .maybeSingle();

          if (existingMember) {
            return new Response(
              JSON.stringify({ error: 'This user is already a team member of this account' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Add existing user to team with pending status (they need to accept)
          // Generate invite token so they can explicitly accept
          const { data: tokenData } = await supabaseClient.rpc('generate_invite_token');
          const inviteToken = tokenData as string;
          const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: existingUser.id,
              email: email,
              role: role || 'member',
              status: 'pending', // Pending until they accept
              is_owner: false,
              invite_token: inviteToken,
              invite_expires_at: inviteExpiresAt,
            })
            .select()
            .single();

          if (error) throw error;

          // Sync billing - pending invites count as billable seats (charged upfront)
          const seatCount = await getBillableSeatCount(supabaseClient, managingAccountId);
          await updateStripeSeatQuantity(supabaseClient, managingAccountId, seatCount, user.id);

          // Store for email sending below
          existingUserInviteToken = inviteToken;
          
          // Get inviter and owner profiles for email
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

          // Send invite email to existing user (with accept link)
          try {
            await supabaseClient.functions.invoke('send-seat-reassignment', {
              body: {
                newUserEmail: email,
                newUserName: existingUser.email?.split('@')[0] || null,
                role: role || 'member',
                inviteToken: inviteToken, // Include token so they get accept link
                isExistingUser: true,
                accountOwnerName: ownerProfile?.name || 'your team',
                reassignedByName: inviterProfile?.name || inviterProfile?.email || 'A team admin',
              },
            });
            logStep('Sent invite email to existing user', { email });
          } catch (emailError) {
            logStep('Failed to send invite email to existing user', { error: emailError });
          }

          result = { success: true, data, message: 'Invitation sent - user needs to accept to join the team', isExistingUser: true };
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
          let isNewInvite = false;
          
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
            // Not a new invite, don't charge again
          } else {
            // Create pending account_users entry with invite token
            // user_id is NULL for pending invites (will be set on acceptance)
            const { data, error } = await supabaseClient
              .from('account_users')
              .insert({
                account_id: managingAccountId,
                user_id: null, // NULL for pending invites, will be set on acceptance
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
            isNewInvite = true;
          }
          
          // CHARGE IMMEDIATELY for new invites - sync billing now
          // Pending invites count as billable seats (charged upfront)
          if (isNewInvite) {
            logStep('Charging for new seat immediately', { email });
            
            // Get current billable count INCLUDING pending invites
            const { data: allActiveOrPending } = await supabaseClient
              .from('account_users')
              .select('id')
              .eq('account_id', managingAccountId)
              .eq('is_owner', false)
              .in('status', ['active', 'pending']);
            
            const seatCount = allActiveOrPending?.length || 0;
            const billingResult = await updateStripeSeatQuantity(supabaseClient, managingAccountId, seatCount, user.id);
            
            if (!billingResult.success && billingResult.error) {
              // If billing fails, we should rollback the invite
              await supabaseClient
                .from('account_users')
                .delete()
                .eq('id', accountUserEntry.id);
              
              return new Response(
                JSON.stringify({ 
                  error: true, 
                  message: 'Failed to charge for seat. Please check your payment method.',
                  details: billingResult.error 
                }),
                { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            logStep('Seat charged successfully', { seatCount, email });
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
          
          // Send invite email via send-team-invite function (direct fetch call)
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
            
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-team-invite`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                email: email,
                role: role || 'member',
                inviterName: inviterProfile?.name || inviterProfile?.email || 'A team admin',
                accountOwnerName: ownerProfile?.name || 'your team',
                inviteToken: inviteToken,
              }),
            });
            
            const emailResult = await emailResponse.json();
            if (emailResult.success) {
              logStep('Invite email sent successfully', { email });
            } else {
              logStep('Invite email failed', { error: emailResult.error });
            }
          } catch (emailError) {
            logStep('Failed to send invite email', { error: emailError instanceof Error ? emailError.message : emailError });
            // Don't fail the whole operation if email fails
          }

          result = { 
            success: true, 
            data: accountUserEntry, 
            message: isNewInvite ? 'Invitation sent and seat charged to your account' : 'Invitation resent successfully',
            charged: isNewInvite
          };
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

        // Get subscription period end - user remains billable until end of current term
        const periodEnd = await getSubscriptionPeriodEnd(supabaseClient, managingAccountId);
        const seatBillingEndsAt = periodEnd?.toISOString() || null;
        
        logStep('Setting seat billing end date', { 
          userId: targetUserId, 
          periodEnd: seatBillingEndsAt,
          message: periodEnd ? 'User will remain billable until period end' : 'No subscription - immediate removal'
        });

        // Deactivate the member with billing end date
        const { data, error } = await supabaseClient
          .from('account_users')
          .update({ 
            status: 'disabled', 
            disabled_at: new Date().toISOString(),
            seat_billing_ends_at: seatBillingEndsAt,
            updated_at: new Date().toISOString() 
          })
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .select()
          .single();

        if (error) throw error;

        // Sync billing - includes disabled users still in billing period
        const seatCount = await getBillableSeatCount(supabaseClient, managingAccountId);
        await updateStripeSeatQuantity(supabaseClient, managingAccountId, seatCount, user.id);

        const billingMessage = periodEnd 
          ? `Team member deactivated. Billing continues until ${periodEnd.toLocaleDateString()}.`
          : 'Team member deactivated successfully.';

        result = { 
          success: true, 
          data, 
          message: billingMessage, 
          seatCount,
          seatBillingEndsAt 
        };
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
        if (!email) {
          return new Response(
            JSON.stringify({ error: 'New email address is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current member - try by memberId (account_users.id) first, then by user_id
        let currentMember: any = null;
        let memberError: any = null;

        if (memberId) {
          // Look up by account_users row ID (works for pending invites with null user_id)
          const result = await supabaseClient
            .from('account_users')
            .select('*, profiles!account_users_user_id_fkey (name, email)')
            .eq('account_id', managingAccountId)
            .eq('id', memberId)
            .single();
          currentMember = result.data;
          memberError = result.error;
        }
        
        if (!currentMember && userId) {
          // Fallback to user_id lookup
          const result = await supabaseClient
            .from('account_users')
            .select('*, profiles!account_users_user_id_fkey (name, email)')
            .eq('account_id', managingAccountId)
            .eq('user_id', userId)
            .single();
          currentMember = result.data;
          memberError = result.error;
        }

        if (memberError || !currentMember) {
          logStep('Member not found for reassign', { memberId, userId, managingAccountId });
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

        // Check if new email is the account owner's email
        const { data: ownerProfileForCheck } = await supabaseClient
          .from('profiles')
          .select('email')
          .eq('id', managingAccountId)
          .maybeSingle();
        
        if (ownerProfileForCheck?.email?.toLowerCase() === email.toLowerCase()) {
          return new Response(
            JSON.stringify({ error: 'Cannot reassign to the account owner email' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if new email already exists in team (any status)
        const { data: existingMembers } = await supabaseClient
          .from('account_users')
          .select('id, user_id, email, status, profiles!account_users_user_id_fkey (email)')
          .eq('account_id', managingAccountId);

        // Find any existing entry with this email
        const existingEntry = existingMembers?.find(
          (m: any) => 
            (m.email?.toLowerCase() === email.toLowerCase() || 
             m.profiles?.email?.toLowerCase() === email.toLowerCase()) && 
            m.id !== currentMember.id
        );

        // If email exists with active/pending/disabled status, reject
        if (existingEntry && existingEntry.status !== 'reassigned') {
          return new Response(
            JSON.stringify({ error: 'This email is already a team member' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If email exists with 'reassigned' status, delete the old entry first to avoid unique constraint
        if (existingEntry && existingEntry.status === 'reassigned') {
          logStep('Cleaning up old reassigned entry', { email, existingEntryId: existingEntry.id });
          await supabaseClient
            .from('account_users')
            .delete()
            .eq('id', existingEntry.id);
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

        // For active/disabled members, unassign tasks from old user if they have a user_id
        if (currentMember.user_id) {
          await supabaseClient
            .from('collection_tasks')
            .update({ assigned_to: null, updated_at: new Date().toISOString() })
            .eq('assigned_to', currentMember.user_id)
            .in('status', ['open', 'in_progress']);
        }

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

        // Get inviter and owner profiles for email context
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

        const oldUserEmail = currentMember.profiles?.email || currentMember.email;
        const oldUserName = currentMember.profiles?.name;
        const reassignedByName = inviterProfile?.name || inviterProfile?.email || 'A team admin';
        const accountOwnerName = ownerProfile?.name || 'your team';

        if (existingUser) {
          // Existing user - create pending invite so they can explicitly accept
          // This ensures they acknowledge joining the team
          const { data: tokenData } = await supabaseClient.rpc('generate_invite_token');
          const inviteToken = tokenData as string;
          const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          const { data, error } = await supabaseClient
            .from('account_users')
            .insert({
              account_id: managingAccountId,
              user_id: existingUser.id,
              email: email,
              role: currentMember.role,
              status: 'pending', // Pending until they accept
              is_owner: false,
              invite_token: inviteToken,
              invite_expires_at: inviteExpiresAt,
            })
            .select()
            .single();

          if (error) throw error;

          // Send reassignment emails to both users - with invite link for existing user to accept
          try {
            await supabaseClient.functions.invoke('send-seat-reassignment', {
              body: {
                newUserEmail: email,
                newUserName: existingUser.email?.split('@')[0] || null,
                role: currentMember.role,
                inviteToken: inviteToken, // Include token so they get accept link
                isExistingUser: true, // They have an account but need to accept
                oldUserEmail: oldUserEmail,
                oldUserName: oldUserName,
                accountOwnerName: accountOwnerName,
                reassignedByName: reassignedByName,
              },
            });
            logStep('Sent reassignment emails (existing user with invite)', { newUserEmail: email, oldUserEmail });
          } catch (emailError) {
            logStep('Failed to send reassignment emails', { error: emailError });
          }

          // No seat count change - seat is transferred
          result = { 
            success: true, 
            data, 
            message: `Invitation sent to ${email} - they will need to accept to join the team`,
            previousUser: oldUserEmail
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

          // Send reassignment emails to both users
          try {
            await supabaseClient.functions.invoke('send-seat-reassignment', {
              body: {
                newUserEmail: email,
                role: currentMember.role,
                inviteToken: inviteToken,
                isExistingUser: false,
                oldUserEmail: oldUserEmail,
                oldUserName: oldUserName,
                accountOwnerName: accountOwnerName,
                reassignedByName: reassignedByName,
              },
            });
            logStep('Sent reassignment emails (new user)', { newUserEmail: email, oldUserEmail });
          } catch (emailError) {
            logStep('Failed to send reassignment emails', { error: emailError });
          }

          result = { 
            success: true, 
            data, 
            message: `Invitation sent to ${email}. Seat will transfer when accepted.`,
            previousUser: oldUserEmail
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
            JSON.stringify({ error: 'Pending invitation not found' }),
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

        const inviterName = inviterProfile?.name || inviterProfile?.email || 'A team admin';
        const accountOwnerName = ownerProfile?.name || 'your team';

        // Check if this is a reassignment (there's a previous reassigned entry for this account)
        const { data: previousReassigned } = await supabaseClient
          .from('account_users')
          .select('id, email, user_id')
          .eq('account_id', managingAccountId)
          .eq('status', 'reassigned')
          .order('disabled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // If there's a previous reassigned user, get their profile for name
        let oldUserName: string | null = null;
        let oldUserEmail: string | null = null;
        if (previousReassigned) {
          oldUserEmail = previousReassigned.email;
          if (previousReassigned.user_id) {
            const { data: oldUserProfile } = await supabaseClient
              .from('profiles')
              .select('name, email')
              .eq('id', previousReassigned.user_id)
              .maybeSingle();
            oldUserName = oldUserProfile?.name;
            oldUserEmail = oldUserProfile?.email || previousReassigned.email;
          }
        }

        // Determine if we should send reassignment email (with old user context) or regular invite
        const isReassignment = previousReassigned && previousReassigned.email !== pendingMember.email;

        try {
          if (isReassignment) {
            // Send reassignment email (includes context about the seat transfer)
            await supabaseClient.functions.invoke('send-seat-reassignment', {
              body: {
                newUserEmail: pendingMember.email,
                role: pendingMember.role,
                inviteToken: inviteToken,
                isExistingUser: false,
                oldUserEmail: oldUserEmail,
                oldUserName: oldUserName,
                accountOwnerName: accountOwnerName,
                reassignedByName: inviterName,
              },
            });
            logStep('Resend reassignment invite email sent', { email: pendingMember.email, oldUserEmail });
          } else {
            // Send standard invite email
            await supabaseClient.functions.invoke('send-team-invite', {
              body: {
                email: pendingMember.email,
                role: pendingMember.role,
                inviterName: inviterName,
                accountOwnerName: accountOwnerName,
                inviteToken: inviteToken,
              },
            });
            logStep('Resend invite email sent', { email: pendingMember.email });
          }
        } catch (emailError) {
          logStep('Failed to resend invite email', { error: emailError });
          // Don't fail the whole operation if email fails
        }

        result = { 
          success: true, 
          message: isReassignment 
            ? 'Reassignment invitation resent successfully' 
            : 'Invitation resent successfully' 
        };
        break;
      }

      case 'resend_welcome': {
        const targetUserId = userId || memberId;

        // Get the active member
        let activeMember;
        const { data: memberByUserId } = await supabaseClient
          .from('account_users')
          .select('id, email, role, status, user_id, profiles!account_users_user_id_fkey (name, email)')
          .eq('account_id', managingAccountId)
          .eq('user_id', targetUserId)
          .eq('status', 'active')
          .maybeSingle();
        
        if (memberByUserId) {
          activeMember = memberByUserId;
        } else {
          // Try by id
          const { data: memberById } = await supabaseClient
            .from('account_users')
            .select('id, email, role, status, user_id, profiles!account_users_user_id_fkey (name, email)')
            .eq('account_id', managingAccountId)
            .eq('id', targetUserId)
            .eq('status', 'active')
            .maybeSingle();
          activeMember = memberById;
        }

        if (!activeMember) {
          return new Response(
            JSON.stringify({ error: 'Active team member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const memberProfile = activeMember.profiles as any;
        const memberEmail = memberProfile?.email || activeMember.email;
        const memberName = memberProfile?.name;

        if (!memberEmail) {
          return new Response(
            JSON.stringify({ error: 'No email found for this member' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get inviter's profile
        const { data: inviterProfile } = await supabaseClient
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single();
        
        // Get account owner's profile
        const { data: ownerProfile } = await supabaseClient
          .from('profiles')
          .select('name')
          .eq('id', managingAccountId)
          .single();

        const reassignedByName = inviterProfile?.name || inviterProfile?.email || 'A team admin';
        const accountOwnerName = ownerProfile?.name || 'your team';

        // Send welcome email for existing users (they're already active, just need notification)
        try {
          await supabaseClient.functions.invoke('send-seat-reassignment', {
            body: {
              newUserEmail: memberEmail,
              newUserName: memberName,
              role: activeMember.role,
              isExistingUser: true, // They're active, so existing user flow
              accountOwnerName: accountOwnerName,
              reassignedByName: reassignedByName,
            },
          });
          logStep('Resend welcome email sent', { email: memberEmail });
        } catch (emailError) {
          logStep('Failed to send welcome email', { error: emailError });
          return new Response(
            JSON.stringify({ error: 'Failed to send welcome email' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = { 
          success: true, 
          message: `Welcome email resent to ${memberEmail}` 
        };
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
          .order('is_owner', { ascending: false })
          .order('status', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Exclude fully reassigned entries (where the replacement has already accepted)
        // Show reassigned entries only when they have a pending replacement
        const pendingEmails = new Set(
          data?.filter((m: any) => m.status === 'pending').map((m: any) => (m.email || m.profiles?.email)?.toLowerCase()) || []
        );
        
        const filteredData = data?.filter((m: any) => {
          // Keep all non-reassigned entries
          if (m.status !== 'reassigned') return true;
          
          // For reassigned entries, only show if there's a pending invite for this seat
          // Check if there's a pending invite created after this was reassigned
          const reassignedEmail = m.profiles?.email || m.email;
          if (!reassignedEmail) return false;
          
          // Find if any pending member was created after this one was disabled
          const hasActivePendingReplacement = data?.some((pending: any) => 
            pending.status === 'pending' && 
            new Date(pending.created_at) > new Date(m.disabled_at || m.updated_at)
          );
          
          return hasActivePendingReplacement;
        }) || [];

        // Calculate seat counts
        const activeNonOwners = filteredData.filter((m: any) => m.status === 'active' && !m.is_owner);
        const billableSeats = activeNonOwners.length;

        result = { 
          success: true, 
          data: filteredData,
          billableSeats,
          totalMembers: filteredData.length
        };
        break;
      }

      case 'transfer_ownership': {
        // Only the current owner can transfer ownership
        if (!membershipCheck?.is_owner && membershipCheck?.role !== 'owner') {
          return new Response(
            JSON.stringify({ error: 'Only the current owner can transfer ownership' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!newOwnerId) {
          return new Response(
            JSON.stringify({ error: 'New owner ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify the new owner is an active admin of this account
        const { data: newOwnerMember, error: newOwnerError } = await supabaseClient
          .from('account_users')
          .select('id, user_id, role, status, is_owner')
          .eq('account_id', managingAccountId)
          .eq('user_id', newOwnerId)
          .eq('status', 'active')
          .single();

        if (newOwnerError || !newOwnerMember) {
          return new Response(
            JSON.stringify({ error: 'New owner must be an active team member' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (newOwnerMember.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'New owner must have admin role before ownership can be transferred' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        logStep('Initiating ownership transfer', { 
          currentOwner: user.id, 
          newOwner: newOwnerId,
          accountId: managingAccountId 
        });

        // Start the transfer - update the current owner to admin
        const { error: demoteError } = await supabaseClient
          .from('account_users')
          .update({ 
            role: 'admin', 
            is_owner: false,
            updated_at: new Date().toISOString() 
          })
          .eq('account_id', managingAccountId)
          .eq('user_id', user.id)
          .eq('is_owner', true);

        if (demoteError) {
          logStep('Error demoting current owner', { error: demoteError });
          throw demoteError;
        }

        // Promote the new owner
        const { error: promoteError } = await supabaseClient
          .from('account_users')
          .update({ 
            role: 'owner', 
            is_owner: true,
            updated_at: new Date().toISOString() 
          })
          .eq('account_id', managingAccountId)
          .eq('user_id', newOwnerId);

        if (promoteError) {
          // Rollback - restore original owner
          await supabaseClient
            .from('account_users')
            .update({ 
              role: 'owner', 
              is_owner: true,
              updated_at: new Date().toISOString() 
            })
            .eq('account_id', managingAccountId)
            .eq('user_id', user.id);
          
          logStep('Error promoting new owner, rolled back', { error: promoteError });
          throw promoteError;
        }

        // Update the organizations table to reflect new owner
        const { error: orgError } = await supabaseClient
          .from('organizations')
          .update({ 
            owner_user_id: newOwnerId,
            updated_at: new Date().toISOString() 
          })
          .eq('owner_user_id', managingAccountId);

        if (orgError) {
          logStep('Error updating organization owner', { error: orgError });
          // Don't fail the entire operation for this - account_users is the source of truth
        }

        // Log audit event
        await supabaseClient.from('audit_logs').insert({
          user_id: user.id,
          action_type: 'ownership_transfer',
          resource_type: 'account',
          resource_id: managingAccountId,
          old_values: { owner_user_id: user.id },
          new_values: { owner_user_id: newOwnerId },
          metadata: { 
            transferred_by: user.id,
            transferred_to: newOwnerId,
            account_id: managingAccountId
          },
        });

        logStep('Ownership transfer completed successfully', { 
          previousOwner: user.id, 
          newOwner: newOwnerId 
        });

        result = { 
          success: true, 
          message: 'Ownership transferred successfully. You are now an admin of this account.',
          newOwnerId
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
