import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
        "id, invoice_number, debtor_id, amount, balance, due_date, status, aging_bucket, days_past_due, currency"
      )
      .gt("balance", 0)
      .order("days_past_due", { ascending: false })
      .limit(limit);
    if (debtor_id) q = q.eq("debtor_id", debtor_id);
    if (aging_bucket) q = q.eq("aging_bucket", aging_bucket);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { invoices: data ?? [] },
    };
  },
});
