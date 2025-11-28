import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Fetch user's email account
    const { data: emailAccount, error: emailError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(1)
      .single();

    if (emailError || !emailAccount) {
      throw new Error("No active email account found. Please set up your email account first.");
    }

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

    // Send via Resend API if using api auth method
    if (emailAccount.auth_method === "api" && emailAccount.provider === "resend") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("Resend API key not configured");
      }

      const resend = new Resend(resendApiKey);
      
      const result = await resend.emails.send({
        from: emailAccount.email_address,
        to: [debtor.email],
        subject: subject,
        html: emailHtml,
      });

      console.log("Email sent via Resend:", result);
    } else {
      // Fallback: invoke test-email function for other email methods
      const { data: emailResult, error: sendError } = await supabase.functions.invoke("test-email", {
        body: {
          accountId: emailAccount.id,
          recipient: debtor.email,
          subject: subject,
          body: emailHtml,
          isHtml: true,
        },
      });

      if (sendError) {
        throw new Error(`Failed to send email: ${sendError.message}`);
      }

      console.log("Email sent via test-email function:", emailResult);
    }

    // Log the outreach
    const { error: logError } = await supabase.from("collection_activities").insert({
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
      },
    });

    if (logError) {
      console.error("Failed to log activity:", logError);
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
