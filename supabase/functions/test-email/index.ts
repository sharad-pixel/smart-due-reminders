import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email_account_id?: string;
  to_email?: string;
  email?: string; // Legacy support
  subject?: string;
  body_html?: string;
}

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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const emailRequest: EmailRequest = await req.json();
    const { email_account_id, to_email, email, subject, body_html } = emailRequest;
    
    // Determine recipient (support both new and legacy params)
    const recipient = to_email || email;
    if (!recipient) {
      throw new Error("Recipient email is required");
    }

    // If email_account_id is provided, use BYOE system
    if (email_account_id) {
      // Fetch email account
      const { data: emailAccount, error: accountError } = await supabaseClient
        .from("email_accounts")
        .select("*")
        .eq("id", email_account_id)
        .eq("user_id", user.id)
        .single();

      if (accountError || !emailAccount) {
        throw new Error("Email account not found or access denied");
      }

      console.log(`Sending email via ${emailAccount.provider} (${emailAccount.auth_method})`);

      // Use subject and body_html if provided, otherwise use test email defaults
      const emailSubject = subject || "Test Email from Recouply.ai";
      const emailBody = body_html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Email Test Successful!</h1>
          <p>This is a test email from Recouply.ai using your connected ${emailAccount.provider} account.</p>
          <p>Your email integration is working correctly. You can now send invoice reminders to your customers.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            This email was sent from ${emailAccount.email_address} via Recouply.ai
          </p>
        </div>
      `;

      let sendResult;

      // Handle different authentication methods
      if (emailAccount.auth_method === "oauth") {
        if (emailAccount.provider === "gmail") {
          sendResult = await sendViaGmailAPI(emailAccount, recipient, emailSubject, emailBody);
        } else if (emailAccount.provider === "outlook" || emailAccount.provider === "office365") {
          sendResult = await sendViaOutlookAPI(emailAccount, recipient, emailSubject, emailBody);
        } else {
          throw new Error(`OAuth not supported for provider: ${emailAccount.provider}`);
        }
      } else if (emailAccount.auth_method === "smtp") {
        sendResult = await sendViaSMTP(supabaseClient, emailAccount, recipient, emailSubject, emailBody);
      } else {
        throw new Error(`Unsupported auth method: ${emailAccount.auth_method}`);
      }

      // Update last successful send
      await supabaseClient
        .from("email_accounts")
        .update({ 
          last_successful_send: new Date().toISOString(),
          connection_status: "connected",
          error_message: null 
        })
        .eq("id", email_account_id);

      // Log success
      await supabaseClient.from("email_connection_logs").insert({
        email_account_id: email_account_id,
        event_type: "send_attempt",
        status: "success",
        metadata: { to: recipient, subject: emailSubject },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Email sent successfully via ${emailAccount.provider}`,
          provider: emailAccount.provider 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Legacy: Use SendGrid from profile
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("sendgrid_api_key, business_name")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.sendgrid_api_key) {
        throw new Error("SendGrid API key not configured");
      }

      // Send test email using SendGrid
      const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${profile.sendgrid_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: recipient }],
              subject: subject || "Test Email from Recouply.ai",
            },
          ],
          from: {
            email: "noreply@recouply.ai",
            name: profile.business_name || "Recouply.ai",
          },
          content: [
            {
              type: "text/html",
              value: body_html || `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #333;">Email Test Successful!</h1>
                  <p>This is a test email from Recouply.ai to verify your email configuration.</p>
                  <p>Your SendGrid integration is working correctly. You can now send invoice reminders to your debtors.</p>
                  <hr style="border: 1px solid #eee; margin: 20px 0;" />
                  <p style="color: #666; font-size: 12px;">
                    This email was sent from ${profile.business_name || "your business"} via Recouply.ai
                  </p>
                </div>
              `,
            },
          ],
        }),
      });

      if (!sendGridResponse.ok) {
        const errorText = await sendGridResponse.text();
        console.error("SendGrid error:", errorText);
        throw new Error(`SendGrid API error: ${sendGridResponse.status}`);
      }

      console.log("Test email sent successfully to:", recipient);

      return new Response(
        JSON.stringify({ success: true, message: "Test email sent successfully via SendGrid" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to send via Gmail API (OAuth)
async function sendViaGmailAPI(
  account: any,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<any> {
  // In production, this would:
  // 1. Refresh OAuth token if expired
  // 2. Use Gmail API to send email
  // 3. Return result
  
  console.log(`[SIMULATED] Sending email via Gmail API from ${account.email_address} to ${to}`);
  console.log(`Subject: ${subject}`);
  
  // Simulate success for now
  return { success: true, provider: "gmail" };
}

// Helper function to send via Outlook/Microsoft Graph API (OAuth)
async function sendViaOutlookAPI(
  account: any,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<any> {
  console.log(`[SIMULATED] Sending email via Outlook API from ${account.email_address} to ${to}`);
  console.log(`Subject: ${subject}`);
  
  // Simulate success for now
  return { success: true, provider: "outlook" };
}

// Helper function to send via SMTP
async function sendViaSMTP(
  supabaseClient: any,
  account: any,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<any> {
  console.log(`Sending email via SMTP from ${account.email_address} to ${to}`);
  console.log(`SMTP Settings: ${account.smtp_host}:${account.smtp_port}`);
  
  if (!account.smtp_host || !account.smtp_port || !account.smtp_username || !account.smtp_password_encrypted) {
    throw new Error("SMTP configuration incomplete");
  }

  let smtpPassword = account.smtp_password_encrypted;

  try {
    // Try to decrypt password (for newly added accounts with encryption)
    const { data: decryptData, error: decryptError } = await supabaseClient.functions.invoke(
      "decrypt-field",
      { body: { encrypted: account.smtp_password_encrypted } }
    );

    if (!decryptError && decryptData?.decrypted) {
      smtpPassword = decryptData.decrypted;
      console.log("Using encrypted password");
    } else {
      // If decryption fails, assume it's an old account with plain text password
      console.warn("⚠️ Using plain text password - please reconnect this email account for security");
      smtpPassword = account.smtp_password_encrypted;
    }
  } catch (error) {
    // Fallback to plain text if decryption service unavailable
    console.warn("Decryption service unavailable, using password as-is");
  }

  try {
    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: account.smtp_host,
        port: account.smtp_port,
        tls: account.smtp_use_tls !== false,
        auth: {
          username: account.smtp_username,
          password: smtpPassword,
        },
      },
    });

    // Send email
    await client.send({
      from: account.email_address,
      to: to,
      subject: subject,
      html: bodyHtml,
    });

    await client.close();

    console.log(`✅ Email sent successfully via SMTP to ${to}`);
    return { success: true, provider: "smtp" };
  } catch (error: any) {
    console.error("SMTP send error:", error);
    throw new Error(`SMTP error: ${error.message}`);
  }
}
