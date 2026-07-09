import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEO from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const mcpUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

export default function Connect() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      toast.success("MCP URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy \u2014 select and copy manually");
    }
  };

  return (
    <MarketingLayout>
      <SEO
        title="Connect Recouply to ChatGPT & Claude | Recouply"
        description="Give ChatGPT or Claude secure access to your Recouply debtors, invoices, and collection tasks by adding Recouply as an MCP connector."
      />
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
        <header className="mb-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI assistant integration
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Connect Recouply to your AI assistant
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Add Recouply as a connector in ChatGPT or Claude so you can ask about your
            debtors, open invoices, and collection tasks directly from a chat. You'll sign in
            with your Recouply account, and everything runs under your row-level security.
          </p>
        </header>

        <Card className="mb-10 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Your MCP server URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all">
                {mcpUrl}
              </code>
              <Button onClick={copy} className="sm:w-auto">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" /> Copy URL
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Paste this URL wherever your AI assistant asks for a custom MCP connector.
            </p>
          </CardContent>
        </Card>

        <section className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ChatGPT</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-3 text-sm text-foreground/90 marker:text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    href="https://chatgpt.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    chatgpt.com
                  </a>
                  , then go to <strong>Settings &rarr; Connectors &rarr; Advanced</strong> and enable{" "}
                  <strong>Developer mode</strong> (read the risk notice shown there).
                </li>
                <li>
                  In the chat composer's <strong>+</strong> menu, turn on <strong>Developer mode</strong>.
                </li>
                <li>
                  Click <strong>Add sources</strong>, then <strong>Connect more</strong>.
                </li>
                <li>
                  Name the connector (e.g. <em>Recouply</em>) and paste the MCP URL above.
                  Sign in with your Recouply account when prompted.
                </li>
                <li>
                  Ask ChatGPT something like <em>&ldquo;List my top overdue debtors in Recouply.&rdquo;</em>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claude</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-3 text-sm text-foreground/90 marker:text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    href="https://claude.ai/settings/connectors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    claude.ai &rarr; Settings &rarr; Connectors
                  </a>{" "}
                  and click <strong>Add custom connector</strong>.
                </li>
                <li>
                  Name the connector (e.g. <em>Recouply</em>) and paste the MCP URL above.
                  Sign in with your Recouply account when prompted.
                </li>
                <li>
                  Enable the connector from the chat composer, then ask Claude to use Recouply.
                </li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground text-center mt-10">
          Your assistant will only see data your Recouply user account can access. You can
          disconnect at any time from your AI assistant's connector settings.
        </p>
      </div>
    </MarketingLayout>
  );
}
