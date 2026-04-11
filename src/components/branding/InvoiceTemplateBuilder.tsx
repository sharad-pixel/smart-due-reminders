import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FileText, Save, Loader2, Eye } from "lucide-react";
import { InvoiceTemplatePreview } from "./InvoiceTemplatePreview";
import { QrCodeUploadField } from "./QrCodeUploadField";

export interface InvoiceTemplateData {
  id?: string;
  company_address: string;
  company_phone: string;
  company_website: string;
  show_logo: boolean;
  show_ship_to: boolean;
  show_po_number: boolean;
  show_sales_rep: boolean;
  show_tax: boolean;
  show_notes: boolean;
  show_payment_instructions: boolean;
  show_payment_qr_codes: boolean;
  header_color: string;
  payment_instructions_wire: string;
  payment_instructions_check: string;
  footer_note: string;
  font_style: string;
  qr_code_venmo_url: string;
  qr_code_stripe_url: string;
  qr_code_paypal_url: string;
  qr_code_cashapp_url: string;
}

const defaultTemplate: InvoiceTemplateData = {
  company_address: "",
  company_phone: "",
  company_website: "",
  show_logo: true,
  show_ship_to: true,
  show_po_number: true,
  show_sales_rep: false,
  show_tax: true,
  show_notes: true,
  show_payment_instructions: true,
  show_payment_qr_codes: false,
  header_color: "#1a56db",
  payment_instructions_wire: "",
  payment_instructions_check: "",
  footer_note: "Thank you for your business.",
  font_style: "modern",
  qr_code_venmo_url: "",
  qr_code_stripe_url: "",
  qr_code_paypal_url: "",
  qr_code_cashapp_url: "",
};

interface InvoiceTemplateBuilderProps {
  businessName: string;
  logoUrl: string | null;
  effectiveAccountId: string | null;
}

export const InvoiceTemplateBuilder = ({
  businessName,
  logoUrl,
  effectiveAccountId,
}: InvoiceTemplateBuilderProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<InvoiceTemplateData>(defaultTemplate);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ["invoice-template", effectiveAccountId],
    queryFn: async () => {
      if (!effectiveAccountId) return null;
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("user_id", effectiveAccountId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveAccountId,
  });

  // Fetch profile address as fallback for company_address
  const { data: profileAddress } = useQuery({
    queryKey: ["profile-address", effectiveAccountId],
    queryFn: async () => {
      if (!effectiveAccountId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("business_name, business_address_line1, business_address_line2, business_city, business_state, business_postal_code, business_country, business_phone")
        .eq("id", effectiveAccountId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!effectiveAccountId,
  });

  // Build fallback address from profile fields
  const profileAddressStr = profileAddress
    ? [
        profileAddress.business_address_line1,
        profileAddress.business_address_line2,
        [profileAddress.business_city, profileAddress.business_state].filter(Boolean).join(", "),
        profileAddress.business_postal_code,
      ].filter(Boolean).join("\n")
    : "";

  // Fetch a sample invoice to show real description in preview
  const { data: sampleInvoice } = useQuery({
    queryKey: ["sample-invoice-preview", effectiveAccountId],
    queryFn: async () => {
      if (!effectiveAccountId) return null;
      const { data, error } = await supabase
        .from("invoices")
        .select("product_description, invoice_number, reference_id, amount, due_date, issue_date, notes")
        .eq("user_id", effectiveAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!effectiveAccountId,
  });

  useEffect(() => {
    if (template) {
      setFormData({
        id: template.id,
        company_address: template.company_address || "",
        company_phone: template.company_phone || "",
        company_website: template.company_website || "",
        show_logo: template.show_logo ?? true,
        show_ship_to: template.show_ship_to ?? true,
        show_po_number: template.show_po_number ?? true,
        show_sales_rep: template.show_sales_rep ?? false,
        show_tax: template.show_tax ?? true,
        show_notes: (template as any).show_notes ?? true,
        show_payment_instructions: template.show_payment_instructions ?? true,
        show_payment_qr_codes: (template as any).show_payment_qr_codes ?? false,
        header_color: template.header_color || "#1a56db",
        payment_instructions_wire: template.payment_instructions_wire || "",
        payment_instructions_check: template.payment_instructions_check || "",
        footer_note: template.footer_note || "",
        font_style: template.font_style || "modern",
        qr_code_venmo_url: (template as any).qr_code_venmo_url || "",
        qr_code_stripe_url: (template as any).qr_code_stripe_url || "",
        qr_code_paypal_url: (template as any).qr_code_paypal_url || "",
        qr_code_cashapp_url: (template as any).qr_code_cashapp_url || "",
      });
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async (data: InvoiceTemplateData) => {
      if (!effectiveAccountId) throw new Error("No account");
      const payload = { ...data, user_id: effectiveAccountId };
      delete (payload as any).id;

      if (template) {
        const { error } = await supabase
          .from("invoice_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("invoice_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-template"] });
      setHasChanges(false);
      toast.success("Invoice template saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleChange = <K extends keyof InvoiceTemplateData>(
    field: K,
    value: InvoiceTemplateData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading template…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Template Builder
              </CardTitle>
              <CardDescription>
                Design your branded invoice format used for customer-facing invoice links
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showPreview ? "Hide Preview" : "Preview"}
              </Button>
              {hasChanges && (
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate(formData)}
                  disabled={saveMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Details */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Company Details</h3>
            {profileAddressStr ? (
              <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground mb-3">
                <p className="font-medium text-foreground text-xs mb-1">Address (from Business Profile)</p>
                <p className="whitespace-pre-line">{profileAddressStr}</p>
                <p className="text-xs mt-2">Edit this in <a href="/settings" className="text-primary underline">Settings → Business Profile</a></p>
              </div>
            ) : (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-3">
                No business address configured. <a href="/settings" className="text-primary underline">Add it in Settings → Business Profile</a>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="company_phone">Phone</Label>
                <Input
                  id="company_phone"
                  value={formData.company_phone}
                  onChange={(e) => handleChange("company_phone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="company_website">Website</Label>
                <Input
                  id="company_website"
                  value={formData.company_website}
                  onChange={(e) => handleChange("company_website", e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Appearance */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Appearance</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="header_color">Header Accent Color</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={formData.header_color}
                    onChange={(e) => handleChange("header_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.header_color}
                    onChange={(e) => handleChange("header_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Font Style</Label>
                <Select
                  value={formData.font_style}
                  onValueChange={(v) => handleChange("font_style", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Modern (Sans-serif)</SelectItem>
                    <SelectItem value="classic">Classic (Serif)</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section Visibility Toggles */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Section Visibility</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "show_logo" as const, label: "Company Logo" },
                { key: "show_po_number" as const, label: "PO Number Column" },
                { key: "show_sales_rep" as const, label: "Sales Rep Column" },
                { key: "show_tax" as const, label: "Tax Line" },
                { key: "show_notes" as const, label: "Invoice Notes" },
                { key: "show_payment_instructions" as const, label: "Payment Instructions" },
                { key: "show_payment_qr_codes" as const, label: "Payment QR Codes" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={formData[key]}
                    onCheckedChange={(v) => handleChange(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Payment Instructions */}
          {formData.show_payment_instructions && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Payment Instructions</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment_wire">Wire / ACH Instructions</Label>
                  <Textarea
                    id="payment_wire"
                    value={formData.payment_instructions_wire}
                    onChange={(e) =>
                      handleChange("payment_instructions_wire", e.target.value)
                    }
                    placeholder={"Bank Name\nRouting: XXXXXXXXX\nAccount: XXXXXXXXXX\nSWIFT: XXXXXXXX"}
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="payment_check">Check Payment Instructions</Label>
                  <Textarea
                    id="payment_check"
                    value={formData.payment_instructions_check}
                    onChange={(e) =>
                      handleChange("payment_instructions_check", e.target.value)
                    }
                    placeholder={"Company Name\nAttn: Accounts Receivable\nP.O. Box XXXXX\nCity, State ZIP"}
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payment QR Codes */}
          {formData.show_payment_qr_codes && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Payment QR Codes</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Upload QR code images from your payment apps. These will display on your invoice.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  { key: "qr_code_venmo_url" as const, label: "Venmo" },
                  { key: "qr_code_paypal_url" as const, label: "PayPal" },
                  { key: "qr_code_cashapp_url" as const, label: "Cash App" },
                  { key: "qr_code_stripe_url" as const, label: "Stripe" },
                ] as const).map(({ key, label }) => (
                  <QrCodeUploadField
                    key={key}
                    label={label}
                    value={formData[key]}
                    effectiveAccountId={effectiveAccountId}
                    onChange={(url) => handleChange(key, url)}
                  />
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Footer Note */}
          <div>
            <Label htmlFor="footer_note">Footer Note</Label>
            <Textarea
              id="footer_note"
              value={formData.footer_note}
              onChange={(e) => handleChange("footer_note", e.target.value)}
              placeholder="Thank you for your continued partnership…"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      {showPreview && (
        <InvoiceTemplatePreview
          template={{
            ...formData,
            company_address: formData.company_address || profileAddressStr,
          }}
          businessName={businessName}
          logoUrl={logoUrl}
          sampleInvoice={sampleInvoice ? {
            description: sampleInvoice.product_description || null,
            invoice_number: sampleInvoice.invoice_number || null,
            reference_id: sampleInvoice.reference_id || null,
            amount: sampleInvoice.amount || null,
            due_date: sampleInvoice.due_date || null,
            issue_date: sampleInvoice.issue_date || null,
            notes: sampleInvoice.notes || null,
          } : undefined}
        />
      )}
    </div>
  );
};
