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

export default defineTool({
  name: "get_contract",
  title: "Get contract",
  description:
    "Get a single contract by id, including AI summary, extracted terms, key dates, risk flags, and critical dates for the signed-in user.",
  inputSchema: {
    contract_id: z.string().uuid().describe("The contract id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ contract_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = sb(ctx);
    const { data: contract, error } = await client
      .from("contracts")
      .select("*")
      .eq("id", contract_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!contract) return { content: [{ type: "text", text: "Contract not found" }], isError: true };

    const [riskFlags, criticalDates] = await Promise.all([
      client
        .from("contract_risk_flags")
        .select("*")
        .eq("contract_id", contract_id),
      client
        .from("contract_critical_dates")
        .select("*")
        .eq("contract_id", contract_id)
        .order("date", { ascending: true }),
    ]);

    const payload = {
      contract,
      risk_flags: riskFlags.data ?? [],
      critical_dates: criticalDates.data ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
