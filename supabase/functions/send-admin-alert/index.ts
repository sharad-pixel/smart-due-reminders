import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { wrapEmailContent } from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminAlertRequest {
  type: "waitlist" | "signup" | "contact_request" | "design_partner_application";
  email: string;
  name?: string;
  company?: string;
  message?: string;
  billingSystem?: string;
  monthlyInvoices?: string;
  teamSize?: string;
}

serve(async (req) => {
  console.log("send-admin-alert function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { type, email, name, company, message, billingSystem, monthlyInvoices, teamSize }: AdminAlertRequest = await req.json();
    console.log(`Processing admin alert for ${type}: ${email}`);

    const adminEmail = "sharad@recouply.ai";
    let subject = "";
    let bodyContent = "";

    if (type === "waitlist") {
      subject = "🎉 New Early Access Request - RecouplyAI Inc.";
      bodyContent = `
        <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
          🎉 New Early Access Request!
        </h2>
        
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
          Someone new is requesting early access to Recouply.ai!
        </p>

        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 28px; margin: 28px 0;">
          <p style="margin: 0 0 8px; color: #93c5fd; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
            Early Access Request Details
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            ${name ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px; border-bottom: 1px solid rgba(255,255,255,0.1);">Name:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1);">${name}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px; border-bottom: 1px solid rgba(255,255,255,0.1);">Email:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1);">${email}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px;">Requested:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #1e3a5f; font-size: 16px; font-weight: 600;">
            📋 Recommended Actions
          </h3>
          <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px; line-height: 2;">
            <li>Review the request in the Admin Command Center</li>
            <li>Add the user to the early access whitelist if approved</li>
            <li>Send a personalized welcome message</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="https://recouply.ai/admin/waitlist" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            Review in Admin Dashboard →
          </a>
        </div>
      `;
    } else if (type === "signup") {
      subject = "🚀 New User Signup - RecouplyAI Inc.";
      bodyContent = `
        <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
          🚀 New User Signed Up!
        </h2>
        
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
          A new user has successfully signed up for Recouply.ai. Time to welcome them to the CashOps revolution!
        </p>

        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 28px; margin: 28px 0;">
          <p style="margin: 0 0 8px; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
            New User Details
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px; border-bottom: 1px solid rgba(255,255,255,0.2);">Email:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${email}</td>
            </tr>
            ${name ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px; border-bottom: 1px solid rgba(255,255,255,0.2);">Name:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${name}</td>
            </tr>
            ` : ''}
            ${company ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px; border-bottom: 1px solid rgba(255,255,255,0.2);">Company:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${company}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 100px;">Signed Up:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #1e3a5f; font-size: 16px; font-weight: 600;">
            📋 New User Onboarding Checklist
          </h3>
          <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px; line-height: 2;">
            <li>Welcome email has been automatically sent</li>
            <li>User has been enrolled in free tier (15 invoices)</li>
            <li>Consider scheduling a personal onboarding call</li>
            <li>Monitor their first 24 hours of activity</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="https://recouply.ai/admin/users" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            View in User Management →
          </a>
        </div>
      `;
    } else if (type === "contact_request") {
      subject = "📋 New Custom Pricing Request - RecouplyAI Inc.";
      bodyContent = `
        <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
          📋 New Custom Pricing Request!
        </h2>
        
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
          Someone has submitted a request for custom/bespoke pricing!
        </p>

        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px; padding: 28px; margin: 28px 0;">
          <p style="margin: 0 0 8px; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
            Contact Request Details
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.2);">Name:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${name || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.2);">Email:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${email}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.2);">Company:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${company || 'Not provided'}</td>
            </tr>
            ${billingSystem ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.2);">Billing System:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${billingSystem}</td>
            </tr>
            ` : ''}
            ${monthlyInvoices ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.2);">Monthly Invoices:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${monthlyInvoices}</td>
            </tr>
            ` : ''}
            ${teamSize ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.2);">Team Size:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.2);">${teamSize}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px;">Submitted:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
            </tr>
          </table>
        </div>

        ${message ? `
        <div style="background-color: #faf5ff; border-left: 4px solid #7c3aed; border-radius: 0 8px 8px 0; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #5b21b6; font-size: 16px; font-weight: 600;">
            💬 Their Message
          </h3>
          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${message}</p>
        </div>
        ` : ''}

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #1e3a5f; font-size: 16px; font-weight: 600;">
            📋 Recommended Actions
          </h3>
          <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px; line-height: 2;">
            <li>Review the request details above</li>
            <li>Schedule a discovery call within 24 hours</li>
            <li>Prepare a custom pricing proposal</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="mailto:${email}?subject=Re: Your Recouply.ai Custom Pricing Request" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            Reply to ${name || 'Prospect'} →
          </a>
        </div>
      `;
    } else if (type === "design_partner_application") {
      subject = "🤝 New Design Partner Application - RecouplyAI Inc.";
      bodyContent = `
        <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
          🤝 New Design Partner Application!
        </h2>
        
        <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
          Someone has applied to become a Design Partner for Recouply.ai!
        </p>

        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 28px; margin: 28px 0;">
          <p style="margin: 0 0 8px; color: #93c5fd; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
            Design Partner Application Details
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.1);">Name:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1);">${name || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.1);">Email:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1);">${email}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.1);">Company:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1);">${company || 'Not provided'}</td>
            </tr>
            ${monthlyInvoices ? `
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px; border-bottom: 1px solid rgba(255,255,255,0.1);">Monthly Invoices:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1);">${monthlyInvoices}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 12px 0; color: rgba(255,255,255,0.7); font-size: 14px; width: 120px;">Submitted:</td>
              <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 500;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
            </tr>
          </table>
        </div>

        ${message ? `
        <div style="background-color: #f0f9ff; border-left: 4px solid #1e3a5f; border-radius: 0 8px 8px 0; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #1e3a5f; font-size: 16px; font-weight: 600;">
            💬 Application Details
          </h3>
          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${message}</p>
        </div>
        ` : ''}

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px; color: #1e3a5f; font-size: 16px; font-weight: 600;">
            📋 Recommended Actions
          </h3>
          <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px; line-height: 2;">
            <li>Review the application within 48 hours</li>
            <li>Schedule an introductory call if qualified</li>
            <li>Add to early access whitelist if approved</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="mailto:${email}?subject=Your Recouply.ai Design Partner Application" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            Reply to ${name || 'Applicant'} →
          </a>
        </div>
      `;
    } else {
      throw new Error("Invalid alert type");
    }

    const branding = {
      business_name: "RecouplyAI Inc.",
      from_name: "Admin Alerts",
      primary_color: "#1e3a5f"
    };

    const htmlContent = wrapEmailContent(bodyContent, branding);

    console.log(`Sending admin alert email to ${adminEmail}`);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "RecouplyAI Inc. <notifications@send.inbound.services.recouply.ai>",
        to: [adminEmail],
        reply_to: "support@recouply.ai",
        subject,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      throw new Error(resendData.message || "Failed to send email");
    }

    console.log("Admin alert email sent successfully:", resendData);

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-admin-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
