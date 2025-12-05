import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EscalationRequest {
  user_id?: string;
  organization_id?: string;
  page_route: string;
  question: string;
  confidence_score?: number;
  escalation_reason: string;
  transcript_excerpt?: string;
  user_email?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: EscalationRequest = await req.json();
    console.log('Escalation request received:', body);

    const {
      user_id,
      organization_id,
      page_route,
      question,
      confidence_score,
      escalation_reason,
      transcript_excerpt,
      user_email
    } = body;

    // Validate required fields
    if (!question || !page_route || !escalation_reason) {
      throw new Error('Missing required fields: question, page_route, escalation_reason');
    }

    // Log escalation to database
    const { data: escalationLog, error: insertError } = await supabaseClient
      .from('nicolas_escalations')
      .insert({
        user_id: user_id || null,
        organization_id: organization_id || null,
        page_route,
        question,
        confidence_score: confidence_score || null,
        escalation_reason,
        transcript_excerpt: transcript_excerpt || null,
        email_sent: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error logging escalation:', insertError);
      // Continue anyway to send email
    }

    // Format the email body
    const userType = user_id ? 'Authenticated User' : 'Public Website Visitor';
    const timestamp = new Date().toISOString();

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
          🤖 Nicolas Support Escalation
        </h2>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">User Question</h3>
          <p style="font-size: 16px; color: #1f2937; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">
            ${question}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User Type</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${userType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User Email</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user_email || 'Not available'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User ID</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user_id || 'Not logged in'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Organization ID</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${organization_id || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Page Route</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${page_route}</code></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Timestamp</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Confidence Score</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${confidence_score !== undefined ? `${(confidence_score * 100).toFixed(0)}%` : 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Escalation Reason</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escalation_reason}</td>
          </tr>
        </table>

        ${transcript_excerpt ? `
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Conversation Transcript</h3>
          <pre style="font-size: 13px; color: #4b5563; background: white; padding: 15px; border-radius: 6px; white-space: pre-wrap; overflow-x: auto;">
${transcript_excerpt}
          </pre>
        </div>
        ` : ''}

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Action Required:</strong> Please respond to this user's inquiry as soon as possible.
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
          This email was automatically generated by Nicolas, the Recouply.ai Knowledge Base Agent.
        </p>
      </div>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
      to: ['support@recouply.ai'],
      subject: `Nicolas Support Escalation – User Needs Assistance`,
      html: emailHtml,
      replyTo: user_email || undefined
    });

    console.log('Email sent successfully:', emailResponse);

    // Update escalation log to mark email as sent
    if (escalationLog?.id) {
      await supabaseClient
        .from('nicolas_escalations')
        .update({ email_sent: true })
        .eq('id', escalationLog.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Escalation sent successfully',
        escalation_id: escalationLog?.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in nicolas-escalate-support:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
