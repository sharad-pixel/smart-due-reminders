// Step 1 of 2: support user enters email -> we email a 6-digit code valid 5 minutes.
// Always returns generic success to avoid email enumeration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(SUPABASE_URL, SERVICE);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;

  // Generic response we always return at the end
  const generic = { success: true, message: "If your email is authorized, a code has been sent." };

  // Lookup support user
  const { data: su } = await admin
    .from("support_users")
    .select("id, email, is_active")
    .ilike("email", email)
    .maybeSingle();

  if (!su || !su.is_active) {
    // Still respond generically. Small delay to mask timing.
    await new Promise((r) => setTimeout(r, 250));
    return json(generic);
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await admin.from("support_login_codes").insert({
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
    ip_address: ip,
  });

  // Send via Resend (project standard)
  if (RESEND_API_KEY) {
    try {
      const html = `
        <div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="color:#1e293b;margin:0 0 8px">Recouply Support Login Code</h2>
          <p style="color:#475569;margin:0 0 16px">Use this code to sign in. It expires in 5 minutes.</p>
          <div style="font-size:32px;letter-spacing:6px;font-weight:700;color:#3B82F6;background:#f1f5f9;padding:16px;text-align:center;border-radius:6px">${code}</div>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px">If you did not request this, ignore this email.</p>
        </div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Recouply Support <support@recouply.ai>",
          to: [email],
          subject: `Recouply Support Login Code: ${code}`,
          html,
        }),
      });
      if (!r.ok) console.error("Resend send failed", await r.text());
    } catch (e) {
      console.error("Email send error", e);
    }
  } else {
    console.warn("RESEND_API_KEY not set; code for", email, "=", code);
  }

  return json(generic);
});
