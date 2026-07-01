import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TYPE_MAP: Record<string, string> = {
  renewal: "contract_renewal",
  auto_renewal: "contract_renewal",
  opt_out: "contract_opt_out",
  opt_out_deadline: "contract_opt_out",
  non_renewal_notice_start: "contract_opt_out",
  expiration: "contract_expiration",
  term_end: "contract_expiration",
  term_start: "contract_milestone",
};

const LABEL: Record<string, string> = {
  term_start: "Term Start",
  term_end: "Term End",
  renewal: "Renewal",
  opt_out_deadline: "Opt-out Deadline",
  non_renewal_notice_start: "Non-renewal Notice Window Opens",
  effective_date: "Effective Date",
  signed_date: "Signed Date",
  poc_start: "POC Start",
  poc_end: "POC End",
};

const label = (t: string) => LABEL[t] || t.replace(/_/g, " ");

const APP_URL = Deno.env.get("APP_URL") || "https://recouply.ai";
const contractUrl = (importId: string) => `${APP_URL}/contracts/live/${importId}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Find rows where alerts are enabled and the due date is within lead window.
    const { data: rows, error } = await supabase
      .from("contract_critical_dates")
      .select("id, account_id, import_id, debtor_id, date_type, due_date, alert_lead_days, notify_channel, notify_emails, last_alerted_at")
      .eq("alert_enabled", true)
      .gte("due_date", todayStr);
    if (error) return json({ error: error.message }, 500);

    let fired = 0;
    let emailed = 0;
    const errors: string[] = [];

    for (const r of rows || []) {
      const due = new Date((r as any).due_date);
      const lead = Number((r as any).alert_lead_days) || 30;
      const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      if (daysUntil > lead) continue;
      // Repeat at most once every 7 days
      if ((r as any).last_alerted_at) {
        const last = new Date((r as any).last_alerted_at).getTime();
        if (Date.now() - last < 7 * 86400000) continue;
      }

      // Resolve the import + owner
      const { data: imp } = await supabase
        .from("live_contract_imports")
        .select("id, account_id, user_id, contract_name, file_name, debtor_id")
        .eq("id", (r as any).import_id)
        .single();
      if (!imp) continue;

      // Resolve account / customer name for context in the alert.
      let accountName: string | null = null;
      if ((imp as any).debtor_id) {
        const { data: deb } = await supabase
          .from("debtors")
          .select("name, company_name")
          .eq("id", (imp as any).debtor_id)
          .maybeSingle();
        accountName = (deb as any)?.company_name || (deb as any)?.name || null;
      }
      const contractLabel = (imp as any).contract_name || (imp as any).file_name || "Contract";
      const accountPrefix = accountName ? `${accountName} — ` : "";
      const link = contractUrl((imp as any).id);

      const sev = daysUntil <= 7 ? "error" : daysUntil <= 14 ? "warning" : "info";
      const alertType = TYPE_MAP[(r as any).date_type] || "contract_milestone";
      const title = `${accountPrefix}${label((r as any).date_type)} in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
      const message = `${accountName ? `Account: ${accountName}. ` : ""}Contract "${contractLabel}" — ${label((r as any).date_type)} on ${(r as any).due_date}.`;

      // In-app
      await supabase.from("user_alerts").insert({
        user_id: (imp as any).user_id,
        organization_id: null,
        alert_type: alertType,
        severity: sev,
        title,
        message,
        debtor_id: (imp as any).debtor_id,
        action_url: `/contracts/live/${(imp as any).id}`,
        action_label: "Open contract",
        metadata: {
          import_id: (imp as any).id,
          critical_date_id: (r as any).id,
          due_date: (r as any).due_date,
          account_name: accountName,
          contract_name: contractLabel,
        },
      });

      // Email
      const ch = (r as any).notify_channel || "in_app";
      const recipients: string[] = Array.isArray((r as any).notify_emails) ? (r as any).notify_emails : [];
      if ((ch === "email" || ch === "both") && (recipients.length || (imp as any).user_id)) {
        const { data: profile } = await supabase
          .from("profiles").select("email").eq("user_id", (imp as any).user_id).maybeSingle();
        const ownerEmail = (profile as any)?.email || null;
        const to = Array.from(new Set([...recipients, ownerEmail].filter(Boolean)));
        if (to.length) {
          const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;padding:24px;max-width:560px;background:#ffffff">
              <div style="border:1px solid #e2e8f0;border-radius:8px;padding:20px">
                <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px">Contract key date reminder</h2>
                ${accountName ? `<p style="margin:0 0 6px;color:#0f172a"><strong>Account:</strong> ${accountName}</p>` : ""}
                <p style="margin:0 0 8px;color:#0f172a"><strong>Contract:</strong> ${contractLabel}</p>
                <p style="margin:0 0 6px;color:#475569">${label((r as any).date_type)} — <strong>${(r as any).due_date}</strong> (in ${daysUntil} day${daysUntil === 1 ? "" : "s"})</p>
                <p style="margin:16px 0 0"><a href="${link}" style="display:inline-block;background:#3B82F6;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:13px;font-weight:600">Open contract →</a></p>
                <p style="margin:14px 0 0;color:#64748b;font-size:13px">This reminder fires ${lead} day${lead === 1 ? "" : "s"} before the date. You are receiving it because alerts are enabled for this contract.</p>
              </div>
            </div>`;
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({
                to,
                from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
                subject: `Action needed: ${accountPrefix}${label((r as any).date_type)} on ${(r as any).due_date}`,
                html,
              }),
            });
            emailed++;
          } catch (e: any) {
            errors.push(`email ${ (r as any).id }: ${e?.message || e}`);
          }
        }
      }

      await supabase.from("contract_critical_dates")
        .update({ last_alerted_at: new Date().toISOString() })
        .eq("id", (r as any).id);
      fired++;
    }

    // ===== Custom triggers =====
    // Evaluate any user-defined triggers attached to contracts and fire
    // in-app alerts / emails when their condition is met.
    let customFired = 0;
    try {
      const { data: trigs } = await supabase
        .from("contract_custom_triggers")
        .select("*")
        .eq("is_active", true);

      for (const t of trigs || []) {
        try {
          // Skip if fired in the last 24h
          if ((t as any).last_fired_at) {
            const last = new Date((t as any).last_fired_at).getTime();
            if (Date.now() - last < 24 * 3600 * 1000) continue;
          }

          const { data: imp } = await supabase
            .from("live_contract_imports")
            .select("id, user_id, contract_name, file_name, debtor_id")
            .eq("id", (t as any).import_id)
            .single();
          if (!imp) continue;

          const { data: field } = await supabase
            .from("live_contract_extracted_fields")
            .select("field_value")
            .eq("import_id", (t as any).import_id)
            .eq("field_key", (t as any).source_field)
            .maybeSingle();
          const fieldValue = (field as any)?.field_value;
          if (!fieldValue) continue;

          let shouldFire = false;
          let reason = "";

          if ((t as any).trigger_type === "date_offset") {
            const dateStr = String(fieldValue).slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
            const target = new Date(dateStr);
            const daysUntil = Math.ceil((target.getTime() - today.getTime()) / 86400000);
            const offset = Number((t as any).offset_days) || 0;
            if (daysUntil >= 0 && daysUntil <= offset) {
              shouldFire = true;
              reason = `${(t as any).source_field.replace(/_/g, " ")} is ${daysUntil} day${daysUntil === 1 ? "" : "s"} away (${dateStr})`;
            }
          } else if ((t as any).trigger_type === "amount_threshold") {
            const num = Number(String(fieldValue).replace(/[$,]/g, ""));
            if (!Number.isFinite(num)) continue;
            const th = Number((t as any).threshold_value) || 0;
            const cmp = (t as any).comparator;
            shouldFire =
              (cmp === "gt" && num > th) ||
              (cmp === "gte" && num >= th) ||
              (cmp === "lt" && num < th) ||
              (cmp === "lte" && num <= th) ||
              (cmp === "eq" && num === th);
            if (shouldFire) reason = `${(t as any).source_field.replace(/_/g, " ")} = ${num} ${cmp} ${th}`;
          }

          if (!shouldFire) continue;

          const title = `Trigger: ${(t as any).name}`;
          const message = `${(imp as any).contract_name || (imp as any).file_name} — ${reason}. ${(t as any).message || ""}`.trim();

          await supabase.from("user_alerts").insert({
            user_id: (imp as any).user_id,
            alert_type: "contract_custom_trigger",
            severity: "warning",
            title,
            message,
            debtor_id: (imp as any).debtor_id,
            action_url: `/contracts/live/${(imp as any).id}#triggers`,
            action_label: "Open contract",
            metadata: { trigger_id: (t as any).id, import_id: (imp as any).id },
          });

          const ch = (t as any).channel;
          if (ch === "email" || ch === "both") {
            const recipients: string[] = Array.isArray((t as any).notify_emails) ? (t as any).notify_emails : [];
            if (recipients.length) {
              const html = `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;padding:24px;max-width:560px;background:#ffffff">
                  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:20px">
                    <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px">${title}</h2>
                    <p style="margin:0 0 8px"><strong>${(imp as any).contract_name || (imp as any).file_name}</strong></p>
                    <p style="margin:0 0 6px;color:#475569">${reason}</p>
                    ${(t as any).message ? `<p style="margin:14px 0 0;color:#475569">${(t as any).message}</p>` : ""}
                  </div>
                </div>`;
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
                  body: JSON.stringify({
                    to: recipients,
                    from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
                    subject: title,
                    html,
                  }),
                });
                emailed++;
              } catch (e: any) {
                errors.push(`custom_trigger email ${(t as any).id}: ${e?.message || e}`);
              }
            }
          }

          await supabase
            .from("contract_custom_triggers")
            .update({ last_fired_at: new Date().toISOString() })
            .eq("id", (t as any).id);
          customFired++;
        } catch (e: any) {
          errors.push(`custom_trigger ${(t as any).id}: ${e?.message || e}`);
        }
      }
    } catch (e: any) {
      errors.push(`custom_triggers_block: ${e?.message || e}`);
    }

    return json({ success: true, fired, customFired, emailed, errors });
  } catch (e: any) {
    console.error("contract-key-date-notifier error", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
