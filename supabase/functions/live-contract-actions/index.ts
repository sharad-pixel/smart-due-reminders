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

    // Verify ownership
    const { data: accountId } = await supabase.rpc("get_effective_account_id", { p_user_id: user.id });
    if (!accountId || imp.account_id !== accountId) return json({ error: "Not authorized" }, 403);

    if (action === "delete_import") {
      // Best-effort cleanup of related rows + storage object, then delete import row
      const childTables = [
        "contract_invoice_schedules",
        "contract_critical_dates",
        "contract_clauses",
        "contract_risk_flags",
        "contract_customer_matches",
        "contract_poc_details",
        "contract_source_documents",
        "live_contract_extracted_fields",
        "live_contract_extractions",
        "live_contract_review_queue",
        "live_contract_audit_log",
      ];
      for (const t of childTables) {
        try { await supabase.from(t).delete().eq("import_id", importId); } catch (_) { /* ignore missing tables */ }
      }
      if (imp.storage_path) {
        try { await supabase.storage.from("live-contracts").remove([imp.storage_path]); } catch (_) { /* ignore */ }
      }
      const { error: delErr } = await supabase.from("live_contract_imports").delete().eq("id", importId);
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ success: true });
    }

    // Recalculate key dates from existing extracted fields + contract row.
    // No AI cost. Preserves alert_enabled/alert_lead_days for matching (date_type, due_date).
    if (action === "recalculate_dates") {
      const { data: existing } = await supabase
        .from("contract_critical_dates")
        .select("id, date_type, due_date, alert_enabled, alert_lead_days, last_alerted_at, notify_channel, notify_emails")
        .eq("import_id", importId);
      const prefs = new Map<string, { alert_enabled: boolean; alert_lead_days: number; last_alerted_at: string | null; notify_channel: string; notify_emails: string[] }>();
      (existing || []).forEach((r: any) => {
        prefs.set(`${r.date_type}|${r.due_date}`, {
          alert_enabled: !!r.alert_enabled,
          alert_lead_days: r.alert_lead_days || 30,
          last_alerted_at: r.last_alerted_at || null,
          notify_channel: r.notify_channel || "in_app",
          notify_emails: Array.isArray(r.notify_emails) ? r.notify_emails : [],
        });
      });

      const { data: fields } = await supabase
        .from("live_contract_extracted_fields")
        .select("field_group, field_key, field_value")
        .eq("import_id", importId);
      const get = (group: string, key: string) =>
        (fields || []).find((f: any) => f.field_group === group && f.field_key === key)?.field_value || null;

      const parseDate = (v: any): Date | null => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const effective = parseDate(imp.effective_date || get("contract", "effective_date"));
      const termEnd = parseDate(imp.term_end_date || get("contract", "term_end_date"));
      const signed = parseDate(get("contract", "signed_date"));
      const renewal = parseDate(get("dates", "renewal_date")) || termEnd;
      const optOutExplicit = parseDate(get("dates", "opt_out_deadline")) || parseDate(get("dates", "non_renewal_deadline")) || parseDate(get("dates", "termination_notice_deadline"));
      const noticeDaysRaw = get("dates", "notice_period_days");
      const noticeDays = noticeDaysRaw != null ? Number(noticeDaysRaw) || 0 : 0;
      const pocEnd = parseDate(get("poc", "poc_end"));
      const pocStart = parseDate(get("poc", "poc_start"));

      const newRows: any[] = [];
      const push = (date_type: string, d: Date | null, notice_days?: number) => {
        if (!d) return;
        newRows.push({
          account_id: imp.account_id,
          import_id: imp.id,
          debtor_id: imp.debtor_id || null,
          date_type,
          due_date: fmt(d),
          notice_days: notice_days ?? null,
        });
      };

      if (effective) push("effective_date", effective);
      if (effective) push("term_start", effective);
      if (signed) push("signed_date", signed);
      if (termEnd) push("term_end", termEnd);
      if (renewal) push("renewal", renewal, noticeDays || undefined);
      if (optOutExplicit) {
        push("opt_out_deadline", optOutExplicit, noticeDays || undefined);
        push("non_renewal_notice_start", optOutExplicit, noticeDays || undefined);
      } else if (renewal && noticeDays > 0) {
        const opt = new Date(renewal);
        opt.setDate(opt.getDate() - noticeDays);
        push("opt_out_deadline", opt, noticeDays);
        push("non_renewal_notice_start", opt, noticeDays);
      }
      if (pocStart) push("poc_start", pocStart);
      if (pocEnd) push("poc_end", pocEnd);

      // Dedupe by (date_type, due_date)
      const seen = new Set<string>();
      const deduped = newRows.filter((r) => {
        const k = `${r.date_type}|${r.due_date}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      // Risk levels
      const today = Date.now();
      for (const d of deduped) {
        const days = Math.floor((new Date(d.due_date).getTime() - today) / 86400000);
        (d as any).risk_level = days < 30 ? "high" : days < 90 ? "medium" : "low";
        const pref = prefs.get(`${d.date_type}|${d.due_date}`);
        if (pref) {
          (d as any).alert_enabled = pref.alert_enabled;
          (d as any).alert_lead_days = pref.alert_lead_days;
          (d as any).last_alerted_at = pref.last_alerted_at;
          (d as any).notify_channel = pref.notify_channel;
          (d as any).notify_emails = pref.notify_emails;
        }
      }

      await supabase.from("contract_critical_dates").delete().eq("import_id", importId);
      if (deduped.length) {
        await supabase.from("contract_critical_dates").insert(deduped);
      }

      await supabase.from("live_contract_audit_log").insert({
        account_id: imp.account_id, user_id: user.id, import_id: imp.id,
        event_type: "dates_recalculated",
        event_details: { count: deduped.length },
      });
      return json({ success: true, count: deduped.length });
    }

    // Actions below require a linked customer
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

        // Audit: record every key data point sourced from the contract schedule
        const auditRows = [
          { field_name: "amount", source_value: String(s.amount), applied_value: String(s.amount) },
          { field_name: "issue_date", source_value: issue, applied_value: issue },
          { field_name: "due_date", source_value: due, applied_value: due },
          { field_name: "currency", source_value: s.currency || "USD", applied_value: s.currency || "USD" },
          { field_name: "product_description", source_value: lineDescription, applied_value: lineDescription },
          { field_name: "invoice_number", source_value: invNum, applied_value: invNum },
        ].map((r) => ({
          ...r,
          invoice_id: inv.id,
          user_id: imp.account_id,
          source_type: "contract_intelligence",
          source_contract_id: imp.id,
          source_schedule_id: s.id,
          source_reference: imp.contract_name || imp.file_name,
        }));
        await supabase.from("invoice_data_audit").insert(auditRows);

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
      // dates: [{id, enabled, lead_days, channel, emails}]
      const { dates } = body;
      if (!Array.isArray(dates)) return json({ error: "dates array required" }, 400);
      const today = new Date();
      let configured = 0, fired = 0;
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const d of dates) {
        const lead = Number(d.lead_days) || 30;
        const ch = ["in_app", "email", "both"].includes(d.channel) ? d.channel : "in_app";
        const emails: string[] = Array.isArray(d.emails)
          ? d.emails.map((e: any) => String(e).trim()).filter((e: string) => EMAIL_RE.test(e)).slice(0, 20)
          : [];
        await supabase.from("contract_critical_dates").update({
          alert_enabled: !!d.enabled,
          alert_lead_days: lead,
          notify_channel: ch,
          notify_emails: emails,
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
              non_renewal_notice_start: "contract_opt_out",
              expiration: "contract_expiration",
              term_end: "contract_expiration",
              term_start: "contract_milestone",
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

    if (action === "send_test_notification") {
      // body: { dateId }
      const { dateId } = body;
      if (!dateId) return json({ error: "dateId required" }, 400);
      const { data: row } = await supabase
        .from("contract_critical_dates")
        .select("*")
        .eq("id", dateId)
        .eq("import_id", importId)
        .single();
      if (!row) return json({ error: "Key date not found" }, 404);
      const recipients: string[] = Array.isArray(row.notify_emails) ? row.notify_emails : [];
      const channel = row.notify_channel || "in_app";
      const wantsEmail = channel === "email" || channel === "both";

      // In-app
      await supabase.from("user_alerts").insert({
        user_id: user.id,
        organization_id: null,
        alert_type: "contract_milestone",
        severity: "info",
        title: `[TEST] ${row.date_type.replace(/_/g, " ")} alert`,
        message: `Test notification for "${imp.contract_name || imp.file_name}" — ${row.date_type.replace(/_/g, " ")} on ${row.due_date}.`,
        debtor_id: imp.debtor_id,
        action_url: `/contracts/live`,
        action_label: "Open contract",
        metadata: { import_id: importId, critical_date_id: row.id, test: true },
      });

      let emailResult: any = { sent: 0 };
      if (wantsEmail && recipients.length) {
        try {
          const { data: profile } = await supabase
            .from("profiles").select("email").eq("user_id", user.id).maybeSingle();
          const ownerEmail = (profile as any)?.email || null;
          const to = Array.from(new Set([...recipients, ownerEmail].filter(Boolean)));
          const subject = `[TEST] Contract key date — ${row.date_type.replace(/_/g, " ")}`;
          const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;padding:24px;max-width:560px">
              <h2 style="margin:0 0 12px;color:#1e293b">Contract key date reminder (test)</h2>
              <p style="margin:0 0 8px">Contract: <strong>${imp.contract_name || imp.file_name}</strong></p>
              <p style="margin:0 0 8px">Event: <strong>${row.date_type.replace(/_/g, " ")}</strong></p>
              <p style="margin:0 0 8px">Due date: <strong>${row.due_date}</strong></p>
              <p style="margin:16px 0 0;color:#64748b;font-size:13px">You are receiving this because alerts are enabled for this key date. This is a test message.</p>
            </div>`;
          const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({
              to,
              from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
              subject,
              html,
            }),
          });
          emailResult = { sent: to.length, status: resp.status };
        } catch (e: any) {
          emailResult = { error: e?.message || String(e) };
        }
      }
      return json({ success: true, channel, emailResult });
    }

    if (action === "reclassify_lines") {
      const { data: imp2 } = await supabase
        .from("live_contract_imports").select("industry").eq("id", importId).single();
      const industry = (imp2 as any)?.industry || null;
      const { data: rows } = await supabase
        .from("contract_invoice_schedules")
        .select("id, product_description, description, billing_type, product_category, category_source")
        .eq("import_id", importId);
      let updated = 0;
      for (const r of rows || []) {
        // Never overwrite user picks
        if ((r as any).category_source === "user") continue;
        const desc = (r as any).product_description || (r as any).description || null;
        // Lightweight classifier mirrored from contractMetrics.ts to avoid an
        // additional shared import in the action handler.
        const KW: Array<[RegExp, string]> = [
          [/profess?ional[\s_-]*serv|\bps\b/i, "professional_services"],
          [/implement/i, "implementation"],
          [/onboard|kickoff|kick-?off/i, "onboarding"],
          [/train/i, "training"],
          [/hardware|device|appliance/i, "hardware"],
          [/support/i, "support"],
          [/maint/i, "maintenance"],
          [/license|seat/i, "license"],
          [/usage[\s_-]*(min|commit)/i, "usage_minimum"],
          [/platform|access fee/i, "platform"],
          [/subscription|saas|recurring|monthly|annual fee/i, "subscription"],
        ];
        const blob = `${desc || ""} ${(r as any).billing_type || ""}`;
        let cat: string | null = null;
        let src: "keyword" | "industry_default" | null = null;
        for (const [re, c] of KW) { if (re.test(blob)) { cat = c; src = "keyword"; break; } }
        if (!cat && industry) {
          const ind = String(industry).toLowerCase();
          if (/saas|software|technology|platform|cloud/.test(ind)) { cat = "subscription"; src = "industry_default"; }
          else if (/professional services|consult|agency|services/.test(ind)) { cat = "professional_services"; src = "industry_default"; }
          else if (/hardware|manufactur|device|equipment/.test(ind)) { cat = "hardware"; src = "industry_default"; }
        }
        if (cat) {
          const recurring = new Set(["subscription","platform","support","maintenance","usage_minimum","license"]);
          await supabase.from("contract_invoice_schedules").update({
            product_category: cat,
            revenue_type: recurring.has(cat) ? "recurring" : "non_recurring",
            category_source: src,
          }).eq("id", (r as any).id);
          updated++;
        }
      }
      return json({ success: true, updated });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("live-contract-actions error", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
