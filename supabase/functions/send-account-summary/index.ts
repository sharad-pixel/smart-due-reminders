import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform email configuration
const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";
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

    const { debtorId, subject, message, invoices, attachedLinks, attachedDocs }: RequestBody = await req.json();

    console.log("Sending account summary to debtor:", debtorId);

    // Fetch debtor details
    const { data: debtor, error: debtorError } = await supabase
      .from("debtors")
      .select("*")
      .eq("id", debtorId)
      .single();

    if (debtorError || !debtor) {
      throw new Error("Debtor not found");
    }

    // Use platform reply-to address based on debtor
    const replyToAddress = `debtor+${debtorId}@${PLATFORM_INBOUND_DOMAIN}`;

    // Build invoice table HTML
    let invoiceTableHtml = "";
    if (invoices.length > 0) {
      const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
      
      invoiceTableHtml = `
        <h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 16px; font-weight: 600;">Open Invoices</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Invoice #</th>
              <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Issue Date</th>
              <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Due Date</th>
              <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
              <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-family: monospace;">${inv.invoice_number}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${new Date(inv.issue_date).toLocaleDateString()}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${new Date(inv.due_date).toLocaleDateString()}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${inv.amount.toLocaleString()}</td>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">
                  <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; ${inv.status === 'Open' ? 'background-color: #fef3c7; color: #92400e;' : 'background-color: #ddd6fe; color: #5b21b6;'}">
                    ${inv.status}
                  </span>
                </td>
              </tr>
            `).join('')}
            <tr style="background-color: #f9fafb; font-weight: 600;">
              <td colspan="3" style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">Total Outstanding:</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">$${totalAmount.toLocaleString()}</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;"></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Build links HTML
    let linksHtml = "";
    if (attachedLinks.length > 0) {
      linksHtml = `
        <h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 16px; font-weight: 600;">Helpful Links</h3>
        <ul style="list-style-type: none; padding: 0;">
          ${attachedLinks.map(link => `
            <li style="margin-bottom: 8px;">
              <a href="${link.url}" style="color: #2563eb; text-decoration: none;">
                🔗 ${link.label}
              </a>
            </li>
          `).join('')}
        </ul>
      `;
    }

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="white-space: pre-wrap; line-height: 1.6;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        
        ${invoiceTableHtml}
        ${linksHtml}
        
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from your collections team.</p>
        </div>
      </div>
    `;

    console.log(`Sending email via platform from ${PLATFORM_FROM_EMAIL} to ${debtor.email}`);

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
          from: PLATFORM_FROM_EMAIL,
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
        total_amount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
        attached_links: attachedLinks.length,
        reply_to: replyToAddress,
        platform_send: true,
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
          sent_from: PLATFORM_FROM_EMAIL,
          sent_at: new Date().toISOString(),
          status: "sent",
          delivery_metadata: {
            activity_id: activity?.id,
            type: "account_summary",
            invoice_count: invoices.length,
            reply_to: replyToAddress,
            platform_send: true,
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
