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
  name: "list_collection_tasks",
  title: "List collection tasks",
  description:
    "List active collection tasks (Command Center kanban) for the signed-in Recouply user, filtered by status and priority.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
    status: z
      .enum(["open", "in_progress", "waiting", "completed"])
      .optional()
      .describe("Filter by task status."),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, priority }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = sb(ctx)
      .from("collection_tasks")
      .select(
        "id, task_type, priority, status, summary, details, recommended_action, due_date, debtor_id, invoice_id, created_at"
      )
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (priority) q = q.eq("priority", priority);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
