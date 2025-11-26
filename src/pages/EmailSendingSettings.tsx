import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Mail, Shield, CheckCircle2, AlertCircle, Info, Send } from "lucide-react";
import { BYODWizard } from "@/components/BYODWizard";
import { DeliverabilityStatus } from "@/components/DeliverabilityStatus";
import { logAuditEvent } from "@/lib/auditLog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailProfile {
  id: string;
  sender_name: string;
  sender_email: string;
  domain: string;
  spf_validated: boolean;
  dkim_validated: boolean;
  dmarc_validated: boolean;
  verification_status: string;
  use_recouply_domain: boolean;
  bounce_rate: number;
  spam_complaint_rate: number;
  domain_reputation: string;
  spf_record: string;
  dkim_record: string;
  return_path_record: string;
  dmarc_record: string;
  is_active: boolean;
}

const EmailSendingSettings = () => {
  const [loading, setLoading] = useState(true);
  const [emailProfile, setEmailProfile] = useState<EmailProfile | null>(null);
  const [showBYODWizard, setShowBYODWizard] = useState(false);
  const [useRecouplyDomain, setUseRecouplyDomain] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  useEffect(() => {
    fetchEmailProfile();
  }, []);

  const fetchEmailProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("email_sending_profiles")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setEmailProfile(data);
        setUseRecouplyDomain(data.use_recouply_domain);
      }
    } catch (error: any) {
      console.error("Error fetching email profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseRecouplyDomain = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if profile exists
      if (emailProfile) {
        // Update existing profile
        const { error } = await supabase
          .from("email_sending_profiles")
          .update({ use_recouply_domain: true })
          .eq("id", emailProfile.id);

        if (error) throw error;

        await logAuditEvent({
          action: "update",
          resourceType: "email_domain",
          resourceId: emailProfile.id,
          oldValues: { use_recouply_domain: false },
          newValues: { use_recouply_domain: true },
        });
      } else {
        // Create new profile using Recouply domain
        const { data, error } = await supabase
          .from("email_sending_profiles")
          .insert({
            user_id: user.id,
            sender_name: "Recouply Collections",
            sender_email: `workspace-${user.id.substring(0, 8)}@send.recouply.ai`,
            domain: "send.recouply.ai",
            use_recouply_domain: true,
            verification_status: "verified",
            spf_validated: true,
            dkim_validated: true,
            dmarc_validated: true,
          })
          .select()
          .single();

        if (error) throw error;

        await logAuditEvent({
          action: "create",
          resourceType: "email_domain",
          resourceId: data.id,
          newValues: { use_recouply_domain: true, domain: "send.recouply.ai" },
        });
      }

      toast.success("Now using Recouply.ai shared sending domain");
      fetchEmailProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to configure Recouply domain");
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !emailProfile) return;

    setSendingTestEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-test-byod-email", {
        body: { 
          profileId: emailProfile.id, 
          recipientEmail: testEmailAddress 
        },
      });

      if (error) throw error;
      
      toast.success(`Test email sent to ${testEmailAddress}! Check your inbox.`);
      setTestEmailAddress("");

      await logAuditEvent({
        action: "send_email",
        resourceType: "email_domain",
        resourceId: emailProfile.id,
        metadata: { test_email: true, recipient: testEmailAddress },
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSendingTestEmail(false);
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
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold text-primary">Email Sending Domain</h1>
          <p className="text-muted-foreground mt-2">
            Use your own domain so collections emails come from your business, not Recouply.ai
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            When you use your own domain, customers see emails from your business (e.g. billing@yourcompany.com), not Recouply.ai. 
            This <strong>increases trust and improves payment rates</strong>. All collections emails from our AI agents will automatically use your verified domain.
          </AlertDescription>
        </Alert>

        {emailProfile ? (
          <>
            <DeliverabilityStatus profile={emailProfile} onRefresh={fetchEmailProfile} />
            
            <Card>
              <CardHeader>
                <CardTitle>Current Configuration</CardTitle>
                <CardDescription>
                  {emailProfile.use_recouply_domain
                    ? "You are currently using the Recouply.ai shared sending domain"
                    : "You are using your own business domain"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">{emailProfile.sender_name}</div>
                    <div className="text-sm text-muted-foreground">{emailProfile.sender_email}</div>
                    <div className="text-xs text-muted-foreground mt-1">Domain: {emailProfile.domain}</div>
                  </div>
                  {emailProfile.verification_status === "verified" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>

                {emailProfile.use_recouply_domain ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You are currently using Recouply.ai's default sending domain. For best deliverability and trust, we recommend verifying your own domain.
                    </AlertDescription>
                  </Alert>
                ) : emailProfile.verification_status !== "verified" ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your domain is not yet verified. Complete DNS setup to start sending from your domain.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowBYODWizard(true)}
                    variant={emailProfile.use_recouply_domain ? "default" : "outline"}
                  >
                    {emailProfile.use_recouply_domain ? "Switch to My Domain" : "Update Domain Settings"}
                  </Button>
                  {!emailProfile.use_recouply_domain && (
                    <Button onClick={handleUseRecouplyDomain} variant="outline">
                      Switch to Recouply Domain
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {emailProfile.verification_status === "verified" && (
              <Card>
                <CardHeader>
                  <CardTitle>Test Email</CardTitle>
                  <CardDescription>
                    Send a test email to verify your domain configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="testEmail">Test Recipient Email</Label>
                    <Input
                      id="testEmail"
                      type="email"
                      placeholder="your@email.com"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={!testEmailAddress || sendingTestEmail}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingTestEmail ? "Sending..." : "Send Test Email"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Option 1 — Use My Own Domain (Recommended)</CardTitle>
                </div>
                <CardDescription>
                  Send emails from your own domain for higher open rates, more trust, and better compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-4">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                    <span>Higher deliverability and inbox placement</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                    <span>Build trust with your customers</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                    <span>Full brand control and white-labeling</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                    <span>Better compliance with email regulations</span>
                  </li>
                </ul>
                <Button onClick={() => setShowBYODWizard(true)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect My Business Domain
                </Button>
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle>Option 2 — Use Recouply.ai Default Domain</CardTitle>
                <CardDescription>
                  Quick start option - send immediately without DNS configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This option uses Recouply.ai's shared sending infrastructure.
                    While easier to set up, it may result in lower open rates and reduced customer trust
                    compared to using your own domain.
                  </AlertDescription>
                </Alert>
                <Button onClick={handleUseRecouplyDomain} variant="outline">
                  Use Default Recouply.ai Sending
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <BYODWizard
          open={showBYODWizard}
          onOpenChange={setShowBYODWizard}
          onComplete={() => {
            setShowBYODWizard(false);
            fetchEmailProfile();
          }}
        />
      </div>
    </Layout>
  );
};

export default EmailSendingSettings;
