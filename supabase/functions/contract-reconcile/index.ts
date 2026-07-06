// Reconcile a contract's billing schedule against existing Recouply invoices
// for the same debtor, write reconciliation_status + candidates per row,
// and (when contract is published) emit collection_tasks for missing/unclear/extra.

import { createClient } from "npm:@supabase/supabase-js@2";

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

const log = (m: string, d?: unknown) =>
  console.log(`[CONTRACT-RECONCILE] ${m}${d ? " " + JSON.stringify(d) : ""}`);

// --- matching helpers ---
const AMOUNT_TOL = 0.02; // 2%
const DATE_WINDOW_DAYS = 21; // generous for monthly billing-day drift
const TERM_WINDOW_DAYS = 60;
const SETTLED_STATUSES = new Set(["paid", "settled", "closed", "complete", "completed"]);
// Voided / canceled invoices no longer represent a real billing against the
// contract — the schedule line must remain pending/unresolved so it re-surfaces
// as an obligation to bill.
const VOIDED_STATUSES = new Set(["canceled", "cancelled", "voided", "void"]);

const dayDiff = (a: string, b: string) =>
  Math.round(
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000,
  );

function amountMatches(a: number | null, b: number | null) {
  if (!a || !b) return false;
  const diff = Math.abs(Number(a) - Number(b));
  return diff / Math.max(Number(a), Number(b)) <= AMOUNT_TOL;
}

interface Schedule {
  id: string;
  account_id: string;
  import_id: string;
  debtor_id: string | null;
  scheduled_date: string;
  expected_due_date: string | null;
  amount: number | null;
  description: string | null;
  invoice_id: string | null;
  reconciliation_status: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  total_amount: number | null;
  issue_date: string;
  due_date: string;
  status: string;
  product_description: string | null;
}

function classify(
  sched: Schedule,
  invoices: Invoice[],
): { status: string; candidates: Array<{ invoice_id: string; score: number; reason: string }> } {
  // If a schedule was previously linked to an invoice that has since been
  // voided/canceled, unlink it here so this run downgrades it back to
  // missing/pending instead of falsely reporting it as matched.
  if (sched.invoice_id) {
    const linked = invoices.find((i) => i.id === sched.invoice_id);
    const linkedVoided = linked && VOIDED_STATUSES.has((linked.status || "").toLowerCase());
    if (linked && !linkedVoided) {
      return {
        status: "matched",
        candidates: [{ invoice_id: sched.invoice_id, score: 100, reason: "manually linked" }],
      };
    }
    // fall through — treat as unlinked so a fresh candidate search runs
  }
  const target = sched.expected_due_date || sched.scheduled_date;
  const targetAmount = Number(sched.amount || 0);
  const candidates: Array<{ invoice_id: string; score: number; reason: string }> = [];
  for (const inv of invoices) {
    // Voided invoices don't fulfill the schedule — skip so this line is
    // reported as missing and stays actionable.
    if (VOIDED_STATUSES.has((inv.status || "").toLowerCase())) continue;
    const invAmt = Number(inv.total_amount || inv.amount || 0);
    const dDate = dayDiff(target, inv.due_date || inv.issue_date);
    const aMatch = amountMatches(targetAmount, invAmt);
    const isSettled = SETTLED_STATUSES.has((inv.status || "").toLowerCase());
    let score = 0;
    const reasons: string[] = [];
    if (aMatch) {
      score += 60;
      reasons.push(`amount ≈ ${invAmt}`);
    }
    if (dDate <= DATE_WINDOW_DAYS) {
      score += 35;
      reasons.push(`due date within ${DATE_WINDOW_DAYS}d`);
    } else if (dDate <= TERM_WINDOW_DAYS) {
      score += 15;
      reasons.push(`due date within ${TERM_WINDOW_DAYS}d`);
    }
    // Boost: if the invoice is already settled and amount matches exactly,
    // treat it as a confident match regardless of date drift (monthly cadence).
    if (aMatch && isSettled) {
      score += 30;
      reasons.push(`invoice settled (${inv.status})`);
    }
    if (score > 0) {
      candidates.push({
        invoice_id: inv.id,
        score,
        reason: `${inv.invoice_number}: ${reasons.join(", ")}`,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  if (!top) return { status: "missing", candidates: [] };
  if (top.score >= 90) return { status: "matched", candidates: candidates.slice(0, 3) };
  if (top.score >= 50) {
    if (candidates.length > 1 && candidates[1].score >= 50) {
      return { status: "unclear", candidates: candidates.slice(0, 5) };
    }
    return { status: "partial", candidates: candidates.slice(0, 3) };
  }
  return { status: "missing", candidates: candidates.slice(0, 3) };
}

// task helpers
function makeTaskRow(opts: {
  user_id: string;
  account_id: string;
  debtor_id: string;
  import_id: string;
  schedule_id?: string;
  key_date_type?: string;
  invoice_id?: string;
  kind: "missing" | "unclear" | "extra" | "date";
  task_type: string;
  priority: string;
  summary: string;
  details?: string;
  due_date?: string | null;
}) {
  return {
    user_id: opts.user_id,
    organization_id: opts.account_id,
    debtor_id: opts.debtor_id,
    invoice_id: opts.invoice_id || null,
    task_type: opts.task_type,
    priority: opts.priority,
    status: "open",
    summary: opts.summary,
    details: opts.details || null,
    due_date: opts.due_date || null,
    source: "contract",
    task_source: "contract",
    source_ref: {
      import_id: opts.import_id,
      schedule_id: opts.schedule_id || null,
      key_date_type: opts.key_date_type || null,
      kind: opts.kind,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { importId, generateTasks: forceTasks } = await req.json();
    if (!importId) return json({ error: "importId required" }, 400);

    const { data: imp } = await supabase
      .from("live_contract_imports")
      .select("id, account_id, debtor_id, staging_status, contract_name, term_end_date, effective_date")
      .eq("id", importId)
      .maybeSingle();
    if (!imp) return json({ error: "Contract not found" }, 404);

    const { data: schedules } = await supabase
      .from("contract_invoice_schedules")
      .select("id, account_id, import_id, debtor_id, scheduled_date, expected_due_date, amount, description, invoice_id, reconciliation_status")
      .eq("import_id", importId)
      .order("scheduled_date");

    const debtorId = imp.debtor_id;
    let invoices: Invoice[] = [];
    if (debtorId) {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, total_amount, issue_date, due_date, status, product_description")
        .eq("debtor_id", debtorId)
        .eq("is_archived", false)
        .limit(500);
      invoices = (invs as Invoice[]) || [];
    }

    const summary = { matched: 0, partial: 0, unclear: 0, missing: 0, extra: 0 };
    const usedInvoiceIds = new Set<string>();

    // Per-row classification
    for (const s of (schedules as Schedule[]) || []) {
      const r = classify(s, invoices);
      summary[r.status as keyof typeof summary] = (summary[r.status as keyof typeof summary] ?? 0) + 1;
      if (r.status === "matched" && r.candidates[0]) {
        usedInvoiceIds.add(r.candidates[0].invoice_id);
      }
      // If schedule was linked to an invoice that is now voided, clear the
      // link so the UI stops rendering a stale "billed" state.
      const stillLinkedVoided = !!(
        s.invoice_id &&
        invoices.find((i) => i.id === s.invoice_id && VOIDED_STATUSES.has((i.status || "").toLowerCase()))
      );
      await supabase
        .from("contract_invoice_schedules")
        .update({
          reconciliation_status: r.status,
          reconciliation_candidates: r.candidates,
          reconciled_at: new Date().toISOString(),
          ...(stillLinkedVoided
            ? { invoice_id: null, attachment_source: null, completion_status: "pending", completed_at: null }
            : {}),
          ...(r.status === "matched" && r.candidates[0] && !s.invoice_id && !stillLinkedVoided
            ? { invoice_id: r.candidates[0].invoice_id, attachment_source: "linked" }
            : {}),
        })
        .eq("id", s.id);
    }

    // Detect 'extra' invoices on this debtor that don't match any schedule
    const extras: Invoice[] = invoices.filter((inv) => !usedInvoiceIds.has(inv.id));
    summary.extra = extras.length;

    // Generate tasks only when published OR explicitly requested
    const shouldEmitTasks = forceTasks === true || imp.staging_status === "published";
    let tasksCreated = 0;

    if (shouldEmitTasks && debtorId) {
      const taskRows: any[] = [];

      for (const s of (schedules as Schedule[]) || []) {
        // Re-read post-update state implicitly via classification above
        const r = classify(s, invoices);
        if (r.status === "missing") {
          taskRows.push(
            makeTaskRow({
              user_id: user.id,
              account_id: imp.account_id,
              debtor_id: debtorId,
              import_id: imp.id,
              schedule_id: s.id,
              kind: "missing",
              task_type: "create_invoice",
              priority: new Date(s.scheduled_date) < new Date() ? "high" : "normal",
              summary: `Create invoice — ${s.scheduled_date}${s.amount ? ` · $${s.amount}` : ""}`,
              details: s.description || `Scheduled by contract ${imp.contract_name || imp.id}`,
              due_date: s.scheduled_date,
            }),
          );
        } else if (r.status === "unclear" || r.status === "partial") {
          taskRows.push(
            makeTaskRow({
              user_id: user.id,
              account_id: imp.account_id,
              debtor_id: debtorId,
              import_id: imp.id,
              schedule_id: s.id,
              kind: "unclear",
              task_type: "confirm_invoice_match",
              priority: "normal",
              summary: `Confirm invoice match — ${s.scheduled_date}${s.amount ? ` · $${s.amount}` : ""}`,
              details: `Possible candidates: ${r.candidates.map((c) => c.reason).join(" | ")}`,
              due_date: s.scheduled_date,
            }),
          );
        }
      }

      for (const inv of extras) {
        taskRows.push(
          makeTaskRow({
            user_id: user.id,
            account_id: imp.account_id,
            debtor_id: debtorId,
            import_id: imp.id,
            invoice_id: inv.id,
            kind: "extra",
            task_type: "review_extra_invoice",
            priority: "low",
            summary: `Review invoice ${inv.invoice_number} — not on contract schedule`,
            details: `Amount ${inv.total_amount || inv.amount}, due ${inv.due_date}`,
            due_date: inv.due_date,
          }),
        );
      }

      if (taskRows.length) {
        const { error: tErr } = await supabase
          .from("collection_tasks")
          .upsert(taskRows, {
            onConflict:
              "(source_ref->>'import_id'),(coalesce(source_ref->>'schedule_id','')),(coalesce(source_ref->>'key_date_type','')),(coalesce(source_ref->>'kind',''))",
            ignoreDuplicates: true,
          } as any);
        // upsert with the partial unique index isn't supported via PostgREST onConflict — fallback to insert + 23505 swallow
        if (tErr) {
          for (const row of taskRows) {
            const { error: insErr } = await supabase.from("collection_tasks").insert(row);
            if (insErr && insErr.code !== "23505") log("task insert error", insErr);
            else if (!insErr) tasksCreated++;
          }
        } else {
          tasksCreated = taskRows.length;
        }
      }
    }

    log("done", { importId, summary, tasksCreated, shouldEmitTasks });
    return json({ success: true, summary, tasks_created: tasksCreated, published: imp.staging_status === "published" });
  } catch (e) {
    log("error", { e: String(e) });
    return json({ error: String(e) }, 500);
  }
});
