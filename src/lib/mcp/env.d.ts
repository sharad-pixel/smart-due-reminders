// Runtime env for MCP tools. Bundled by @lovable.dev/mcp-js into a Deno
// edge function where `process.env` is polyfilled. This declaration keeps
// the TypeScript project (which targets the browser) happy.
declare const process: { env: Record<string, string | undefined> };
