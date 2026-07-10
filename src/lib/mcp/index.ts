import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDebtors from "./tools/list-debtors";
import listOpenInvoices from "./tools/list-open-invoices";
import listCollectionTasks from "./tools/list-collection-tasks";
import getDebtor from "./tools/get-debtor";
import listContracts from "./tools/list-contracts";
import getContract from "./tools/get-contract";

// The OAuth issuer must be the direct Supabase host (never the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined at build time so this stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "recouply-mcp",
  title: "Recouply",
  version: "0.1.0",
  instructions:
    "Tools for Recouply, an AI-powered accounts receivable and collections platform. Use these tools to inspect debtors (customer accounts), open invoices, and active collection tasks for the signed-in user. All calls run under the user's row-level security, so results are scoped to their organization.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDebtors, listOpenInvoices, listCollectionTasks, getDebtor],
});
