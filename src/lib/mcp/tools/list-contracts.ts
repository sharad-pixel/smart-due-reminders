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
  name: "list_contracts",
  title: "List contracts",
  description:
    "List contracts for the signed-in Recouply user. Optionally filter by status, contract type, or counterparty name. Sorted by expiry date ascending (soonest first).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
    status: z.string().optional().describe("Filter by contract status (e.g. active, expired, draft)."),
    contract_type: z.string().optional().describe("Filter by contract type."),
    counterparty: z.string().optional().describe("Case-insensitive match on counterparty name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, contract_type, counterparty }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = sb(ctx)
      .from("contracts")
      .select(
        "id, title, contract_type, status, counterparty_name, counterparty_email, contract_value, currency, effective_date, expiry_date, renewal_date, ai_summary, created_at"
      )
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (contract_type) q = q.eq("contract_type", contract_type);
    if (counterparty) q = q.ilike("counterparty_name", `%${counterparty}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { contracts: data ?? [] },
    };
  },
});
