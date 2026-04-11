import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Link2, Check } from "lucide-react";
import { toast } from "sonner";

interface InvoiceLinkCardProps {
  invoiceId: string;
  publicToken: string | null;
  stripeHostedUrl: string | null;
  invoice?: {
    invoice_number: string;
    amount: number;
    due_date: string;
    issue_date: string;
    status: string;
    currency?: string | null;
    product_description?: string | null;
  };
  debtorName?: string;
}

export const InvoiceLinkCard = ({
  publicToken,
  stripeHostedUrl,
  invoice,
  debtorName,
}: InvoiceLinkCardProps) => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [branding, setBranding] = useState<{
    business_name: string;
    primary_color: string | null;
    logo_url: string | null;
  } | null>(null);
  const [template, setTemplate] = useState<{
    header_color: string | null;
    font_style: string | null;
  } | null>(null);
  const [companyAddress, setCompanyAddress] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: effectiveId } = await supabase.rpc("get_effective_account_id", {
        p_user_id: user.id,
      });

      const accountId = effectiveId || user.id;

      const [brandingRes, templateRes, profileRes] = await Promise.all([
        supabase
          .from("branding_settings")
          .select("public_invoice_links_enabled, business_name, primary_color, logo_url")
          .eq("user_id", accountId)
          .maybeSingle(),
        supabase
          .from("invoice_templates")
          .select("header_color, font_style, company_address")
          .eq("user_id", accountId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("business_name, business_address_line1, business_address_line2, business_city, business_state, business_postal_code")
          .eq("id", accountId)
          .maybeSingle(),
      ]);

      setEnabled(brandingRes.data?.public_invoice_links_enabled ?? false);

      // Use profile business_name as primary, fall back to branding
      const profileName = profileRes.data?.business_name;
      if (brandingRes.data) {
        setBranding({
          business_name: profileName || brandingRes.data.business_name,
          primary_color: brandingRes.data.primary_color,
          logo_url: brandingRes.data.logo_url,
        });
      }
      if (templateRes.data) {
        setTemplate(templateRes.data);
      }

      // Build company address: prefer template, fall back to profile
      const templateAddr = (templateRes.data as any)?.company_address;
      if (templateAddr) {
        setCompanyAddress(templateAddr);
      } else if (profileRes.data) {
        const p = profileRes.data;
        const addr = [
          p.business_address_line1,
          p.business_address_line2,
          [p.business_city, p.business_state].filter(Boolean).join(", "),
          p.business_postal_code,
        ].filter(Boolean).join("\n");
        if (addr) setCompanyAddress(addr);
      }
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

  const hc = template?.header_color || branding?.primary_color || "#1a56db";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      <CardContent className="space-y-3">
        {activeLink ? (
          <>
            {/* Mini template preview */}
            {invoice && branding && !stripeHostedUrl && (
              <div
                className="rounded-md border overflow-hidden text-[10px] leading-tight"
                style={{ fontFamily: template?.font_style === "classic" ? "Georgia, serif" : "system-ui, sans-serif" }}
              >
                {/* Header bar */}
                <div className="px-3 py-2 flex justify-between items-start" style={{ borderBottom: `2px solid ${hc}` }}>
                  <div>
                    {branding.logo_url && (
                      <img src={branding.logo_url} alt="" className="h-5 object-contain mb-0.5" style={{ maxWidth: 80 }} />
                    )}
                    <div className="font-semibold" style={{ color: hc, fontSize: "11px" }}>
                      {branding.business_name}
                    </div>
                    {companyAddress && (
                      <div className="text-gray-600 whitespace-pre-line" style={{ fontSize: "8px", lineHeight: 1.3 }}>
                        {companyAddress}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-light tracking-wide" style={{ color: hc, fontSize: "14px" }}>Invoice</div>
                    <div className="font-semibold text-gray-700">#{invoice.invoice_number}</div>
                  </div>
                </div>
                {/* Bill To & Amount */}
                <div className="px-3 py-2 flex justify-between">
                  <div>
                    <div className="uppercase tracking-wider font-bold" style={{ color: hc, fontSize: "8px" }}>Bill To</div>
                    <div className="text-gray-600">{debtorName || "Customer"}</div>
                  </div>
                  <div className="text-right">
                    <div className="rounded px-2 py-1" style={{ backgroundColor: `${hc}10` }}>
                      <div className="uppercase tracking-wider font-bold" style={{ color: hc, fontSize: "8px" }}>
                        {invoice.status?.toLowerCase() === "paid" ? "Paid" : "Amount Due"}
                      </div>
                      <div className="font-bold" style={{ color: hc, fontSize: "13px" }}>
                        {formatCurrency(invoice.amount)}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Line item header */}
                <div className="mx-3">
                  <div className="grid grid-cols-3 text-white px-2 py-1 rounded-t uppercase tracking-wider font-bold" style={{ backgroundColor: hc, fontSize: "7px" }}>
                    <span>Description</span>
                    <span className="text-center">Date</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="grid grid-cols-3 px-2 py-1.5 border-x border-b rounded-b text-gray-600">
                    <span className="truncate">{invoice.product_description || `Invoice ${invoice.invoice_number}`}</span>
                    <span className="text-center">{formatDate(invoice.issue_date)}</span>
                    <span className="text-right">{formatCurrency(invoice.amount)}</span>
                  </div>
                </div>
                {/* Bottom bar */}
                <div className="h-1 mt-2" style={{ backgroundColor: hc }} />
              </div>
            )}

            {/* Link + actions */}
            <div className="flex gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground truncate font-mono">
                {activeLink}
              </div>
              <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="shrink-0" asChild>
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
          </>
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
