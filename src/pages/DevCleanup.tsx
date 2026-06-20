import { useMemo, useState, useRef } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, Copy, Square, AlertTriangle } from "lucide-react";
import { streamCleanup, estimateCost, type UsageInfo } from "@/utils/codeCleanup";

// Lazy-loaded raw source of every .ts/.tsx file in src.
const SRC_FILES = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const EXCLUDED = new Set<string>([
  "/src/integrations/supabase/client.ts",
  "/src/integrations/supabase/types.ts",
]);

const ALL_PATHS = Object.keys(SRC_FILES)
  .filter((p) => !EXCLUDED.has(p))
  .sort();

const DevCleanup = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState("");
  const [cleanedCode, setCleanedCode] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const filteredPaths = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_PATHS;
    return ALL_PATHS.filter((p) => p.toLowerCase().includes(q));
  }, [query]);

  const runCleanup = async (path: string) => {
    if (streaming) return;
    setSelected(path);
    setCleanedCode("");
    setUsage(null);
    setElapsedMs(0);

    let source = "";
    try {
      source = await SRC_FILES[path]();
    } catch (e) {
      toast.error(`Failed to load ${path}`);
      return;
    }
    setOriginalCode(source);

    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsedMs(Date.now() - startedAt), 200);

    try {
      await streamCleanup({
        filename: path.replace(/^\//, ""),
        code: source,
        signal: ac.signal,
        onToken: (delta) => setCleanedCode((prev) => prev + delta),
        onUsage: (u) => setUsage(u),
      });
      toast.success("Cleanup complete");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        toast.message("Cancelled");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      clearInterval(tick);
      setElapsedMs(Date.now() - startedAt);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const copyCleaned = async () => {
    await navigator.clipboard.writeText(cleanedCode);
    toast.success("Copied cleaned code");
  };

  const cost = usage ? estimateCost(usage.inputTokens, usage.outputTokens) : 0;

  return (
    <AdminLayout
      title="Code Cleanup (Dev Tool)"
      description="Stream a Claude Sonnet 4.5 refactor of any source file. Review and copy only — nothing is written to disk."
    >
      <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
        <div>
          <strong>Dev tool.</strong> Powered by Anthropic <code>claude-sonnet-4-5</code>.
          This page never writes files. Copy results manually and apply per file.
          Auto-generated files (<code>supabase/client.ts</code>, <code>types.ts</code>) are excluded.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* File list */}
        <Card className="p-3">
          <Input
            placeholder={`Search ${ALL_PATHS.length} files…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-3"
          />
          <ScrollArea className="h-[70vh]">
            <div className="space-y-1 pr-2">
              {filteredPaths.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={streaming}
                  onClick={() => runCleanup(p)}
                  className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                    selected === p ? "bg-muted" : ""
                  }`}
                >
                  <span className="truncate font-mono" title={p}>
                    {p.replace("/src/", "")}
                  </span>
                  <Sparkles className="h-3 w-3 shrink-0 opacity-60" />
                </button>
              ))}
              {filteredPaths.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-4">No files match.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Diff + stats */}
        <Card className="p-3 flex flex-col min-h-[70vh]">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-sm font-mono truncate">
              {selected ?? "Select a file to begin"}
            </div>
            <div className="flex items-center gap-2">
              {usage && (
                <>
                  <Badge variant="secondary">in {usage.inputTokens.toLocaleString()}</Badge>
                  <Badge variant="secondary">out {usage.outputTokens.toLocaleString()}</Badge>
                  <Badge>${cost.toFixed(4)}</Badge>
                </>
              )}
              {elapsedMs > 0 && (
                <Badge variant="outline">{(elapsedMs / 1000).toFixed(1)}s</Badge>
              )}
              {streaming && (
                <Button size="sm" variant="destructive" onClick={cancel}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!cleanedCode}
                onClick={copyCleaned}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy cleaned
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            {selected ? (
              <ReactDiffViewer
                oldValue={originalCode}
                newValue={cleanedCode}
                splitView
                useDarkTheme={
                  typeof document !== "undefined" &&
                  document.documentElement.classList.contains("dark")
                }
                leftTitle="Original"
                rightTitle={streaming ? "Cleaned (streaming…)" : "Cleaned"}
              />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Pick a file from the left to stream a cleanup.
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default DevCleanup;
