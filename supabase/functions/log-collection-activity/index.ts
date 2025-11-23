import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      debtor_id, 
      invoice_id,
      activity_type,
      direction,
      channel,
      subject,
      message_body,
      response_message,
      linked_draft_id,
      linked_outreach_log_id,
      metadata,
      sent_at,
      delivered_at,
      opened_at,
      responded_at
    } = await req.json();

    // Validation
    if (!debtor_id || !activity_type || !direction || !channel || !message_body) {
      throw new Error('Missing required fields: debtor_id, activity_type, direction, channel, message_body');
    }

    // Create the activity record
    const { data: activity, error: activityError } = await supabase
      .from('collection_activities')
      .insert({
        user_id: user.id,
        debtor_id,
        invoice_id,
        activity_type,
        direction,
        channel,
        subject,
        message_body,
        response_message,
        linked_draft_id,
        linked_outreach_log_id,
        metadata: metadata || {},
        sent_at: sent_at || (direction === 'outbound' ? new Date().toISOString() : null),
        delivered_at,
        opened_at,
        responded_at: responded_at || (direction === 'inbound' ? new Date().toISOString() : null)
      })
      .select()
      .single();

    if (activityError) {
      console.error('Error creating activity:', activityError);
      throw activityError;
    }

    console.log('Activity logged:', activity.id);

    // If this is an inbound activity (response from debtor), extract tasks
    let taskExtractionResult = null;
    if (direction === 'inbound' && response_message) {
      try {
        console.log('Triggering task extraction for inbound activity');
        
        const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-collection-tasks`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activity_id: activity.id,
            message: response_message,
            debtor_id,
            invoice_id
          })
        });

        if (extractResponse.ok) {
          taskExtractionResult = await extractResponse.json();
          console.log('Task extraction result:', taskExtractionResult);
        }
      } catch (extractError) {
        console.error('Error extracting tasks (non-fatal):', extractError);
        // Don't fail the whole operation if task extraction fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        activity,
        task_extraction: taskExtractionResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in log-collection-activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});