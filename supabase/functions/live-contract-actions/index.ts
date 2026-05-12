import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { importId, action } = body;
    if (!importId || !action) return json({ error: "importId and action required" }, 400);

    const { data: imp } = await supabase.from("live_contract_imports").select("*").eq("id", importId).single();
    if (!imp) return json({ error: "Import not found" }, 404);
    if (!imp.debtor_id) return json({ error: "Contract must be imported with a customer first" }, 400);

    if (action === "generate_invoices") {
      const { scheduleIds } = body;
      const { data: schedules } = await supabase
        .from("contract_invoice_schedules")
        .select("*")
        .eq("import_id", importId)
        .in("id", scheduleIds || []);
      if (!schedules || schedules.length === 0) return json({ error: "No schedules selected" }, 400);

      const created: any[] = [];
      const skipped: any[] = [];
      const duplicates: any[] = [];
      for (const s of schedules) {
        // Re-fetch schedule to avoid stale invoice_id
        const { data: fresh } = await supabase
          .from("contract_invoice_schedules")
          .select("invoice_id")
          .eq("id", s.id)
          .single();
        if (fresh?.invoice_id) { skipped.push({ id: s.id, reason: "already invoiced" }); continue; }
        if (!s.amount) { skipped.push({ id: s.id, reason: "no amount" }); continue; }
        const issue = s.scheduled_date as string;
        const due = (s.expected_due_date as string) || issue;

        // Dedup: existing live_contract invoice for same debtor/date/amount
        const { data: dupes } = await supabase
          .from("invoices")
          .select("id, invoice_number")
          .eq("debtor_id", imp.debtor_id)
          .eq("source_system", "live_contract")
          .eq("issue_date", issue)
          .eq("amount", s.amount)
          .limit(1);
        if (dupes && dupes.length > 0) {
          // Link the existing invoice back to the schedule and skip creation
          await supabase.from("contract_invoice_schedules").update({
            invoice_id: dupes[0].id,
            invoice_created_at: new Date().toISOString(),
            status: "invoice_created",
          }).eq("id", s.id);
          // Audit: record duplicate detection so the user can see why no new invoice was created
          await supabase.from("invoice_data_audit").insert({
            invoice_id: dupes[0].id,
            user_id: imp.account_id,
            source_type: "contract_intelligence",
            source_contract_id: imp.id,
            source_schedule_id: s.id,
            source_reference: imp.contract_name || imp.file_name,
            field_name: "duplicate_check",
            source_value: `${imp.debtor_id}|${issue}|${s.amount}`,
            applied_value: dupes[0].invoice_number || dupes[0].id,
            duplicate_of_invoice_id: dupes[0].id,
            notes: "Duplicate live_contract invoice (same debtor/issue_date/amount) — schedule linked to existing invoice",
          });
          duplicates.push({ id: s.id, existing_invoice_id: dupes[0].id });
          skipped.push({ id: s.id, reason: "duplicate detected, linked to existing invoice" });
          continue;
        }

        const ymd = new Date(issue).toISOString().slice(0, 10).replace(/-/g, "");
        const rand4 = Math.random().toString(36).slice(2, 6).toUpperCase();
        const refId = `REC-${ymd}-${rand4}`;
        const invNum = `REC-${ymd}-${rand4}`;
        const lineDescription = s.description || imp.contract_name || "Contract billing";
        const { data: inv, error: iErr } = await supabase.from("invoices").insert({
          user_id: imp.account_id,
          debtor_id: imp.debtor_id,
          invoice_number: invNum,
          reference_id: refId,
          amount: s.amount,
          subtotal: s.amount,
          total_amount: s.amount,
          amount_outstanding: s.amount,
          amount_original: s.amount,
          source_contract_id: imp.id,
          source_contract_schedule_id: s.id,
          source_origin: "contract_intelligence",
          currency: s.currency || "USD",
          issue_date: issue,
          due_date: due,
          status: "Open",
          source_system: "live_contract",
          payment_terms: s.payment_terms || null,
          product_description: lineDescription,
          notes: `Auto-generated from contract: ${imp.contract_name || imp.file_name}`,
        }).select("id").single();
        if (iErr) {
          // Treat unique-violation as duplicate, not failure
          if ((iErr as any).code === "23505") {
            skipped.push({ id: s.id, reason: "duplicate (unique constraint)" });
          } else {
            skipped.push({ id: s.id, reason: iErr.message });
          }
          continue;
        }

        // Insert a line item carrying the contract description for editability
        try {
          await supabase.from("invoice_line_items").insert({
            invoice_id: inv.id,
            user_id: imp.account_id,
            description: lineDescription,
            quantity: 1,
            unit_price: s.amount,
            line_total: s.amount,
            line_type: "item",
            sort_order: 0,
          });
        } catch (lineErr) {
          console.warn("line item insert failed", lineErr);
        }

        await supabase.from("contract_invoice_schedules").update({
          invoice_id: inv.id, invoice_created_at: new Date().toISOString(), status: "invoice_created",
        }).eq("id", s.id);
        created.push(inv.id);
      }

      await supabase.from("live_contract_audit_log").insert({
        account_id: imp.account_id, user_id: user.id, import_id: imp.id,
        event_type: "invoices_generated",
        event_details: { created: created.length, skipped: skipped.length, duplicates: duplicates.length, skipped_detail: skipped },
      });
      return json({ success: true, created: created.length, duplicates: duplicates.length, skipped });
    }

    if (action === "set_alerts") {
      // dates: [{id, enabled, lead_days}]
      const { dates } = body;
      if (!Array.isArray(dates)) return json({ error: "dates array required" }, 400);
      const today = new Date();
      let configured = 0, fired = 0;
      for (const d of dates) {
        const lead = Number(d.lead_days) || 30;
        await supabase.from("contract_critical_dates").update({
          alert_enabled: !!d.enabled, alert_lead_days: lead,
        }).eq("id", d.id).eq("import_id", importId);
        configured++;

        if (d.enabled) {
          const { data: row } = await supabase.from("contract_critical_dates").select("*").eq("id", d.id).single();
          if (!row) continue;
          const due = new Date(row.due_date);
          const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000);
          if (daysUntil <= lead && daysUntil >= -1 && !row.last_alerted_at) {
            const typeMap: Record<string, string> = {
              renewal: "contract_renewal",
              auto_renewal: "contract_renewal",
              opt_out: "contract_opt_out",
              opt_out_deadline: "contract_opt_out",
              expiration: "contract_expiration",
              term_end: "contract_expiration",
            };
            const alertType = typeMap[row.date_type] || "contract_milestone";
            const sev = daysUntil <= 7 ? "error" : daysUntil <= 14 ? "warning" : "info";
            await supabase.from("user_alerts").insert({
              user_id: user.id,
              organization_id: null,
              alert_type: alertType,
              severity: sev,
              title: `${row.date_type.replace(/_/g, " ")} in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
              message: `Contract "${imp.contract_name || imp.file_name}" — ${row.date_type.replace(/_/g, " ")} on ${row.due_date}.`,
              debtor_id: imp.debtor_id,
              action_url: `/contracts/live`,
              action_label: "Open contract",
              metadata: { import_id: importId, critical_date_id: row.id, due_date: row.due_date },
            });
            await supabase.from("contract_critical_dates").update({ last_alerted_at: new Date().toISOString() }).eq("id", row.id);
            fired++;
          }
        }
      }
      await supabase.from("live_contract_audit_log").insert({
        account_id: imp.account_id, user_id: user.id, import_id: imp.id,
        event_type: "alerts_configured",
        event_details: { configured, fired },
      });
      return json({ success: true, configured, fired });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("live-contract-actions error", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
