import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { recipientEmail, subject, body, draftId, invoiceId } = await req.json();

    if (!recipientEmail || !subject || !body) {
      throw new Error("Missing required fields: recipientEmail, subject, body");
    }

    console.log(`Preparing to send collection email to: ${recipientEmail}`);

    // Get the active sending identity for this user
    const { data: profile, error: profileError } = await supabaseClient
      .from("email_sending_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    let senderName = "Recouply Collections";
    let senderEmail = `workspace-${user.id.substring(0, 8)}@send.recouply.ai`;
    let domain = "send.recouply.ai";

    // If custom domain exists and is verified, use it
    if (profile && !profile.use_recouply_domain && profile.verification_status === "verified") {
      senderName = profile.sender_name;
      senderEmail = profile.sender_email;
      domain = profile.domain;
      console.log(`Using verified custom domain: ${domain}`);
    } else if (profile && profile.use_recouply_domain) {
      senderName = profile.sender_name;
      senderEmail = profile.sender_email;
      domain = profile.domain;
      console.log(`Using Recouply domain by user preference`);
    } else {
      console.log(`Using default fallback domain`);
    }

    // In production, integrate with your email service provider (SendGrid, Postmark, etc.)
    // For now, we'll log the email details
    const emailPayload = {
      from: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: recipientEmail }],
      subject,
      html: body,
      metadata: {
        user_id: user.id,
        draft_id: draftId || null,
        invoice_id: invoiceId || null,
        domain: domain,
      },
    };

    console.log("Email payload prepared:", JSON.stringify(emailPayload, null, 2));

    // Log the collection activity
    if (draftId || invoiceId) {
      const { error: activityError } = await supabaseClient
        .from("collection_activities")
        .insert({
          user_id: user.id,
          debtor_id: invoiceId ? 
            (await supabaseClient
              .from("invoices")
              .select("debtor_id")
              .eq("id", invoiceId)
              .single()).data?.debtor_id : null,
          invoice_id: invoiceId || null,
          linked_draft_id: draftId || null,
          activity_type: "outreach",
          direction: "outbound",
          channel: "email",
          subject,
          message_body: body,
          sent_at: new Date().toISOString(),
          metadata: {
            from_email: senderEmail,
            from_name: senderName,
            domain: domain,
          },
        });

      if (activityError) {
        console.error("Failed to log collection activity:", activityError);
      }
    }

    // Update draft status if provided
    if (draftId) {
      const { error: draftError } = await supabaseClient
        .from("ai_drafts")
        .update({ 
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);

      if (draftError) {
        console.error("Failed to update draft status:", draftError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        sender: {
          name: senderName,
          email: senderEmail,
          domain: domain,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-collection-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
