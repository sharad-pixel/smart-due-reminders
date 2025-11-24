import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ hasAccess: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { resourceType, resourceId, action } = await req.json();
    
    console.log('Checking access:', { userId: user.id, resourceType, resourceId, action });

    // Check if user owns the resource
    let hasAccess = false;
    
    switch (resourceType) {
      case 'debtor': {
        const { data } = await supabaseClient
          .from('debtors')
          .select('id')
          .eq('id', resourceId)
          .eq('user_id', user.id)
          .single();
        hasAccess = !!data;
        break;
      }
      case 'invoice': {
        const { data } = await supabaseClient
          .from('invoices')
          .select('id')
          .eq('id', resourceId)
          .eq('user_id', user.id)
          .single();
        hasAccess = !!data;
        break;
      }
      case 'draft': {
        const { data } = await supabaseClient
          .from('ai_drafts')
          .select('id')
          .eq('id', resourceId)
          .eq('user_id', user.id)
          .single();
        hasAccess = !!data;
        break;
      }
      default:
        hasAccess = false;
    }

    // Log access attempt
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action_type: `access_check_${action}`,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: { 
        hasAccess,
        action,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ hasAccess }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Access check error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ hasAccess: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
