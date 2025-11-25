import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Mail, Shield, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { BYODWizard } from "@/components/BYODWizard";
import { DeliverabilityStatus } from "@/components/DeliverabilityStatus";

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
      } else {
        // Create new profile using Recouply domain
        const { error } = await supabase
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
          });

        if (error) throw error;
      }

      toast.success("Now using Recouply.ai shared sending domain");
      fetchEmailProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to configure Recouply domain");
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
          <h1 className="text-4xl font-bold text-primary">Email Sending Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure how Recouply.ai sends collection emails on your behalf
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Recouply.ai sends emails on your behalf to help recover outstanding invoices.
            You can choose to send using <strong>your own business domain</strong> for maximum trust and deliverability,
            or you can use the Recouply.ai shared domain if you're not ready to configure DNS.
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
                  </div>
                  {emailProfile.verification_status === "verified" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>

                {emailProfile.use_recouply_domain && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Using the Recouply.ai domain may reduce open rates and deliverability.
                      For the best results, consider connecting your own domain.
                    </AlertDescription>
                  </Alert>
                )}

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
