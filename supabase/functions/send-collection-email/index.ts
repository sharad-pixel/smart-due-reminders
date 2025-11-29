import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const { data: emailAccount, error: emailError } = await supabaseClient
      .from("email_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("email_type", "outbound")
      .order("is_primary", { ascending: false })
      .limit(1)
      .single();

    if (emailError || !emailAccount) {
      throw new Error("No active email account found. Please set up your email account first.");
    }

    // Get inbound email for reply-to (must be verified)
    const { data: inboundAccount } = await supabaseClient
      .from("email_accounts")
      .select("email_address")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("email_type", "inbound")
      .eq("is_verified", true)
      .maybeSingle();

    const replyToEmail = inboundAccount?.email_address || emailAccount.email_address;

    if (replyToEmail) {
      console.log(`Using verified inbound reply-to email: ${replyToEmail}`);
    } else {
      console.log("Using outbound email as reply-to fallback");
    }

    // Send email via Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    console.log(`Sending collection email from ${emailAccount.email_address} to ${recipientEmail} with reply-to: ${replyToEmail}`);
    
    const emailResponse = await resend.emails.send({
      from: emailAccount.email_address,
      reply_to: replyToEmail,
      to: recipientEmail,
      subject,
      html: body,
    });

    if (emailResponse.error) {
      throw new Error(`Resend API error: ${emailResponse.error.message}`);
    }
    
    console.log("Email sent successfully via Resend:", emailResponse);

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
            from_email: emailAccount.email_address,
            from_name: emailAccount.display_name || "Collections Team",
            reply_to_email: replyToEmail,
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
          email: emailAccount.email_address,
          reply_to: replyToEmail,
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
