import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminAlertRequest {
  type: "waitlist" | "signup";
  email: string;
  name?: string;
  company?: string;
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
    const { type, email, name, company }: AdminAlertRequest = await req.json();
    console.log(`Processing admin alert for ${type}: ${email}`);

    const adminEmail = "sharad@recouply.ai";
    let subject = "";
    let html = "";

    if (type === "waitlist") {
      subject = "🎉 New Early Access Request - Recouply.ai";
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; margin-bottom: 24px;">New Early Access Request!</h1>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            ${name ? `<p style="margin: 0 0 12px 0;"><strong>Name:</strong> ${name}</p>` : ''}
            <p style="margin: 0 0 12px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">Someone new is requesting early access to Recouply.ai!</p>
        </div>
      `;
    } else if (type === "signup") {
      subject = "🚀 New User Signup - Recouply.ai";
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; margin-bottom: 24px;">New User Signed Up!</h1>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 12px 0;"><strong>Email:</strong> ${email}</p>
            ${name ? `<p style="margin: 0 0 12px 0;"><strong>Name:</strong> ${name}</p>` : ''}
            ${company ? `<p style="margin: 0 0 12px 0;"><strong>Company:</strong> ${company}</p>` : ''}
            <p style="margin: 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">A new user has signed up for Recouply.ai!</p>
        </div>
      `;
    } else {
      throw new Error("Invalid alert type");
    }

    console.log(`Sending admin alert email to ${adminEmail}`);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
        to: [adminEmail],
        subject,
        html,
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
