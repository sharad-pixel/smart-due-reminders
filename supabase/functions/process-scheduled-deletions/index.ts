import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify caller is admin or service role
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      // Allow service role key directly
      if (token !== serviceRoleKey) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
        if (!profile?.is_admin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Find all pending deletions where 24 hours have passed
    const { data: pendingDeletions, error: fetchError } = await supabase
      .from('scheduled_deletions')
      .select('*')
      .eq('status', 'pending')
      .lte('deletion_scheduled_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching scheduled deletions:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending deletions to process', processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { userId: string; email: string; success: boolean; error?: string }[] = [];

    for (const deletion of pendingDeletions) {
      try {
        console.log(`Processing scheduled deletion for user ${deletion.user_id} (${deletion.user_email})`);

        // Call the existing delete-user function
        const deleteResponse = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: deletion.user_id,
            blockEmail: true,
            reason: deletion.reason || 'Scheduled account deletion - 24hr notice period expired',
          }),
        });

        const deleteResult = await deleteResponse.json();

        if (deleteResponse.ok && deleteResult.success) {
          // Mark as completed
          await supabase.from('scheduled_deletions').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', deletion.id);

          results.push({ userId: deletion.user_id, email: deletion.user_email, success: true });
          console.log(`Successfully deleted user ${deletion.user_email}`);
        } else {
          console.error(`Failed to delete user ${deletion.user_email}:`, deleteResult);
          results.push({ userId: deletion.user_id, email: deletion.user_email, success: false, error: deleteResult.error });
        }
      } catch (err: unknown) {
        console.error(`Error processing deletion for ${deletion.user_email}:`, err);
        results.push({ userId: deletion.user_id, email: deletion.user_email, success: false, error: (err as Error).message });
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${results.length} scheduled deletions`,
      processed: results.length,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in process-scheduled-deletions:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
