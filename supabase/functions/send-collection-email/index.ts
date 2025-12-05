import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateBrandedEmail } from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform email configuration
const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

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

    const { recipientEmail, subject, body, draftId, invoiceId, debtorId, paymentUrl, invoiceAmount } = await req.json();

    if (!recipientEmail || !subject || !body) {
      throw new Error("Missing required fields: recipientEmail, subject, body");
    }

    console.log(`Preparing to send collection email to: ${recipientEmail}`);

    // Determine reply-to address based on context (invoice or debtor level)
    let replyToEmail: string;
    if (invoiceId) {
      replyToEmail = `invoice+${invoiceId}@${PLATFORM_INBOUND_DOMAIN}`;
    } else if (debtorId) {
      replyToEmail = `debtor+${debtorId}@${PLATFORM_INBOUND_DOMAIN}`;
    } else {
      // Fallback to generic collections address
      replyToEmail = `collections@${PLATFORM_INBOUND_DOMAIN}`;
    }

    console.log(`Sending email from platform: ${PLATFORM_FROM_EMAIL}, reply-to: ${replyToEmail}`);

    // Fetch branding settings for signature
    const { data: branding } = await supabaseClient
      .from("branding_settings")
      .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color")
      .eq("user_id", user.id)
      .single();

    // Build fully branded email with signature and optional payment link
    const emailHtml = generateBrandedEmail(
      body,
      branding || {},
      {
        invoiceId,
        amount: invoiceAmount,
        paymentUrl,
      }
    );

    // Send email via platform send-email function
    const sendEmailResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          from: PLATFORM_FROM_EMAIL,
          reply_to: replyToEmail,
          subject,
          html: emailHtml,
        }),
      }
    );

    const sendResult = await sendEmailResponse.json();

    if (!sendEmailResponse.ok) {
      throw new Error(`Failed to send email: ${sendResult.error || "Unknown error"}`);
    }

    console.log("Email sent successfully via platform:", sendResult);

    // Log the collection activity
    if (draftId || invoiceId) {
      // Get debtor_id from invoice if not provided
      let finalDebtorId = debtorId;
      if (!finalDebtorId && invoiceId) {
        const { data: invoice } = await supabaseClient
          .from("invoices")
          .select("debtor_id")
          .eq("id", invoiceId)
          .single();
        finalDebtorId = invoice?.debtor_id;
      }

      if (finalDebtorId) {
        const { error: activityError } = await supabaseClient
          .from("collection_activities")
          .insert({
            user_id: user.id,
            debtor_id: finalDebtorId,
            invoice_id: invoiceId || null,
            linked_draft_id: draftId || null,
            activity_type: "outreach",
            direction: "outbound",
            channel: "email",
            subject,
            message_body: body,
            sent_at: new Date().toISOString(),
            metadata: {
              from_email: PLATFORM_FROM_EMAIL,
              from_name: "Recouply.ai",
              reply_to_email: replyToEmail,
              platform_send: true,
              payment_url: paymentUrl || null,
            },
          });

        if (activityError) {
          console.error("Failed to log collection activity:", activityError);
        }
      }
    }

    // Update draft status if provided
    if (draftId) {
      const { error: draftError } = await supabaseClient
        .from("ai_drafts")
        .update({ 
          status: "sent",
          sent_at: new Date().toISOString(),
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
          email: PLATFORM_FROM_EMAIL,
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
