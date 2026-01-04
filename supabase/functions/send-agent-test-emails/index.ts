import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI Agent Personas with their tone characteristics
const agents = [
  {
    name: "Sam",
    bucketRange: "1-30 days past due",
    tone: "Friendly & Helpful",
    subject: "Friendly Reminder: Invoice #TEST-001 Payment Due",
    body: `Hi there,

I hope this message finds you well! I wanted to reach out regarding invoice #TEST-001 for $1,250.00, which was due on December 15th.

I understand that sometimes payments can slip through the cracks—it happens to the best of us! If you've already sent the payment, please disregard this message.

If you have any questions about the invoice or need any assistance, I'm here to help. We truly value your business and appreciate your prompt attention to this matter.

Looking forward to hearing from you!

Warm regards,
Sam
AI Collections Agent (1-30 DPD)
Recouply.ai Test`
  },
  {
    name: "James",
    bucketRange: "31-60 days past due",
    tone: "Direct & Professional",
    subject: "Payment Follow-Up: Invoice #TEST-002 Now 45 Days Overdue",
    body: `Dear Valued Customer,

I'm reaching out regarding invoice #TEST-002 for $2,500.00, which was due on November 20th and is now 45 days past due.

We've attempted to reach you previously without response. I'd like to understand if there are any concerns or issues preventing payment that we can help address.

Please take a moment to review your records and arrange payment at your earliest convenience. If you're experiencing any difficulties, I encourage you to reach out so we can work together on a resolution.

Your prompt attention to this matter is appreciated.

Best regards,
James
AI Collections Agent (31-60 DPD)
Recouply.ai Test`
  },
  {
    name: "Katy",
    bucketRange: "61-90 days past due",
    tone: "Assertive & Businesslike",
    subject: "Important: Invoice #TEST-003 Requires Immediate Attention",
    body: `Dear Customer,

This is an important notice regarding invoice #TEST-003 for $4,750.00, which is now 75 days past due.

This outstanding balance requires your immediate attention. We have made multiple attempts to resolve this matter and have not received payment or communication from you.

Please remit payment today or contact us immediately to discuss payment arrangements. Continued non-payment may result in further action.

We expect to hear from you within 48 hours.

Regards,
Katy
AI Collections Agent (61-90 DPD)
Recouply.ai Test`
  },
  {
    name: "Troy",
    bucketRange: "91-120 days past due",
    tone: "Firm & Urgent",
    subject: "URGENT: Invoice #TEST-004 - Immediate Payment Required",
    body: `To Whom It May Concern,

This is an urgent notification regarding invoice #TEST-004 for $8,200.00, which is now 105 days past due.

Despite previous communications, this account remains unresolved. This is a serious matter that demands your immediate action.

Payment in full is required now. If you are unable to pay the full amount, you must contact us today to discuss alternative arrangements.

Failure to respond will result in escalation of this matter.

Troy
AI Collections Agent (91-120 DPD)
Recouply.ai Test`
  },
  {
    name: "Jimmy",
    bucketRange: "121-150 days past due",
    tone: "Very Firm & Direct",
    subject: "FINAL NOTICE: Invoice #TEST-005 - Immediate Resolution Required",
    body: `Attention Required:

Invoice #TEST-005 for $12,500.00 is now 135 days past due.

This account has been flagged for immediate review. All previous attempts to resolve this matter have been unsuccessful.

You must remit payment immediately or contact us today with a concrete resolution plan. There will be no further warnings.

Resolve this matter now.

Jimmy
AI Collections Agent (121-150 DPD)
Recouply.ai Test`
  },
  {
    name: "Rocco",
    bucketRange: "150+ days past due",
    tone: "Compliance-Focused & Authoritative",
    subject: "CRITICAL: Invoice #TEST-006 - Pre-Escalation Notice",
    body: `IMPORTANT NOTICE

RE: Invoice #TEST-006
Amount Due: $18,750.00
Days Past Due: 165

This account is now in the final stage of our internal collection process. Continued non-payment will result in escalation to external collection procedures, which may include:

- Credit reporting to major bureaus
- Referral to collection agencies
- Potential legal action

This is your opportunity to resolve this matter before escalation. Payment or a verified payment arrangement is required within 5 business days.

Contact us immediately to avoid further action.

Rocco
AI Collections Agent (150+ DPD)
Recouply.ai Test`
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to_email } = await req.json();
    
    if (!to_email) {
      return new Response(
        JSON.stringify({ error: "to_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending test emails for all ${agents.length} agents to ${to_email}`);
    
    const results = [];
    
    for (const agent of agents) {
      console.log(`Sending test email from ${agent.name}...`);
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">🤖 AI Agent Test: ${agent.name}</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">
              ${agent.bucketRange} | Tone: ${agent.tone}
            </p>
          </div>
          <div style="background: #f9fafb; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                Sample Email Content:
              </p>
              <pre style="white-space: pre-wrap; font-family: Georgia, serif; line-height: 1.6; color: #374151; margin: 0;">${agent.body}</pre>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Test Note:</strong> This is a demonstration of the ${agent.name} persona's communication style for the ${agent.bucketRange} aging bucket.
              </p>
            </div>
          </div>
          <div style="padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
            Sent by Recouply.ai Agent Testing System
          </div>
        </div>
      `;
      
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Recouply AI <onboarding@resend.dev>",
            to: [to_email],
            subject: `[TEST] ${agent.name} Agent: ${agent.subject}`,
            html: emailHtml,
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          console.log(`✓ ${agent.name} email sent: ${data.id}`);
          results.push({ agent: agent.name, success: true, messageId: data.id });
        } else {
          console.error(`✗ ${agent.name} email failed:`, data);
          results.push({ agent: agent.name, success: false, error: data });
        }
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`✗ ${agent.name} email error:`, err);
        results.push({ agent: agent.name, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount}/${agents.length} test emails to ${to_email}`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error sending test emails:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});