import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LogoUpload } from "@/components/LogoUpload";
import { SenderIdentitySection } from "@/components/branding/SenderIdentitySection";
import { EmailPreviewPanel } from "@/components/branding/EmailPreviewPanel";
import { 
  Copy, 
  ExternalLink, 
  Palette, 
  Globe, 
  Mail,
  FileText,
  Eye,
  EyeOff,
  Save,
  AlertCircle
} from "lucide-react";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

interface BrandingSettings {
  id: string;
  user_id: string;
  business_name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  email_signature: string | null;
  email_footer: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  ar_page_public_token: string | null;
  ar_page_enabled: boolean;
  footer_disclaimer: string | null;
  escalation_contact_name: string | null;
  escalation_contact_email: string | null;
  escalation_contact_phone: string | null;
  ar_contact_email: string | null;
  supported_payment_methods: string[];
  stripe_payment_link: string | null;
  ar_page_last_updated_at: string | null;
  // Sender identity fields
  sending_mode: string | null;
  from_email_verified: boolean | null;
  from_email_verification_status: string | null;
  verified_from_email: string | null;
  last_test_email_sent_at: string | null;
  email_wrapper_enabled: boolean | null;
  // Email format preference
  email_format: "simple" | "enhanced" | null;
}

export default function Branding() {
  const queryClient = useQueryClient();
  const { effectiveAccountId, isTeamMember } = useEffectiveAccount();
  const [formData, setFormData] = useState<Partial<BrandingSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: branding, isLoading } = useQuery({
    queryKey: ["branding-settings", effectiveAccountId],
    queryFn: async () => {
      if (!effectiveAccountId) return null;

      const { data, error } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", effectiveAccountId)
        .maybeSingle();

      if (error) throw error;
      return data as BrandingSettings | null;
    },
    enabled: !!effectiveAccountId,
  });

  useEffect(() => {
    if (branding) {
      setFormData(branding);
    }
  }, [branding]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BrandingSettings>) => {
      if (!effectiveAccountId) throw new Error("No account");

      const updateData = {
        ...updates,
        ar_page_last_updated_at: new Date().toISOString(),
      };

      if (branding) {
        const { error } = await supabase
          .from("branding_settings")
          .update(updateData)
          .eq("id", branding.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("branding_settings")
          .insert({
            ...updateData,
            user_id: effectiveAccountId,
            business_name: updates.business_name || "My Company",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding-settings"] });
      setHasChanges(false);
      toast.success("Branding settings saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleChange = (field: keyof BrandingSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const copyPublicLink = () => {
    if (!formData.ar_page_public_token) return;
    const link = `${window.location.origin}/ar/${formData.ar_page_public_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Public link copied to clipboard");
  };

  const publicPageUrl = formData.ar_page_public_token 
    ? `${window.location.origin}/ar/${formData.ar_page_public_token}`
    : null;

  if (isTeamMember) {
    return (
      <Layout>
        <div className="container max-w-4xl py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p>Branding settings are managed by the account owner.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-6xl py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Branding Settings</h1>
            <p className="text-muted-foreground">
              Customize your company branding, email identity, and public AR information page
            </p>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
          {/* Left Column - Settings */}
          <div className="space-y-8">
            {/* Sender Identity - NEW SECTION */}
            <SenderIdentitySection 
              formData={formData} 
              onChange={handleChange} 
            />

            {/* Logo & Brand Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Identity
                </CardTitle>
                <CardDescription>
                  Your logo and colors appear on emails and the public AR page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Company Logo</Label>
                  <div className="mt-2">
                    <LogoUpload
                      currentLogoUrl={formData.logo_url || null}
                      onLogoChange={(url) => handleChange("logo_url", url)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="primary_color"
                        type="color"
                        value={formData.primary_color || "#111827"}
                        onChange={(e) => handleChange("primary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={formData.primary_color || "#111827"}
                        onChange={(e) => handleChange("primary_color", e.target.value)}
                        placeholder="#111827"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="accent_color">Accent Color</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="accent_color"
                        type="color"
                        value={formData.accent_color || "#6366f1"}
                        onChange={(e) => handleChange("accent_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={formData.accent_color || "#6366f1"}
                        onChange={(e) => handleChange("accent_color", e.target.value)}
                        placeholder="#6366f1"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Content Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Content
                </CardTitle>
                <CardDescription>
                  Customize signatures and footers that appear in your emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email_signature">Email Signature</Label>
                  <Textarea
                    id="email_signature"
                    value={formData.email_signature || ""}
                    onChange={(e) => handleChange("email_signature", e.target.value)}
                    placeholder="Your custom email signature..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email_footer">Email Footer</Label>
                  <Textarea
                    id="email_footer"
                    value={formData.email_footer || ""}
                    onChange={(e) => handleChange("email_footer", e.target.value)}
                    placeholder="Legal disclaimers, unsubscribe text, etc."
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Public AR Page */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Public AR Information Page
                </CardTitle>
                <CardDescription>
                  Share payment instructions, documents, and contact info with customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {formData.ar_page_enabled ? (
                      <Eye className="h-5 w-5 text-green-600" />
                    ) : (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">Page Status</p>
                      <p className="text-sm text-muted-foreground">
                        {formData.ar_page_enabled 
                          ? "Public page is live and accessible"
                          : "Public page is disabled"
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.ar_page_enabled || false}
                    onCheckedChange={(checked) => handleChange("ar_page_enabled", checked)}
                  />
                </div>

                {publicPageUrl && (
                  <div>
                    <Label>Public Link</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={publicPageUrl}
                        readOnly
                        className="flex-1 bg-muted"
                      />
                      <Button variant="outline" onClick={copyPublicLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" asChild>
                        <a href={publicPageUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This link is permanent and included in all email communications
                    </p>
                  </div>
                )}

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ar_contact_email">AR Contact Email</Label>
                    <Input
                      id="ar_contact_email"
                      type="email"
                      value={formData.ar_contact_email || ""}
                      onChange={(e) => handleChange("ar_contact_email", e.target.value)}
                      placeholder="ar@yourcompany.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stripe_payment_link">Stripe Payment Link</Label>
                    <Input
                      id="stripe_payment_link"
                      value={formData.stripe_payment_link || ""}
                      onChange={(e) => handleChange("stripe_payment_link", e.target.value)}
                      placeholder="https://pay.stripe.com/..."
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Escalation Contact</Label>
                  <div className="grid gap-4 sm:grid-cols-3 mt-1">
                    <Input
                      value={formData.escalation_contact_name || ""}
                      onChange={(e) => handleChange("escalation_contact_name", e.target.value)}
                      placeholder="Name"
                    />
                    <Input
                      type="email"
                      value={formData.escalation_contact_email || ""}
                      onChange={(e) => handleChange("escalation_contact_email", e.target.value)}
                      placeholder="Email"
                    />
                    <Input
                      value={formData.escalation_contact_phone || ""}
                      onChange={(e) => handleChange("escalation_contact_phone", e.target.value)}
                      placeholder="Phone"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="footer_disclaimer">Footer Disclaimer</Label>
                  <Textarea
                    id="footer_disclaimer"
                    value={formData.footer_disclaimer || ""}
                    onChange={(e) => handleChange("footer_disclaimer", e.target.value)}
                    placeholder="Legal disclaimers for the public AR page..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Document Visibility Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Visibility
                </CardTitle>
                <CardDescription>
                  Control which documents appear on your public AR page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p>
                      To make documents visible on your public AR page, go to the{" "}
                      <a href="/documents" className="text-primary hover:underline">
                        Documents
                      </a>{" "}
                      page, <strong>verify the document</strong>, then toggle the "Visible on Public AR Page" option.
                    </p>
                    <p className="mt-2">
                      <strong>Note:</strong> Only verified documents can be made public. Documents must be reviewed and verified before they appear on the AR page.
                    </p>
                    <p className="mt-2">
                      Only W-9s, ACH authorizations, wire instructions, and compliance documents 
                      should typically be made public.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Email Preview */}
          <div className="hidden lg:block">
            <EmailPreviewPanel 
              formData={formData} 
              onFormatChange={(format) => handleChange("email_format", format)}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
