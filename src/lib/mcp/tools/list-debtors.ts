declare const process: { env: Record<string, string | undefined> };
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
  name: "list_debtors",
  title: "List debtors",
  description:
    "List debtors (customer accounts) for the signed-in Recouply user, sorted by open balance descending.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("Max debtors to return."),
    min_balance: z.number().min(0).default(0).describe("Only include debtors whose total_open_balance is at least this amount."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, min_balance }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await sb(ctx)
      .from("debtors")
      .select(
        "id, name, company_name, email, phone, total_open_balance, open_invoices_count, risk_tier, avg_days_to_pay, max_days_past_due"
      )
      .gte("total_open_balance", min_balance)
      .eq("is_archived", false)
      .order("total_open_balance", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { debtors: data ?? [] },
    };
  },
});
