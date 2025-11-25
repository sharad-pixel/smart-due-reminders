import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common email provider configurations
const EMAIL_PROVIDERS: Record<string, any> = {
  gmail: {
    name: "Gmail",
    smtp: { host: "smtp.gmail.com", port: 587, tls: true },
    imap: { host: "imap.gmail.com", port: 993, tls: true },
    oauth: true,
    instructions: "Use 'Sign in with Google' for easiest setup, or create an App Password in your Google Account settings."
  },
  outlook: {
    name: "Outlook/Office 365",
    smtp: { host: "smtp-mail.outlook.com", port: 587, tls: true },
    imap: { host: "outlook.office365.com", port: 993, tls: true },
    oauth: true,
    instructions: "Use OAuth for best security, or enable IMAP in Outlook settings and use your account password."
  },
  yahoo: {
    name: "Yahoo Mail",
    smtp: { host: "smtp.mail.yahoo.com", port: 587, tls: true },
    imap: { host: "imap.mail.yahoo.com", port: 993, tls: true },
    oauth: false,
    instructions: "Generate an App Password in Yahoo Account Security settings. Don't use your regular password."
  },
  icloud: {
    name: "iCloud Mail",
    smtp: { host: "smtp.mail.me.com", port: 587, tls: true },
    imap: { host: "imap.mail.me.com", port: 993, tls: true },
    oauth: false,
    instructions: "Generate an App-Specific Password in Apple ID settings. Your regular password won't work."
  },
  zoho: {
    name: "Zoho Mail",
    smtp: { host: "smtp.zoho.com", port: 587, tls: true },
    imap: { host: "imap.zoho.com", port: 993, tls: true },
    oauth: false,
    instructions: "Use your Zoho account password or generate an App Password for better security."
  },
  protonmail: {
    name: "ProtonMail",
    smtp: { host: "127.0.0.1", port: 1025, tls: false },
    imap: { host: "127.0.0.1", port: 1143, tls: false },
    oauth: false,
    instructions: "ProtonMail requires the ProtonMail Bridge app running locally. Download it from proton.me/bridge"
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, email, issue } = await req.json();

    // Action: detect provider from email
    if (action === "detect_provider") {
      const domain = email.split('@')[1]?.toLowerCase();
      let provider = "custom";
      let config = null;

      // Auto-detect common providers
      if (domain?.includes('gmail.com')) {
        provider = "gmail";
        config = EMAIL_PROVIDERS.gmail;
      } else if (domain?.includes('outlook.com') || domain?.includes('hotmail.com') || domain?.includes('live.com')) {
        provider = "outlook";
        config = EMAIL_PROVIDERS.outlook;
      } else if (domain?.includes('yahoo.com')) {
        provider = "yahoo";
        config = EMAIL_PROVIDERS.yahoo;
      } else if (domain?.includes('icloud.com') || domain?.includes('me.com') || domain?.includes('mac.com')) {
        provider = "icloud";
        config = EMAIL_PROVIDERS.icloud;
      } else if (domain?.includes('zoho.com')) {
        provider = "zoho";
        config = EMAIL_PROVIDERS.zoho;
      } else if (domain?.includes('protonmail.com') || domain?.includes('proton.me')) {
        provider = "protonmail";
        config = EMAIL_PROVIDERS.protonmail;
      }

      return new Response(
        JSON.stringify({ provider, config }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Action: get AI troubleshooting help
    if (action === "troubleshoot") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      const systemPrompt = `You are an email configuration expert. Help users troubleshoot email connection issues with clear, actionable advice. Focus on:
1. Common authentication issues (app passwords, OAuth)
2. SMTP/IMAP settings verification
3. Security settings (2FA, less secure apps)
4. Firewall/network issues
5. Provider-specific quirks

Keep responses concise, friendly, and actionable. Provide step-by-step solutions.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Email: ${email}\n\nIssue: ${issue}\n\nProvide troubleshooting steps.` }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI request failed: ${errorText}`);
      }

      const aiData = await response.json();
      const suggestion = aiData.choices[0]?.message?.content || "Unable to generate suggestion";

      return new Response(
        JSON.stringify({ suggestion }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Action: get setup guidance
    if (action === "get_guidance") {
      const domain = email.split('@')[1]?.toLowerCase();
      let provider = "custom";
      
      // Detect provider
      if (domain?.includes('gmail.com')) provider = "gmail";
      else if (domain?.includes('outlook.com') || domain?.includes('hotmail.com')) provider = "outlook";
      else if (domain?.includes('yahoo.com')) provider = "yahoo";
      else if (domain?.includes('icloud.com')) provider = "icloud";
      else if (domain?.includes('zoho.com')) provider = "zoho";
      else if (domain?.includes('protonmail.com')) provider = "protonmail";

      const config = EMAIL_PROVIDERS[provider];
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      if (!LOVABLE_API_KEY) {
        // Fallback to static guidance
        return new Response(
          JSON.stringify({
            provider,
            config,
            guidance: config?.instructions || "Configure SMTP and IMAP settings manually."
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const systemPrompt = `You are a friendly email setup assistant. Provide clear, step-by-step guidance for connecting an email account. Be encouraging and helpful. Focus on security best practices.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `User wants to connect ${email} (${config?.name || 'custom provider'}). ${config?.instructions || ''}\n\nProvide friendly, step-by-step setup guidance in 3-4 sentences.`
            }
          ],
        }),
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            provider,
            config,
            guidance: config?.instructions || "Configure SMTP and IMAP settings manually."
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const aiData = await response.json();
      const guidance = aiData.choices[0]?.message?.content || config?.instructions || "Configure your email settings.";

      return new Response(
        JSON.stringify({ provider, config, guidance }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    console.error("Error in email-setup-assistant:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
