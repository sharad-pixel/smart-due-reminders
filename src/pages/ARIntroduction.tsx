import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Mail, Users, CheckCircle2, AlertCircle, Sparkles, Shield, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AREmailPreview from "@/components/ar-introduction/AREmailPreview";

const ARIntroduction = () => {
  usePageTitle("AR Introduction Emails");

  const [customMessage, setCustomMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [sending, setSending] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [debtorCount, setDebtorCount] = useState(0);
  const [alreadySentCount, setAlreadySentCount] = useState(0);
  const [uniqueEmailCount, setUniqueEmailCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch branding
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("business_name, logo_url, primary_color, accent_color")
        .eq("user_id", user.id)
        .single();
      if (branding?.business_name) setBusinessName(branding.business_name);
      if (branding?.logo_url) setLogoUrl(branding.logo_url);
      if (branding?.primary_color) setPrimaryColor(branding.primary_color);
      if (branding?.accent_color) setAccentColor(branding.accent_color);

      // Fetch address from invoice template or profile
      const { data: template } = await supabase
        .from("invoice_templates")
        .select("company_address, company_phone, company_website")
        .eq("user_id", user.id)
        .single();
      if (template?.company_address) setCompanyAddress(template.company_address);
      if (template?.company_phone) setCompanyPhone(template.company_phone);
      if (template?.company_website) setCompanyWebsite(template.company_website);

      // Count total debtors
      const { count: totalDebtors } = await supabase
        .from("debtors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_archived", false);
      setDebtorCount(totalDebtors || 0);

      // Count unique debtor emails with outreach enabled
      const { data: contacts } = await supabase
        .from("debtor_contacts")
        .select("email")
        .eq("outreach_enabled", true);
      const uniqueEmails = new Set((contacts || []).map(c => c.email?.toLowerCase()).filter(Boolean));
      setUniqueEmailCount(uniqueEmails.size);

      // Count already sent
      const { count: sentCount } = await supabase
        .from("ar_introduction_emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setAlreadySentCount(sentCount || 0);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (debtorCount === 0) {
      toast.error("No accounts found. Add accounts first.");
      return;
    }

    if (!replyTo.trim()) {
      toast.error("Reply-to email address is required.");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: debtors } = await supabase
        .from("debtors")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_archived", false);

      if (!debtors?.length) {
        toast.error("No accounts found.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-ar-introduction", {
        body: {
          debtorIds: debtors.map(d => d.id),
          customMessage: customMessage.trim() || undefined,
          businessName: businessName || "Your Company",
          replyTo: replyTo.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data.sent > 0) {
        toast.success(`Introduction sent to ${data.sent} unique email${data.sent > 1 ? "s" : ""}!`);
        setAlreadySentCount(prev => prev + data.sent);
      }
      if (data.skipped > 0) {
        toast.info(`${data.skipped} account${data.skipped > 1 ? "s" : ""} skipped (already sent or duplicate email).`);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} email${data.failed > 1 ? "s" : ""} failed to send.`);
      }
    } catch (err: any) {
      console.error("Error sending AR introduction:", err);
      toast.error("Failed to send introduction emails. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const pendingCount = Math.max(0, debtorCount - alreadySentCount);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              AR Introduction Emails
            </h1>
            <p className="text-muted-foreground mt-1">
              Notify your clients that you're using Recouply.ai for enhanced AR communication
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? "..." : debtorCount}</p>
                  <p className="text-xs text-muted-foreground">Total Accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? "..." : alreadySentCount}</p>
                  <p className="text-xs text-muted-foreground">Already Notified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[hsl(38_92%_50%)]/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-[hsl(38,92%,50%)]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? "..." : pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dedup Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Smart deduplication:</strong> If multiple accounts share the same email address, only one introduction email will be sent per unique email. Different creditors using Recouply.ai can each send their own branded introduction — deduplication is per-creditor.
          </AlertDescription>
        </Alert>

        {/* Compose Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Compose Introduction
            </CardTitle>
            <CardDescription>
              This email introduces Recouply.ai to your clients and includes your branding, logo, and a secure payment portal link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Business Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Business Name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Company Name"
                className="text-sm"
              />
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Personal Message
                <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="e.g., We value our partnership and are committed to providing you with a seamless billing experience..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Reply-To */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                Reply-To Address
                <span className="text-[10px] text-destructive font-normal">*required</span>
              </Label>
              <Input
                type="email"
                placeholder="e.g., ar@yourcompany.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="text-sm"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Where debtor replies will be directed. This is required so clients can reach you directly.
              </p>
            </div>

            {/* Preview info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium text-foreground">Email includes:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">Your Logo</Badge>
                <Badge variant="secondary" className="text-xs">Company Address</Badge>
                <Badge variant="secondary" className="text-xs">Brand Colors</Badge>
                <Badge variant="secondary" className="text-xs">Payment Portal Link</Badge>
                <Badge variant="secondary" className="text-xs">Trust Verification</Badge>
              </div>
            </div>

            {/* Send */}
            <Button
              onClick={handleSend}
              disabled={sending || pendingCount === 0 || !replyTo.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {sending ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Sending Introductions...
                </>
              ) : pendingCount === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  All Accounts Notified
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send to {pendingCount} Account{pendingCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>

            {pendingCount === 0 && debtorCount > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                All existing accounts have been notified. New accounts will receive introductions automatically.
              </p>
            )}
          </CardContent>
        </Card>
        {/* Email Preview */}
        <AREmailPreview
          businessName={businessName}
          customMessage={customMessage}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          accentColor={accentColor}
          companyAddress={companyAddress}
          companyPhone={companyPhone}
          companyWebsite={companyWebsite}
        />
      </div>
    </Layout>
  );
};

export default ARIntroduction;
