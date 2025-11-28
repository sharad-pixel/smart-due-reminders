import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decrypt encrypted values
async function decryptValue(encryptedValue: string): Promise<string> {
  const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("Encryption key not configured");
  }

  const data = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const encryptedData = data.slice(12);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );

  return new TextDecoder().decode(decryptedData);
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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { accountId, recipientEmail } = await req.json();

    if (!accountId || !recipientEmail) {
      throw new Error("Account ID and recipient email are required");
    }

    // Fetch the email account
    const { data: account, error: accountError } = await supabaseClient
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      throw new Error("Email account not found");
    }

    console.log(`Testing email account ${account.email_address} (${account.provider})`);

    // Decrypt the SMTP password
    const smtpPassword = await decryptValue(account.smtp_password_encrypted);
    
    const testEmailContent = {
      from: {
        email: account.email_address,
        name: account.display_name,
      },
      to: [{ email: recipientEmail }],
      subject: "Your email account is connected to Recouply.ai",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px;">
            ✅ Email Account Connected!
          </h1>
          
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            Great news! Your email account has been successfully connected to Recouply.ai for collections outreach.
          </p>
          
          <div style="background-color: #F3F4F6; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Connected Account Details</h3>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${account.email_address}</p>
            <p style="margin: 5px 0;"><strong>Display Name:</strong> ${account.display_name}</p>
            <p style="margin: 5px 0;"><strong>Provider:</strong> ${account.provider}</p>
            <p style="margin: 5px 0;"><strong>Auth Method:</strong> ${account.auth_method}</p>
          </div>
          
          <h3 style="color: #333; margin-top: 30px;">What's Next?</h3>
          <ul style="font-size: 14px; color: #555; line-height: 1.8;">
            <li>All collection emails will now be sent from your email address</li>
            <li>Replies will automatically flow into Recouply for workflow processing</li>
            <li>Your customers will see emails from your business, not Recouply.ai</li>
            <li>You can monitor email activity in your Recouply dashboard</li>
          </ul>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="font-size: 12px; color: #888; margin: 0;">
              This test email was sent by Recouply.ai to verify your email account connection.
              <br />
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      `,
    };

    console.log("Sending test email via SMTP...");

    // Actually send the email via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: account.smtp_host,
        port: account.smtp_port,
        tls: account.smtp_use_tls || account.smtp_port === 465,
        auth: {
          username: account.smtp_username,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: `${account.display_name} <${account.email_address}>`,
      to: recipientEmail,
      subject: testEmailContent.subject,
      html: testEmailContent.html,
    });

    await client.close();
    
    console.log("Test email sent successfully via SMTP");

    // Update the last_verified_at timestamp
    await supabaseClient
      .from("email_accounts")
      .update({
        last_verified_at: new Date().toISOString(),
        is_verified: true,
        connection_status: "connected",
      })
      .eq("id", accountId);

    // Log the connection test
    await supabaseClient
      .from("email_connection_logs")
      .insert({
        email_account_id: accountId,
        event_type: "send_attempt",
        status: "success",
        metadata: {
          recipient: recipientEmail,
          test_email: true,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test email sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in test-email-account function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send test email" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
