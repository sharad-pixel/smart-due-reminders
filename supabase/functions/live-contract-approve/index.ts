import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function normalizeCompanyName(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|plc|systems|system)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmailDomain(value?: string | null): string | null {
  const text = String(value || "").toLowerCase();
  const match = text.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (match?.[1]) return match[1].replace(/^www\./, "");
  const domain = text.replace(/^@/, "").replace(/^www\./, "").trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : null;
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter((t) => t.length > 2));
  const bTokens = new Set(b.split(" ").filter((t) => t.length > 2));
  if (!aTokens.size || !bTokens.size) return 0;
  let matches = 0;
  for (const token of aTokens) if (bTokens.has(token)) matches += 1;
  return matches / Math.max(aTokens.size, bTokens.size);
}

function scoreCustomerMatch(cust: any, debtor: any): number {
  const extractedNames = [cust.legal_name, cust.dba_name, cust.billing_entity, cust.company_name].filter(Boolean).map(normalizeCompanyName);
  const debtorNames = [debtor.company_name, debtor.name].filter(Boolean).map(normalizeCompanyName);
  let score = 0;
  for (const extracted of extractedNames) {
    for (const candidate of debtorNames) {
      if (!extracted || !candidate) continue;
      if (extracted === candidate) score = Math.max(score, 95);
      else if (extracted.length > 6 && candidate.length > 6 && (extracted.includes(candidate) || candidate.includes(extracted))) score = Math.max(score, 85);
      else {
        const overlap = tokenOverlap(extracted, candidate);
        if (overlap >= 0.75) score = Math.max(score, 75);
        else if (overlap >= 0.5) score = Math.max(score, 60);
      }
    }
  }
  const extractedDomains = [cust.email_domain, cust.billing_contact, cust.primary_contact, cust.legal_contact, cust.procurement_contact, cust.primary_email]
    .map(extractEmailDomain)
    .filter(Boolean);
  const debtorDomain = extractEmailDomain(debtor.email);
  if (debtorDomain && extractedDomains.includes(debtorDomain) && !["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"].includes(debtorDomain)) score = Math.max(score, 90);
  return score;
}

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
      let createdNew = false;
      let resolvedNewDebtor = newDebtor;
      let extractedCustomer: any = {};
      let matchVia: string | null = null;

      if (!finalDebtorId) {
        const { data: extraction } = await supabase
          .from("live_contract_extractions")
          .select("ai_response")
          .eq("import_id", imp.id)
          .order("extracted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        extractedCustomer = (extraction?.ai_response as any)?.customer || {};
      }

      // Auto-fallback: if no debtor selected and no manual newDebtor payload,
      // build one from the extracted customer fields so an account is always created.
      if (!finalDebtorId && (!resolvedNewDebtor || !resolvedNewDebtor.company_name)) {
        const company = extractedCustomer.legal_name || extractedCustomer.dba_name || extractedCustomer.billing_entity || imp.contract_name || imp.file_name;
        if (company) {
          const emailGuess = extractedCustomer.billing_contact || extractedCustomer.primary_contact ||
            (extractedCustomer.email_domain ? `billing@${String(extractedCustomer.email_domain).replace(/^@/, "")}` : null);
          resolvedNewDebtor = {
            company_name: company,
            primary_email: emailGuess,
            phone: null,
            address: extractedCustomer.address || null,
          };
        }
      }

      if (!finalDebtorId && resolvedNewDebtor && resolvedNewDebtor.company_name) {
        // De-dupe: first try saved extraction matches, then score existing customers
        // before creating a new account from contract information.
        const { data: savedMatch } = await supabase
          .from("contract_customer_matches")
          .select("candidate_debtor_id,match_score")
          .eq("import_id", imp.id)
          .gte("match_score", 75)
          .order("match_score", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (savedMatch?.candidate_debtor_id) {
          finalDebtorId = savedMatch.candidate_debtor_id;
          matchVia = "saved_match";
          await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_matched", event_details: { debtor_id: finalDebtorId, via: "saved_match", score: savedMatch.match_score } });
        }

        if (!finalDebtorId) {
          const matchBasis = { ...extractedCustomer, ...resolvedNewDebtor };
          const { data: existing, error: existingErr } = await supabase
            .from("debtors")
            .select("id,company_name,name,email")
            .eq("user_id", imp.account_id)
            .limit(1000);
          if (existingErr) throw new Error(`Customer lookup: ${existingErr.message}`);
          const best = (existing || [])
            .map((d: any) => ({ debtor: d, score: scoreCustomerMatch(matchBasis, d) }))
            .sort((a: any, b: any) => b.score - a.score)[0];
          if (best?.score >= 75) {
            finalDebtorId = best.debtor.id;
            matchVia = "scored_match";
            await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_matched", event_details: { debtor_id: finalDebtorId, via: "scored_match", score: best.score } });
          }
        }

        if (!finalDebtorId) {
          const { data: exactExisting } = await supabase
          .from("debtors")
          .select("id")
          .eq("user_id", imp.account_id)
          .ilike("company_name", resolvedNewDebtor.company_name)
          .limit(1)
          .maybeSingle();
          if (exactExisting?.id) {
            finalDebtorId = exactExisting.id;
            matchVia = "name_dedupe";
          }
        }

        if (finalDebtorId && matchVia === "name_dedupe") {
          await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_matched", event_details: { debtor_id: finalDebtorId, via: "name_dedupe" } });
        } else if (!finalDebtorId) {
          const emailValue = resolvedNewDebtor.primary_email || `noreply+${crypto.randomUUID().slice(0, 8)}@unknown.local`;
          const refId = `LC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
          const { data: created, error: cErr } = await supabase.from("debtors").insert({
            user_id: imp.account_id,
            company_name: resolvedNewDebtor.company_name,
            name: resolvedNewDebtor.company_name,
            email: emailValue,
            phone: resolvedNewDebtor.phone || null,
            address: resolvedNewDebtor.address || null,
            billing_address_line1: resolvedNewDebtor.address || null,
            reference_id: refId,
            source_system: "manual",
            integration_source: "recouply_manual",
          }).select("id").single();
          if (cErr) throw new Error(`Create debtor: ${cErr.message}`);
          finalDebtorId = created.id;
          createdNew = true;
          await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_created", event_details: { debtor_id: finalDebtorId, auto: !newDebtor } });
        }
      } else if (finalDebtorId) {
        await supabase.from("live_contract_audit_log").insert({ account_id: imp.account_id, user_id: user.id, import_id: imp.id, event_type: "customer_matched", event_details: { debtor_id: finalDebtorId } });
      } else {
        throw new Error("Could not resolve a customer to attach this contract to");
      }

      const { data: debtorCheck, error: debtorCheckErr } = await supabase
        .from("debtors")
        .select("id")
        .eq("id", finalDebtorId)
        .eq("user_id", imp.account_id)
        .maybeSingle();
      if (debtorCheckErr) throw new Error(`Validate customer: ${debtorCheckErr.message}`);
      if (!debtorCheck) return json({ error: "Selected customer is not available for this account" }, 400);

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

      return json({ success: true, debtor_id: finalDebtorId });
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
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});
