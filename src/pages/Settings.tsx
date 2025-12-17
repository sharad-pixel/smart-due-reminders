import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Save, Mail, Phone, CreditCard, Building, Link2, ExternalLink, Loader2, Users, UserPlus, Lock, Crown, Building2 } from "lucide-react";
import { SEAT_PRICING, formatPrice } from "@/lib/subscriptionConfig";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

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
  stripe_payment_link_url: string;
  email: string;
}

interface CredentialsStatus {
  sendgrid_configured: boolean;
  twilio_configured: boolean;
  twilio_from_number: string | null;
}

interface CredentialsInput {
  sendgrid_api_key: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_from_number: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [credentialsStatus, setCredentialsStatus] = useState<CredentialsStatus>({
    sendgrid_configured: false,
    twilio_configured: false,
    twilio_from_number: null,
  });
  const [credentials, setCredentials] = useState<CredentialsInput>({
    sendgrid_api_key: "",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_from_number: "",
  });
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
    stripe_payment_link_url: "",
    email: "",
  });

  // Get effective account info to determine if child account
  const effectiveAccount = useEffectiveAccount();
  const isChildAccount = effectiveAccount.isTeamMember;

  useEffect(() => {
    // Wait for effective account to load
    if (effectiveAccount.loading) return;
    
    if (isChildAccount) {
      // For child accounts, populate with parent's business profile
      setProfile({
        business_name: effectiveAccount.ownerBusinessName || "",
        business_address: "",
        business_address_line1: effectiveAccount.ownerBusinessAddressLine1 || "",
        business_address_line2: effectiveAccount.ownerBusinessAddressLine2 || "",
        business_city: effectiveAccount.ownerBusinessCity || "",
        business_state: effectiveAccount.ownerBusinessState || "",
        business_postal_code: effectiveAccount.ownerBusinessPostalCode || "",
        business_country: effectiveAccount.ownerBusinessCountry || "",
        business_phone: effectiveAccount.ownerBusinessPhone || "",
        stripe_payment_link_url: effectiveAccount.ownerStripePaymentLinkUrl || "",
        email: effectiveAccount.ownerEmail || "",
      });
      setLoading(false);
    } else {
      fetchProfile();
    }
    fetchSubscriptionInfo();
    fetchCredentialsStatus();
  }, [effectiveAccount.loading, isChildAccount]);

  const fetchCredentialsStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-credentials-status");
      if (error) throw error;
      setCredentialsStatus(data);
      if (data.twilio_from_number) {
        setCredentials(prev => ({ ...prev, twilio_from_number: data.twilio_from_number }));
      }
    } catch (error: any) {
      console.error("Failed to fetch credentials status:", error);
    }
  };

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
          stripe_payment_link_url: profile.stripe_payment_link_url,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!credentialsStatus.sendgrid_configured) {
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
    if (!credentialsStatus.twilio_configured || !credentials.twilio_from_number) {
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

  const handleSaveCredentials = async () => {
    setSavingCredentials(true);
    try {
      // Only send credentials that have been entered (not empty)
      const credentialsToSave: Record<string, string | undefined> = {};
      
      if (credentials.sendgrid_api_key) {
        credentialsToSave.sendgrid_api_key = credentials.sendgrid_api_key;
      }
      if (credentials.twilio_account_sid) {
        credentialsToSave.twilio_account_sid = credentials.twilio_account_sid;
      }
      if (credentials.twilio_auth_token) {
        credentialsToSave.twilio_auth_token = credentials.twilio_auth_token;
      }
      if (credentials.twilio_from_number) {
        credentialsToSave.twilio_from_number = credentials.twilio_from_number;
      }

      const { error } = await supabase.functions.invoke("save-credentials", {
        body: credentialsToSave,
      });

      if (error) throw error;

      // Refresh credentials status
      await fetchCredentialsStatus();
      
      // Clear the input fields after save
      setCredentials({
        sendgrid_api_key: "",
        twilio_account_sid: "",
        twilio_auth_token: "",
        twilio_from_number: credentials.twilio_from_number, // Keep phone number visible
      });

      toast.success("API credentials saved securely");
    } catch (error: any) {
      toast.error(error.message || "Failed to save credentials");
    } finally {
      setSavingCredentials(false);
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


  if (loading || effectiveAccount.loading) {
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

        {/* Parent Account Banner for Child Accounts */}
        {isChildAccount && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0">
                  <Crown className="h-3 w-3 mr-1" />
                  Parent Account
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={effectiveAccount.ownerAvatarUrl || undefined} alt={effectiveAccount.ownerName || 'Account Owner'} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {(effectiveAccount.ownerName || effectiveAccount.ownerEmail || 'O')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{effectiveAccount.ownerName || 'Account Owner'}</p>
                  {effectiveAccount.ownerCompanyName && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {effectiveAccount.ownerCompanyName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {effectiveAccount.ownerPlanType || 'free'} Plan
                    </Badge>
                    {effectiveAccount.ownerSubscriptionStatus === 'active' && (
                      <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                    )}
                  </div>
                </div>
              </div>
              <Alert className="mt-4 bg-amber-50 border-amber-200">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-sm">
                  Business profile settings are managed by the parent account owner. Contact them to make changes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle>Business Profile</CardTitle>
              </div>
              {isChildAccount && (
                <Badge variant="secondary" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Read Only
                </Badge>
              )}
            </div>
            <CardDescription>
              {isChildAccount 
                ? "Business information inherited from parent account"
                : "Update your business information displayed on invoices and messages"
              }
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
                disabled={isChildAccount}
                className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_address_line1">Address Line 1</Label>
              <Input
                id="business_address_line1"
                value={profile.business_address_line1}
                onChange={(e) => setProfile({ ...profile, business_address_line1: e.target.value })}
                placeholder="Street address"
                disabled={isChildAccount}
                className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
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
                  disabled={isChildAccount}
                  className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_city">City</Label>
                <Input
                  id="business_city"
                  value={profile.business_city}
                  onChange={(e) => setProfile({ ...profile, business_city: e.target.value })}
                  disabled={isChildAccount}
                  className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_state">State</Label>
                <Input
                  id="business_state"
                  value={profile.business_state}
                  onChange={(e) => setProfile({ ...profile, business_state: e.target.value })}
                  disabled={isChildAccount}
                  className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_postal_code">Postal Code</Label>
                <Input
                  id="business_postal_code"
                  value={profile.business_postal_code}
                  onChange={(e) => setProfile({ ...profile, business_postal_code: e.target.value })}
                  disabled={isChildAccount}
                  className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_country">Country</Label>
                <Input
                  id="business_country"
                  value={profile.business_country}
                  onChange={(e) => setProfile({ ...profile, business_country: e.target.value })}
                  disabled={isChildAccount}
                  className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
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
                disabled={isChildAccount}
                className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
              />
            </div>
          </CardContent>
        </Card>


        {!isChildAccount && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Team Members</CardTitle>
              </div>
              <CardDescription>
                Manage your team and purchase additional user seats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add team members to collaborate on collections. Each additional active user is billed at {formatPrice(SEAT_PRICING.monthlyPrice)} per month.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate("/team?invite=true")} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Team Members
                </Button>
                <Button variant="outline" onClick={() => navigate("/billing")} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Manage Billing
                </Button>
              </div>
            </CardContent>
          </Card>
        )}



        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email Infrastructure</CardTitle>
            </div>
            <CardDescription>
              Recouply.ai sends and receives emails through its own secure infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  ✓ Platform Email Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                All collection emails are sent from our verified Recouply.ai address with SPF, DKIM, and DMARC authentication. 
                No email setup required - start sending immediately.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/settings/email-accounts")}>
                <Mail className="h-4 w-4 mr-2" />
                View Email Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {!isChildAccount && subscriptionInfo && subscriptionInfo.stripe_subscription_id && (
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
            {credentialsStatus.sendgrid_configured && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓ SendGrid API key configured
              </Badge>
            )}
            <div className="space-y-2">
              <Label htmlFor="sendgrid_api_key">
                {credentialsStatus.sendgrid_configured ? "Update SendGrid API Key" : "SendGrid API Key"}
              </Label>
              <Input
                id="sendgrid_api_key"
                type="password"
                value={credentials.sendgrid_api_key}
                onChange={(e) => setCredentials({ ...credentials, sendgrid_api_key: e.target.value })}
                placeholder={credentialsStatus.sendgrid_configured ? "••••••••••••••••" : "SG.xxxxxxxxxxx"}
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
            <div className="flex gap-2">
              {credentials.sendgrid_api_key && (
                <Button onClick={handleSaveCredentials} disabled={savingCredentials}>
                  {savingCredentials ? "Saving..." : "Save SendGrid Key"}
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleTestEmail} 
                disabled={testingEmail || !credentialsStatus.sendgrid_configured}
              >
                {testingEmail ? "Sending..." : "Send Test Email"}
              </Button>
            </div>
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
            {credentialsStatus.twilio_configured && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓ Twilio credentials configured
              </Badge>
            )}
            <div className="space-y-2">
              <Label htmlFor="twilio_account_sid">
                {credentialsStatus.twilio_configured ? "Update Twilio Account SID" : "Twilio Account SID"}
              </Label>
              <Input
                id="twilio_account_sid"
                type="password"
                value={credentials.twilio_account_sid}
                onChange={(e) => setCredentials({ ...credentials, twilio_account_sid: e.target.value })}
                placeholder={credentialsStatus.twilio_configured ? "••••••••••••••••" : "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio_auth_token">
                {credentialsStatus.twilio_configured ? "Update Twilio Auth Token" : "Twilio Auth Token"}
              </Label>
              <Input
                id="twilio_auth_token"
                type="password"
                value={credentials.twilio_auth_token}
                onChange={(e) => setCredentials({ ...credentials, twilio_auth_token: e.target.value })}
                placeholder={credentialsStatus.twilio_configured ? "••••••••••••••••" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio_from_number">Twilio Phone Number</Label>
              <Input
                id="twilio_from_number"
                type="tel"
                value={credentials.twilio_from_number}
                onChange={(e) => setCredentials({ ...credentials, twilio_from_number: e.target.value })}
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
            <div className="flex gap-2">
              {(credentials.twilio_account_sid || credentials.twilio_auth_token || credentials.twilio_from_number) && (
                <Button onClick={handleSaveCredentials} disabled={savingCredentials}>
                  {savingCredentials ? "Saving..." : "Save Twilio Settings"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleTestSMS}
                disabled={
                  testingSMS ||
                  !credentialsStatus.twilio_configured ||
                  !credentials.twilio_from_number
                }
              >
                {testingSMS ? "Sending..." : "Send Test SMS"}
              </Button>
            </div>
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

        {!isChildAccount && (
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Settings;
