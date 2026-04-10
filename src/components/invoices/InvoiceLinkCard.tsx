import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Link2, Check } from "lucide-react";
import { toast } from "sonner";

interface InvoiceLinkCardProps {
  invoiceId: string;
  publicToken: string | null;
  stripeHostedUrl: string | null;
}

export const InvoiceLinkCard = ({
  publicToken,
  stripeHostedUrl,
}: InvoiceLinkCardProps) => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check effective account
      const { data: effectiveId } = await supabase.rpc("get_effective_account_id", {
        p_user_id: user.id,
      });

      const { data } = await supabase
        .from("branding_settings")
        .select("public_invoice_links_enabled")
        .eq("user_id", effectiveId || user.id)
        .maybeSingle();

      setEnabled(data?.public_invoice_links_enabled ?? false);
    })();
  }, []);

  if (enabled === null) return null;

  const invoiceLink = publicToken
    ? `${window.location.origin}/invoice/${publicToken}`
    : null;

  const activeLink = stripeHostedUrl || (enabled ? invoiceLink : null);
  const linkType = stripeHostedUrl ? "Stripe" : enabled ? "Branded" : null;

  const handleCopy = () => {
    if (!activeLink) return;
    navigator.clipboard.writeText(activeLink);
    setCopied(true);
    toast.success("Invoice link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4" />
          Invoice Link
          {linkType && (
            <Badge variant="secondary" className="text-xs">
              {linkType}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeLink ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={activeLink}
                readOnly
                className="flex-1 bg-muted text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={activeLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {stripeHostedUrl
                ? "This invoice uses a Stripe hosted payment link."
                : "Share this branded invoice link with your customer."}
            </p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p>
              Public invoice links are disabled. Enable them in{" "}
              <a href="/branding" className="text-primary hover:underline font-medium">
                Branding Settings
              </a>{" "}
              to generate shareable branded invoice links.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
