import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_CUSTOMERS = [
  { slug: "nimbushr", company_name: "NimbusHR", contact: "Priya Shah", email: "ap@nimbushr.example", arr: 168000, mrr: 14000, ps: 45000, tcv: 213000, start: "2026-01-15", end: "2027-01-14", terms: "Net 30", inv_num: "INV-1001", inv_amt: 213000, ci: 92, br: 88, cr: 95, industry: "HR Tech", complete: true },
  { slug: "atlas-health", company_name: "Atlas Health Network", contact: "Marcus Wells", email: "billing@atlashealth.example", arr: 420000, mrr: 35000, ps: 0, tcv: 840000, start: "2025-06-01", end: "2027-05-31", terms: "Net 45", inv_num: "INV-1002", inv_amt: 35000, ci: 78, br: 71, cr: 82, industry: "Healthcare", complete: false },
  { slug: "velocity-commerce", company_name: "Velocity Commerce", contact: "Jenna Ortiz", email: "finance@velocitycommerce.example", arr: 96000, mrr: 8000, ps: 0, tcv: 96000, start: "2026-03-01", end: "2027-02-28", terms: "Net 30", inv_num: "INV-1003", inv_amt: 24000, ci: 84, br: 79, cr: 88, industry: "eCommerce", complete: false },
  { slug: "global-mfg", company_name: "Global Manufacturing Group", contact: "Ravi Menon", email: "ap@globalmfg.example", arr: 620000, mrr: 51666, ps: 0, tcv: 1860000, start: "2025-01-01", end: "2027-12-31", terms: "Net 60", inv_num: "INV-1004", inv_amt: 155000, ci: 65, br: 60, cr: 68, industry: "Manufacturing", complete: false },
  { slug: "nova-financial", company_name: "Nova Financial Services", contact: "Alicia Green", email: "ap@novafin.example", arr: 288000, mrr: 24000, ps: 0, tcv: 576000, start: "2026-02-01", end: "2028-01-31", terms: "Net 30", inv_num: "INV-1005", inv_amt: 72000, ci: 88, br: 84, cr: 91, industry: "Financial Services", complete: false },
];

const isoDaysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await sb.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let userId = claims.claims.sub as string;

    // Admin gate: check profiles.is_admin OR support user
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: profile } = await admin.from("profiles").select("is_admin, is_support_user").eq("id", userId).maybeSingle();
    if (!profile?.is_admin && !profile?.is_support_user) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, target_user_email } = await req.json().catch(() => ({} as any));
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admins can target a different user (used to manage the shared demo@recouply.ai account from the admin console).
    if (target_user_email && profile?.is_admin) {
      const targetEmail = String(target_user_email).toLowerCase();
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      let target = list?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
      if (!target) {
        // Auto-provision the shared demo user so admins never see "target user not found".
        const demoPassword = Deno.env.get("DEMO_USER_PASSWORD") ?? crypto.randomUUID();
        const { data: created, error: cuErr } = await admin.auth.admin.createUser({
          email: targetEmail,
          password: demoPassword,
          email_confirm: true,
          user_metadata: { is_demo_account: true, full_name: "Demo User" },
        });
        if (cuErr || !created?.user) {
          return new Response(JSON.stringify({ error: `could not provision demo user: ${cuErr?.message ?? "unknown"}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        target = created.user;
      }
      userId = target.id;
    }

    // Fast status action — read-only, returns current demo workspace state for the (possibly targeted) user.
    if (action === "status") {
      const { data: st } = await admin.from("demo_workspace_state").select("*").eq("user_id", userId).maybeSingle();
      const { data: sti } = await admin.from("stripe_test_integrations").select("is_connected, stripe_account_id, last_sync_at").eq("user_id", userId).maybeSingle();
      return new Response(JSON.stringify({ ok: true, state: st, stripe_test: sti, user_id: userId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Full list of user-owned tables to purge on wipe. Ordered so children are
    // deleted before parents to satisfy FK constraints.
    const DEMO_TABLES = [
      "user_alerts", "collection_activities", "collection_tasks",
      "payment_invoice_links", "payments",
      "invoice_line_items", "invoices",
      "contract_stripe_invoice_link", "contract_stripe_product_map",
      "contract_stripe_sync", "contract_stripe_sync_events",
      "contract_invoice_schedules", "contract_revenue_items",
      "contract_risk_flags", "contract_critical_dates", "contract_poc_details",
      "contract_custom_triggers", "contract_customer_matches",
      "contract_source_documents",
      "live_contract_extracted_fields", "live_contract_extractions",
      "live_contract_checklist_items", "live_contract_supporting_docs",
      "live_contract_links", "live_contract_review_queue",
      "live_contract_scan_jobs", "live_contract_audit_log",
      "live_contract_drive_folders", "live_contract_watchers",
      "live_contract_imports", "contracts",
      "ai_assessments", "ai_drafts", "ai_creations",
      "outreach_logs", "outreach_errors", "outreach_batch_runs",
      "collection_outcomes", "collection_campaigns",
      "cs_cases", "rca_records",
      "debtor_contacts", "contacts",
      "debtor_ai_context", "debtor_risk_profiles", "debtor_risk_history",
      "invoice_risk_scores", "invoice_transactions", "invoice_outreach",
      "debtors",
      "product_catalog", "cached_reports", "user_notifications",
    ];

    const clear = async () => {
      // Legacy "clear" — only touches rows explicitly tagged is_demo = true.
      for (const t of DEMO_TABLES) {
        await admin.from(t).delete().eq("user_id", userId).eq("is_demo", true);
      }
    };

    // Full tenant wipe — deletes EVERY row owned by this user across the demo
    // tables regardless of is_demo. Safety-gated to demo@recouply.ai only so
    // it can never fire against a real customer tenant.
    const wipeAll = async () => {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email?.toLowerCase();
      if (email !== "demo@recouply.ai") {
        throw new Error(`wipe_all is only allowed on demo@recouply.ai (got ${email ?? "unknown"})`);
      }
      const summary: Record<string, number> = {};
      for (const t of DEMO_TABLES) {
        const { count } = await admin
          .from(t)
          .delete({ count: "exact" })
          .eq("user_id", userId);
        if (count && count > 0) summary[t] = count;
      }
      return summary;
    };


    const seed = async () => {
      const summary = { debtors: 0, contracts: 0, invoices: 0, tasks: 0, alerts: 0 };
      for (const c of DEMO_CUSTOMERS) {
        const refId = `DEMO-${c.slug.toUpperCase()}`;
        const { data: debtor, error: dErr } = await admin.from("debtors").insert({
          user_id: userId,
          is_demo: true,
          company_name: c.company_name,
          name: c.contact,
          email: c.email,
          reference_id: refId,
          industry: c.industry,
          current_balance: c.inv_amt,
          open_invoices_count: 1,
        }).select().single();
        if (dErr) { console.error("debtor insert", dErr); continue; }
        summary.debtors++;

        // Contract import row
        const { data: lci } = await admin.from("live_contract_imports").insert({
          user_id: userId,
          is_demo: true,
          account_id: debtor.id,
          file_name: `${c.company_name} - MSA + Order Form.pdf`,
          source: "demo",
          term_end_date: c.end,
          status: "active",
        }).select().single();
        summary.contracts++;

        if (c.complete && lci) {
          await admin.from("live_contract_imports").insert({
            user_id: userId, is_demo: true, account_id: debtor.id,
            file_name: `${c.company_name} - Amendment 1.pdf`, source: "demo", status: "active",
          });
          summary.contracts++;
        }

        // Invoice
        const { data: inv } = await admin.from("invoices").insert({
          user_id: userId,
          is_demo: true,
          debtor_id: debtor.id,
          invoice_number: c.inv_num,
          reference_id: `DEMO-${c.inv_num}`,
          amount: c.inv_amt,
          issue_date: isoDaysFromNow(-15),
          due_date: isoDaysFromNow(15),
          status: "open",
        }).select().single();
        summary.invoices++;

        // Collection task
        await admin.from("collection_tasks").insert({
          user_id: userId, is_demo: true, debtor_id: debtor.id,
          task_type: "outreach",
          summary: `Follow up with ${c.company_name} on ${c.inv_num}`,
          status: "open",
        });
        summary.tasks++;

        // Renewal alert
        await admin.from("user_alerts").insert({
          user_id: userId, is_demo: true,
          alert_type: "renewal",
          title: `${c.company_name} renewal window`,
          message: `${c.company_name} renewal notice due ${c.renewal_notice_days ?? 60} days before ${c.end}.`,
          metadata: { account_name: c.company_name },
        });
        summary.alerts++;

        // AI assessment stub (readiness/intelligence)
        await admin.from("ai_assessments").insert({
          user_id: userId, is_demo: true,
          scope: "contract_intelligence",
          subject_type: "contract",
          subject_id: lci?.id ?? debtor.id,
          title: `${c.company_name} — Intelligence Snapshot`,
          summary: `Contract Intelligence Score ${c.ci} • Billing Readiness ${c.br} • Collection Readiness ${c.cr}`,
          findings: {
            contract_intelligence_score: c.ci,
            billing_readiness_score: c.br,
            collection_readiness_score: c.cr,
            arr: c.arr, mrr: c.mrr, ps: c.ps, tcv: c.tcv,
          },
        }).then((r) => { if (r.error) console.error("assessment", r.error); });
      }

      // Auto-enable a mock Stripe connection for the demo account so Stripe-gated
      // UI (Billing Sync, product catalog sync, invoice → Stripe push, chips) is
      // demonstrable end-to-end without pasting a real key.
      await admin.from("stripe_integrations").upsert({
        user_id: userId,
        is_connected: true,
        stripe_account_id: "acct_demo_recouply",
        sync_status: "connected",
        auto_sync_enabled: true,
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      await admin.from("demo_workspace_state").upsert({
        user_id: userId,
        workspace_exists: true,
        last_seeded_at: new Date().toISOString(),
        entity_counts: summary,
      }, { onConflict: "user_id" });

      return summary;
    };


    let result: any = { ok: true };

    switch (action) {
      case "seed":
        result.summary = await seed();
        break;
      case "clear":
        await clear();
        await admin.from("demo_workspace_state").upsert({
          user_id: userId, workspace_exists: false, entity_counts: {},
        }, { onConflict: "user_id" });
        break;
      case "reset":
        await clear();
        result.summary = await seed();
        await admin.from("demo_workspace_state").update({ last_reset_at: new Date().toISOString() }).eq("user_id", userId);
        break;
      case "generate_invoices": {
        const { data: debtors } = await admin.from("debtors").select("id, company_name").eq("user_id", userId).eq("is_demo", true);
        let created = 0;
        for (const d of debtors ?? []) {
          const num = `DEMO-${d.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
          await admin.from("invoices").insert({
            user_id: userId, is_demo: true, debtor_id: d.id,
            invoice_number: num, reference_id: num,
            amount: Math.round(5000 + Math.random() * 20000),
            issue_date: isoDaysFromNow(-5), due_date: isoDaysFromNow(25), status: "open",
          });
          created++;
        }
        result.created = created;
        break;
      }
      case "generate_activity": {
        const { data: debtors } = await admin.from("debtors").select("id, company_name").eq("user_id", userId).eq("is_demo", true);
        let created = 0;
        for (const d of debtors ?? []) {
          await admin.from("collection_activities").insert({
            user_id: userId, is_demo: true, debtor_id: d.id,
            activity_type: "email_sent",
            channel: "email",
            direction: "outbound",
            subject: `Follow-up: ${d.company_name}`,
            message_body: `Automated follow-up sent to ${d.company_name}.`,
          }).then((r) => { if (!r.error) created++; });
        }
        result.created = created;
        break;
      }
      case "recompute_insights": {
        await admin.from("demo_workspace_state").update({ last_insights_at: new Date().toISOString() }).eq("user_id", userId);
        result.recomputed = true;
        break;
      }
      case "enable_stripe_demo": {
        await admin.from("stripe_integrations").upsert({
          user_id: userId,
          is_connected: true,
          stripe_account_id: "acct_demo_recouply",
          sync_status: "connected",
          auto_sync_enabled: true,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        result.stripe_enabled = true;
        break;
      }
      case "disable_stripe_demo": {
        await admin.from("stripe_integrations").update({
          is_connected: false,
          sync_status: "disconnected",
        }).eq("user_id", userId);
        result.stripe_enabled = false;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("demo-workspace-seed error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
