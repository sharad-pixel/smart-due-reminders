import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { importId, action, debtorId, newDebtor } = body;
    if (!importId || !action) throw new Error("importId and action required");

    const { data: imp } = await supabase.from("live_contract_imports").select("*").eq("id", importId).single();
    if (!imp) throw new Error("Import not found");

    if (action === "reject") {
      await supabase.from("live_contract_imports").update({ status: "rejected" }).eq("id", imp.id);
      await supabase.from("live_contract_review_queue").update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("import_id", imp.id);
      await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "import_rejected", event_details: {} });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "mark_duplicate") {
      await supabase.from("live_contract_imports").update({ status: "duplicate", duplicate_of: body.duplicateOf || null }).eq("id", imp.id);
      await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "marked_duplicate", event_details: { duplicate_of: body.duplicateOf } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "approve") {
      let finalDebtorId = debtorId;

      if (!finalDebtorId && newDebtor) {
        const { data: created, error: cErr } = await supabase.from("debtors").insert({
          account_id: imp.account_id,
          user_id: user.id,
          company_name: newDebtor.company_name,
          primary_email: newDebtor.primary_email || null,
          phone: newDebtor.phone || null,
          billing_address: newDebtor.address || null,
        }).select("id").single();
        if (cErr) throw new Error(`Create debtor: ${cErr.message}`);
        finalDebtorId = created.id;
        await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_created", event_details: { debtor_id: finalDebtorId } });
      } else if (finalDebtorId) {
        await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_matched", event_details: { debtor_id: finalDebtorId } });
      } else {
        throw new Error("debtorId or newDebtor required to approve");
      }

      // Backfill debtor on related rows
      await supabase.from("live_contract_imports").update({ debtor_id: finalDebtorId, status: "imported" }).eq("id", imp.id);
      await supabase.from("contract_critical_dates").update({ debtor_id: finalDebtorId }).eq("import_id", imp.id);
      await supabase.from("contract_invoice_schedules").update({ debtor_id: finalDebtorId }).eq("import_id", imp.id);
      await supabase.from("contract_risk_flags").update({ debtor_id: finalDebtorId }).eq("import_id", imp.id);
      await supabase.from("contract_poc_details").update({ debtor_id: finalDebtorId }).eq("import_id", imp.id);

      // Mark all extracted fields as approved
      await supabase.from("live_contract_extracted_fields").update({ approved: true }).eq("import_id", imp.id);

      // Mark selected match
      if (debtorId) {
        await supabase.from("contract_customer_matches").update({ is_selected: true }).eq("import_id", imp.id).eq("candidate_debtor_id", debtorId);
      }

      await supabase.from("live_contract_review_queue").update({
        status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq("import_id", imp.id);

      await supabase.from("live_contract_audit_log").insert({
        account_id: imp.account_id, user_id: user.id, import_id: imp.id,
        event_type: "contract_imported", event_details: { debtor_id: finalDebtorId },
      });

      return new Response(JSON.stringify({ success: true, debtor_id: finalDebtorId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_field") {
      const { fieldId, value } = body;
      await supabase.from("live_contract_extracted_fields").update({
        field_value: value, edited_by_user: user.id,
      }).eq("id", fieldId);
      await supabase.from("live_contract_audit_log").insert({
        account_id: imp.account_id, user_id: user.id, import_id: imp.id,
        event_type: "field_edited", event_details: { field_id: fieldId },
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
