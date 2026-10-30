import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isPaymentDocumentAvailable } from "../_shared/paymentDocumentAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) return reply({ error: "Invalid invoice link" }, 400);
    const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    // Reuse the same authorization gate as the invoice: token and enabled links.
    const { data: invoiceData, error: invoiceError } = await client.rpc("get_public_invoice", { p_token: token });
    if (invoiceError || invoiceData?.error || !invoiceData?.invoice?.id) return reply({ error: "Invoice not available" }, 404);
    const { data: links, error } = await client.from("invoice_document_attachments")
      .select("documents(id,file_name,file_url,file_type,category,status,expires_at)")
      .eq("invoice_id", invoiceData.invoice.id);
    if (error) throw error;
    const documents = [];
    for (const link of links ?? []) {
      const doc = link.documents as unknown as { id: string; file_name: string; file_url: string; file_type: string; category: string; status: string; expires_at: string | null } | null;
      if (!doc || !isPaymentDocumentAvailable(doc)) continue;
      const { data: signed, error: signError } = await client.storage.from("documents").createSignedUrl(doc.file_url, 300, { download: doc.file_name });
      if (signError) throw signError;
      documents.push({ id: doc.id, file_name: doc.file_name, category: doc.category, url: signed.signedUrl });
    }
    return reply({ documents });
  } catch {
    return reply({ error: "Unable to load payment documents" }, 500);
  }
});