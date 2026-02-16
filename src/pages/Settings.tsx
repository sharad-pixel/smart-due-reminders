import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
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
import { Save, CreditCard, Building, Link2, ExternalLink, Loader2, Users, UserPlus, Lock, Crown, Building2, Plug, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { StripeIntegrationCard } from "@/components/StripeIntegrationCard";
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
  receive_daily_digest: boolean;
  receive_product_updates: boolean;
  receive_collection_alerts: boolean;
}

const Settings = () => {
  usePageTitle("Settings");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    stripe_payment_link_url: "",
    email: "",
    receive_daily_digest: true,
    receive_product_updates: true,
    receive_collection_alerts: true,
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
        receive_daily_digest: true,
        receive_product_updates: true,
        receive_collection_alerts: true,
      });
      setLoading(false);
    } else {
      fetchProfile();
    }
    fetchSubscriptionInfo();
  }, [effectiveAccount.loading, isChildAccount]);

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
        receive_daily_digest: data.receive_daily_digest ?? true,
        receive_product_updates: data.receive_product_updates ?? true,
        receive_collection_alerts: data.receive_collection_alerts ?? true,
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
          receive_daily_digest: profile.receive_daily_digest,
          receive_product_updates: profile.receive_product_updates,
          receive_collection_alerts: profile.receive_collection_alerts,
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_country">Country</Label>
              <Input
                id="business_country"
                value={profile.business_country}
                onChange={(e) => setProfile({ ...profile, business_country: e.target.value })}
                placeholder="United States"
                disabled={isChildAccount}
                className={isChildAccount ? "bg-muted cursor-not-allowed" : ""}
              />
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

        {/* Team Management Link - Only for owners */}
        {!isChildAccount && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Team Management</CardTitle>
              </div>
              <CardDescription>
                Invite team members and manage access to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Your Team</p>
                    <p className="text-sm text-muted-foreground">
                      Add team members, set roles, and manage permissions
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate("/team")}>
                  Go to Team
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Additional team members cost {formatPrice(SEAT_PRICING.monthlyPrice)}/month or {formatPrice(SEAT_PRICING.annualPrice)}/year per seat.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Subscription Section */}
        {!isChildAccount && subscriptionInfo && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Subscription</CardTitle>
              </div>
              <CardDescription>
                Manage your subscription and billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium capitalize">{subscriptionInfo.plan_type || 'Free'} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {subscriptionInfo.plans?.name || 'Basic features'}
                  </p>
                </div>
                <Badge variant={subscriptionInfo.stripe_subscription_id ? "default" : "secondary"}>
                  {subscriptionInfo.stripe_subscription_id ? "Active" : "Free Tier"}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={managingSubscription || !subscriptionInfo.stripe_subscription_id}
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

        {/* Email Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Email Preferences</CardTitle>
            </div>
            <CardDescription>
              Choose which emails you'd like to receive from Recouply
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="daily_digest">Daily Collections Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily summary of your AR health, tasks, and portfolio metrics
                </p>
              </div>
              <Switch
                id="daily_digest"
                checked={profile.receive_daily_digest}
                onCheckedChange={(checked) => setProfile({ ...profile, receive_daily_digest: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="collection_alerts">Collection Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about payment activity, risk changes, and urgent collection events
                </p>
              </div>
              <Switch
                id="collection_alerts"
                checked={profile.receive_collection_alerts}
                onCheckedChange={(checked) => setProfile({ ...profile, receive_collection_alerts: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="product_updates">Product Updates & Tips</Label>
                <p className="text-sm text-muted-foreground">
                  Learn about new features, best practices, and collection tips
                </p>
              </div>
              <Switch
                id="product_updates"
                checked={profile.receive_product_updates}
                onCheckedChange={(checked) => setProfile({ ...profile, receive_product_updates: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stripe Integration - API Key Setup */}
        <StripeIntegrationCard />

        {/* Stripe Sync Diagnostics Link */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Plug className="h-5 w-5 text-primary" />
              <CardTitle>Integration Diagnostics</CardTitle>
            </div>
            <CardDescription>
              Troubleshoot sync issues and verify data integrity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Stripe Sync Diagnostics</p>
                  <p className="text-sm text-muted-foreground">
                    Debug sync failures, missing payments, and status mismatches
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate("/integrations/stripe-sync")}>
                Open Diagnostics
              </Button>
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
