import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmailSignature } from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform email configuration
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

interface Invoice {
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: string;
}

interface AttachedLink {
  label: string;
  url: string;
}

interface RequestBody {
  debtorId: string;
  subject: string;
  message: string;
  invoices: Invoice[];
  attachedLinks: AttachedLink[];
  attachedDocs: any[];
  paymentUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { debtorId, subject, message, invoices, attachedLinks, attachedDocs, paymentUrl }: RequestBody = await req.json();

    console.log("Sending account summary to debtor:", debtorId);

    // Fetch user's branding settings
    const { data: branding, error: brandingError } = await supabase
      .from("branding_settings")
      .select("business_name, from_name, from_email, reply_to_email, email_signature, email_footer, logo_url, primary_color")
      .eq("user_id", user.id)
      .single();

    if (brandingError && brandingError.code !== "PGRST116") {
      console.error("Error fetching branding settings:", brandingError);
    }

    const brandingSettings = branding || {
      business_name: "Recouply.ai",
      from_name: null,
      from_email: null,
      reply_to_email: null,
      email_signature: null,
      email_footer: null,
      logo_url: null,
      primary_color: "#1e3a5f",
    };

    console.log("Using branding settings:", brandingSettings);

    // Fetch debtor details
    const { data: debtor, error: debtorError } = await supabase
      .from("debtors")
      .select("*")
      .eq("id", debtorId)
      .single();

    if (debtorError || !debtor) {
      throw new Error("Debtor not found");
    }

    if (!debtor.email || debtor.email.trim() === "") {
      throw new Error("Debtor does not have an email address configured. Please add an email address to send the account summary.");
    }

    // Determine from address
    const fromName = brandingSettings.from_name || brandingSettings.business_name || "Recouply.ai";
    const fromEmail = `${fromName} <notifications@send.inbound.services.recouply.ai>`;
    
    // Use platform reply-to address based on debtor for inbound routing
    const replyToAddress = `debtor+${debtorId}@${PLATFORM_INBOUND_DOMAIN}`;

    const primaryColor = brandingSettings.primary_color || "#1e3a5f";
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Build invoice table HTML
    let invoiceTableHtml = "";
    if (invoices.length > 0) {
      invoiceTableHtml = `
        <h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 16px; font-weight: 600; color: #1e293b;">Open Invoices</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: linear-gradient(135deg, ${primaryColor} 0%, #2d5a87 100%);">
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Invoice #</th>
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Issue Date</th>
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Due Date</th>
              <th style="padding: 12px 16px; text-align: right; color: #ffffff; font-weight: 600;">Amount</th>
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map((inv, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #1e293b;">${inv.invoice_number}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${new Date(inv.issue_date).toLocaleDateString()}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${new Date(inv.due_date).toLocaleDateString()}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">$${inv.amount.toLocaleString()}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                  <span style="padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; ${inv.status === 'Open' ? 'background-color: #fef3c7; color: #92400e;' : 'background-color: #ddd6fe; color: #5b21b6;'}">
                    ${inv.status}
                  </span>
                </td>
              </tr>
            `).join('')}
            <tr style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
              <td colspan="3" style="padding: 14px 16px; text-align: right; font-weight: 700; color: #1e293b;">Total Outstanding:</td>
              <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #1e293b; font-size: 18px;">$${totalAmount.toLocaleString()}</td>
              <td style="padding: 14px 16px;"></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Build links HTML
    let linksHtml = "";
    if (attachedLinks.length > 0) {
      linksHtml = `
        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1e293b;">Helpful Links</h3>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
            ${attachedLinks.map(link => `
              <li style="margin-bottom: 8px;">
                <a href="${link.url}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                  🔗 ${link.label}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Generate signature with payment link
    const signature = generateEmailSignature(
      brandingSettings,
      {
        paymentUrl: paymentUrl,
        amount: totalAmount,
      }
    );

    // Build email content body
    const emailContent = `
      <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      ${invoiceTableHtml}
      ${linksHtml}
    `;

    // Build full email HTML with branding wrapper
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 32px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="700" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header with branding -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #2d5a87 100%); border-radius: 12px 12px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    ${brandingSettings.logo_url 
                      ? `<img src="${brandingSettings.logo_url}" alt="${brandingSettings.business_name}" style="max-height: 48px; max-width: 180px; height: auto;" />`
                      : `<span style="color: #ffffff; font-size: 20px; font-weight: 700;">${brandingSettings.business_name || 'Account Summary'}</span>`
                    }
                  </td>
                  <td style="text-align: right;">
                    <span style="color: rgba(255,255,255,0.9); font-size: 14px;">Account Summary</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; color: #1e293b; font-size: 15px;">
              ${emailContent}
              ${signature}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    console.log(`Sending email via platform from ${fromEmail} to ${debtor.email}`);

    // Send via platform send-email function
    const sendEmailResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          to: debtor.email,
          from: fromEmail,
          reply_to: replyToAddress,
          subject: subject,
          html: emailHtml,
        }),
      }
    );

    const emailResult = await sendEmailResponse.json();

    if (!sendEmailResponse.ok) {
      throw new Error(`Failed to send email: ${emailResult.error || "Unknown error"}`);
    }

    console.log("Email sent via platform:", emailResult);

    // Log to collection_activities for audit trail
    const { data: activity, error: logError } = await supabase.from("collection_activities").insert({
      user_id: user.id,
      debtor_id: debtorId,
      activity_type: "account_summary",
      channel: "email",
      direction: "outbound",
      subject: subject,
      message_body: message,
      sent_at: new Date().toISOString(),
      metadata: {
        invoice_count: invoices.length,
        total_amount: totalAmount,
        attached_links: attachedLinks.length,
        reply_to: replyToAddress,
        platform_send: true,
        branding_applied: !!branding,
        from_name: fromName,
        payment_url: paymentUrl || null,
      },
    }).select().single();

    if (logError) {
      console.error("Failed to log activity:", logError);
    }

    // Log to outreach_logs so responses can be linked
    if (invoices.length > 0) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", invoices[0].invoice_number)
        .eq("debtor_id", debtorId)
        .single();

      if (invoice) {
        const { error: outreachError } = await supabase.from("outreach_logs").insert({
          user_id: user.id,
          debtor_id: debtorId,
          invoice_id: invoice.id,
          channel: "email",
          subject: subject,
          message_body: message,
          sent_to: debtor.email,
          sent_from: fromEmail,
          sent_at: new Date().toISOString(),
          status: "sent",
          delivery_metadata: {
            activity_id: activity?.id,
            type: "account_summary",
            invoice_count: invoices.length,
            reply_to: replyToAddress,
            platform_send: true,
            branding_applied: !!branding,
            payment_url: paymentUrl || null,
          },
        });

        if (outreachError) {
          console.error("Failed to log outreach:", outreachError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account summary sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending account summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
