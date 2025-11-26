import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Mail, Phone, CreditCard, Building, Link2, Shield, ExternalLink, Loader2 } from "lucide-react";



interface ProfileData {
  business_name: string;
  business_address: string;
  business_address_line1: string;
  business_address_line2: string;
  business_city: string;
  business_state: string;
  business_postal_code: string;
  business_country: string;
  business_phone: string;
  from_name: string;
  from_email: string;
  reply_to_email: string;
  email_signature: string;
  email_footer: string;
  sendgrid_api_key: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_from_number: string;
  stripe_payment_link_url: string;
  email: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileData>({
    business_name: "",
    business_address: "",
    business_address_line1: "",
    business_address_line2: "",
    business_city: "",
    business_state: "",
    business_postal_code: "",
    business_country: "",
    business_phone: "",
    from_name: "",
    from_email: "",
    reply_to_email: "",
    email_signature: "",
    email_footer: "",
    sendgrid_api_key: "",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_from_number: "",
    stripe_payment_link_url: "",
    email: "",
  });

  useEffect(() => {
    fetchProfile();
    fetchSubscriptionInfo();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // Also fetch branding settings
      const { data: brandingData } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setProfile({
        business_name: data.business_name || "",
        business_address: data.business_address || "",
        business_address_line1: data.business_address_line1 || "",
        business_address_line2: data.business_address_line2 || "",
        business_city: data.business_city || "",
        business_state: data.business_state || "",
        business_postal_code: data.business_postal_code || "",
        business_country: data.business_country || "",
        business_phone: data.business_phone || "",
        from_name: brandingData?.from_name || "",
        from_email: brandingData?.from_email || "",
        reply_to_email: brandingData?.reply_to_email || "",
        email_signature: brandingData?.email_signature || "",
        email_footer: brandingData?.email_footer || "",
        sendgrid_api_key: data.sendgrid_api_key || "",
        twilio_account_sid: data.twilio_account_sid || "",
        twilio_auth_token: data.twilio_auth_token || "",
        twilio_from_number: data.twilio_from_number || "",
        stripe_payment_link_url: data.stripe_payment_link_url || "",
        email: data.email || "",
      });
    } catch (error: any) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          business_name: profile.business_name,
          business_address: profile.business_address,
          business_address_line1: profile.business_address_line1,
          business_address_line2: profile.business_address_line2,
          business_city: profile.business_city,
          business_state: profile.business_state,
          business_postal_code: profile.business_postal_code,
          business_country: profile.business_country,
          business_phone: profile.business_phone,
          sendgrid_api_key: profile.sendgrid_api_key,
          twilio_account_sid: profile.twilio_account_sid,
          twilio_auth_token: profile.twilio_auth_token,
          twilio_from_number: profile.twilio_from_number,
          stripe_payment_link_url: profile.stripe_payment_link_url,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Upsert branding settings
      const { error: brandingError } = await supabase
        .from("branding_settings")
        .upsert({
          user_id: user.id,
          business_name: profile.business_name,
          from_name: profile.from_name,
          from_email: profile.from_email,
          reply_to_email: profile.reply_to_email,
          email_signature: profile.email_signature,
          email_footer: profile.email_footer,
        });

      if (brandingError) throw brandingError;
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!profile.sendgrid_api_key) {
      toast.error("Please configure your SendGrid API key first");
      return;
    }

    setTestingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: { email: profile.email },
      });

      if (error) throw error;
      toast.success("Test email sent successfully! Check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestSMS = async () => {
    if (!profile.twilio_account_sid || !profile.twilio_auth_token || !profile.twilio_from_number) {
      toast.error("Please configure all Twilio settings first");
      return;
    }

    if (!profile.business_phone) {
      toast.error("Please add your business phone number first");
      return;
    }

    setTestingSMS(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-sms", {
        body: { to: profile.business_phone },
      });

      if (error) throw error;
      toast.success("Test SMS sent successfully! Check your phone.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test SMS");
    } finally {
      setTestingSMS(false);
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_type, stripe_subscription_id, plans(*)")
        .eq("id", user.id)
        .single();

      setSubscriptionInfo(profile);
    } catch (error: any) {
      console.error("Failed to load subscription info:", error);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Stripe portal opened in new tab");
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      toast.error(error.message || "Failed to open billing portal");
    } finally {
      setManagingSubscription(false);
    }
  };


  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-4xl font-bold text-primary">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your business profile and integrations
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5 text-primary" />
              <CardTitle>Business Profile</CardTitle>
            </div>
            <CardDescription>
              Update your business information displayed on invoices and messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                value={profile.business_name}
                onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_address_line1">Address Line 1</Label>
              <Input
                id="business_address_line1"
                value={profile.business_address_line1}
                onChange={(e) => setProfile({ ...profile, business_address_line1: e.target.value })}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_address_line2">Address Line 2</Label>
                <Input
                  id="business_address_line2"
                  value={profile.business_address_line2}
                  onChange={(e) => setProfile({ ...profile, business_address_line2: e.target.value })}
                  placeholder="Apt, Suite, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_city">City</Label>
                <Input
                  id="business_city"
                  value={profile.business_city}
                  onChange={(e) => setProfile({ ...profile, business_city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_state">State</Label>
                <Input
                  id="business_state"
                  value={profile.business_state}
                  onChange={(e) => setProfile({ ...profile, business_state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_postal_code">Postal Code</Label>
                <Input
                  id="business_postal_code"
                  value={profile.business_postal_code}
                  onChange={(e) => setProfile({ ...profile, business_postal_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_country">Country</Label>
                <Input
                  id="business_country"
                  value={profile.business_country}
                  onChange={(e) => setProfile({ ...profile, business_country: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_phone">Business Phone</Label>
              <Input
                id="business_phone"
                type="tel"
                value={profile.business_phone}
                onChange={(e) => setProfile({ ...profile, business_phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Branding & White-Label Settings</CardTitle>
            </div>
            <CardDescription>
              Configure how your business appears in all outreach messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                value={profile.from_name}
                onChange={(e) => setProfile({ ...profile, from_name: e.target.value })}
                placeholder="Acme AR Team"
              />
              <p className="text-sm text-muted-foreground">
                This name appears as the sender in emails
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from_email">From Email</Label>
              <Input
                id="from_email"
                type="email"
                value={profile.from_email}
                onChange={(e) => setProfile({ ...profile, from_email: e.target.value })}
                placeholder="collections@acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply_to_email">Reply-To Email</Label>
              <Input
                id="reply_to_email"
                type="email"
                value={profile.reply_to_email}
                onChange={(e) => setProfile({ ...profile, reply_to_email: e.target.value })}
                placeholder="support@acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_signature">Email Signature</Label>
              <Input
                id="email_signature"
                value={profile.email_signature}
                onChange={(e) => setProfile({ ...profile, email_signature: e.target.value })}
                placeholder="Best regards,\nThe Acme Team"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_footer">Email Footer</Label>
              <Input
                id="email_footer"
                value={profile.email_footer}
                onChange={(e) => setProfile({ ...profile, email_footer: e.target.value })}
                placeholder="Acme Inc. | 123 Main St | contact@acme.com"
              />
              <p className="text-sm text-muted-foreground">
                Legal text or company information at the bottom of emails
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Email Sending Domain</CardTitle>
            </div>
            <CardDescription>
              Use your own domain for sending collection emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When you use your own domain, customers see emails from your business (e.g. billing@yourcompany.com), not Recouply.ai. 
              This increases trust and improves payment rates. All AI-generated collection emails will automatically use your verified domain.
            </p>
            <Button onClick={() => navigate('/settings/email-domain')} variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Configure Email Sending Domain
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate("/profile/email")}
        >
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Bring Your Own Email</CardTitle>
            </div>
            <CardDescription>
              Connect your Gmail, Outlook, Yahoo, or any email account to send collections emails
            </CardDescription>
          </CardHeader>
        </Card>

        {subscriptionInfo && subscriptionInfo.stripe_subscription_id && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Subscription Management</CardTitle>
              </div>
              <CardDescription>
                Manage your subscription, payment method, or cancel at end of term
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionInfo.plans && (
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-1">Current Plan</p>
                  <p className="text-lg font-semibold capitalize">{subscriptionInfo.plan_type}</p>
                  {subscriptionInfo.plans.monthly_price && (
                    <p className="text-sm text-muted-foreground">
                      ${subscriptionInfo.plans.monthly_price}/month
                    </p>
                  )}
                </div>
              )}
              <Button
                onClick={handleManageSubscription}
                disabled={managingSubscription}
                variant="outline"
              >
                {managingSubscription ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opening Portal...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                You can update your payment method, view invoices, or cancel your subscription at the end of your billing period through Stripe's secure portal.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email Service (SendGrid) - Legacy</CardTitle>
            </div>
            <CardDescription>
              Configure email delivery for automated messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sendgrid_api_key">SendGrid API Key</Label>
              <Input
                id="sendgrid_api_key"
                type="password"
                value={profile.sendgrid_api_key}
                onChange={(e) => setProfile({ ...profile, sendgrid_api_key: e.target.value })}
                placeholder="SG.xxxxxxxxxxx"
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://app.sendgrid.com/settings/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  SendGrid Dashboard
                </a>
              </p>
            </div>
            <Button onClick={handleTestEmail} disabled={testingEmail || !profile.sendgrid_api_key}>
              {testingEmail ? "Sending..." : "Send Test Email"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle>SMS Setup</CardTitle>
            </div>
            <CardDescription>
              Configure Twilio for SMS reminders to debtors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio_account_sid">Twilio Account SID</Label>
              <Input
                id="twilio_account_sid"
                value={profile.twilio_account_sid}
                onChange={(e) => setProfile({ ...profile, twilio_account_sid: e.target.value })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio_auth_token">Twilio Auth Token</Label>
              <Input
                id="twilio_auth_token"
                type="password"
                value={profile.twilio_auth_token}
                onChange={(e) => setProfile({ ...profile, twilio_auth_token: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio_from_number">Twilio Phone Number</Label>
              <Input
                id="twilio_from_number"
                type="tel"
                value={profile.twilio_from_number}
                onChange={(e) => setProfile({ ...profile, twilio_from_number: e.target.value })}
                placeholder="+15551234567"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Get your credentials from{" "}
              <a
                href="https://console.twilio.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Twilio Console
              </a>
            </p>
            <Button
              onClick={handleTestSMS}
              disabled={
                testingSMS ||
                !profile.twilio_account_sid ||
                !profile.twilio_auth_token ||
                !profile.twilio_from_number
              }
            >
              {testingSMS ? "Sending..." : "Send Test SMS"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Payment Setup</CardTitle>
            </div>
            <CardDescription>
              Configure payment collection method for debtors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stripe_payment_link_url">Stripe Payment Link URL</Label>
              <Input
                id="stripe_payment_link_url"
                type="url"
                value={profile.stripe_payment_link_url}
                onChange={(e) =>
                  setProfile({ ...profile, stripe_payment_link_url: e.target.value })
                }
                placeholder="https://buy.stripe.com/xxxxxxxxxxxxx"
              />
              <p className="text-sm text-muted-foreground">
                This link will be included in payment reminders. Payments go directly to you.
                Create payment links in your{" "}
                <a
                  href="https://dashboard.stripe.com/payment-links"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Stripe Dashboard
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Link2 className="h-5 w-5 text-primary" />
              <CardTitle>CRM Integrations</CardTitle>
            </div>
            <CardDescription>
              Connect your CRM to sync customer data and enrich debtor profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Salesforce CRM</p>
                  <p className="text-sm text-muted-foreground">
                    Sync account data, MRR, and customer health scores
                  </p>
                </div>
              </div>
              <Button variant="outline" disabled>
                Connect (Coming Soon)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              OAuth integration will be available in a future update. This will allow automatic syncing of CRM accounts.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
