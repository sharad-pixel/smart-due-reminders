import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function checks if a user's email is blocked and handles cleanup
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { email, userId } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking if email is blocked: ${email}`);

    // Check if email is in blocked_users table
    const { data: blockedUser, error } = await supabase
      .from('blocked_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Error checking blocked status:', error);
      return new Response(JSON.stringify({ blocked: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if block has expired
    if (blockedUser) {
      if (blockedUser.expires_at && new Date(blockedUser.expires_at) < new Date()) {
        // Block has expired, remove it
        await supabase
          .from('blocked_users')
          .delete()
          .eq('id', blockedUser.id);
        
        console.log(`Block expired for ${email}, removed from blocklist`);
        return new Response(JSON.stringify({ blocked: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Email ${email} is blocked. Reason: ${blockedUser.reason}`);

      // If userId is provided, delete the newly created auth user to prevent access
      if (userId) {
        console.log(`Deleting blocked user's auth account: ${userId}`);
        
        // Delete profile first
        await supabase.from('profiles').delete().eq('id', userId);
        
        // Delete auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.error('Error deleting blocked user:', deleteError);
        } else {
          console.log(`Successfully deleted auth account for blocked user: ${email}`);
        }
      }

      return new Response(JSON.stringify({ 
        blocked: true,
        reason: blockedUser.reason,
        blocked_at: blockedUser.blocked_at,
        expires_at: blockedUser.expires_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ blocked: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in check-blocked-user function:', error);
    return new Response(JSON.stringify({ blocked: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
