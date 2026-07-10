declare const process: { env: Record<string, string | undefined> };
import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ACTIVE_STATUSES = ["Open", "PartiallyPaid", "InPaymentPlan", "Disputed", "FinalInternalCollections"];

const AGING_BUCKETS: Record<string, string[]> = {
  current: ["current"],
  "1-30": ["1-30", "dpd_1_30"],
  "31-60": ["31-60", "dpd_31_60"],
  "61-90": ["61-90", "dpd_61_90"],
  "91-120": ["91-120", "dpd_91_120"],
  "121+": ["121+", "dpd_121_150", "dpd_150_plus", "dpd_120_plus", "dpd_121_plus"],
};

function daysPastDue(dueDate: string | null) {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.floor((todayUtc - due.getTime()) / 86_400_000));
}

export default defineTool({
  name: "list_open_invoices",
  title: "List open invoices",
  description:
    "List open (unpaid) invoices for the signed-in Recouply user. Filter by aging bucket or debtor. Sorted by days past due descending.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50),
    debtor_id: z.string().uuid().optional().describe("Restrict to a single debtor id."),
    aging_bucket: z
      .enum(["current", "1-30", "31-60", "61-90", "91-120", "121+"])
      .optional()
      .describe("Restrict to a single aging bucket."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, debtor_id, aging_bucket }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = sb(ctx)
      .from("invoices")
      .select(
        "id, reference_id, invoice_number, debtor_id, amount, amount_outstanding, due_date, issue_date, status, aging_bucket, currency, debtors(company_name, name, email)"
      )
      .in("status", ACTIVE_STATUSES)
      .gt("amount_outstanding", 0)
      .order("due_date", { ascending: true })
      .limit(limit);
    if (debtor_id) q = q.eq("debtor_id", debtor_id);
    if (aging_bucket) q = q.in("aging_bucket", AGING_BUCKETS[aging_bucket] ?? [aging_bucket]);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const invoices = (data ?? [])
      .map((invoice: any) => ({
        ...invoice,
        balance: invoice.amount_outstanding ?? invoice.amount,
        days_past_due: daysPastDue(invoice.due_date),
        debtor_name: invoice.debtors?.company_name ?? invoice.debtors?.name ?? null,
      }))
      .sort((a, b) => b.days_past_due - a.days_past_due);
    return {
      content: [{ type: "text", text: JSON.stringify(invoices, null, 2) }],
      structuredContent: { invoices },
    };
  },
});
