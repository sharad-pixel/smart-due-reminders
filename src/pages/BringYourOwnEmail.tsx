import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, Info } from "lucide-react";
import { toast } from "sonner";
import { GmailWizard } from "@/components/email/GmailWizard";
import { OutlookWizard } from "@/components/email/OutlookWizard";
import { YahooWizard } from "@/components/email/YahooWizard";
import { ICloudWizard } from "@/components/email/ICloudWizard";
import { CustomSMTPWizard } from "@/components/email/CustomSMTPWizard";
import { EmailHealthDashboard } from "@/components/email/EmailHealthDashboard";
import { ProviderTile } from "@/components/email/ProviderTile";

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  display_name: string;
  is_verified: boolean;
  connection_status: string;
  dkim_status: string;
  spf_status: string;
  last_successful_send: string | null;
  is_primary?: boolean;
}

const BringYourOwnEmail = () => {
  const [loading, setLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailAccounts();
  }, []);

  const fetchEmailAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setEmailAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching email accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
  };

  const handleWizardComplete = () => {
    setSelectedProvider(null);
    fetchEmailAccounts();
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("email_accounts")
        .update({ is_active: false })
        .eq("id", accountId);

      if (error) throw error;

      toast.success("Email account removed successfully");
      fetchEmailAccounts();
    } catch (error: any) {
      console.error("Error removing email account:", error);
      toast.error("Failed to remove email account");
    }
  };

  const handleTestConnection = async (accountId: string) => {
    try {
      const account = emailAccounts.find(a => a.id === accountId);
      if (!account) throw new Error("Account not found");

      toast.loading("Testing email connection...");

      const { data, error } = await supabase.functions.invoke("test-email-account", {
        body: { 
          accountId,
          recipientEmail: account.email_address 
        }
      });

      if (error) throw error;

      toast.success("Test email sent successfully! Check your inbox.");
      fetchEmailAccounts();
    } catch (error: any) {
      console.error("Error testing connection:", error);
      toast.error(error.message || "Failed to test connection");
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Remove primary flag from all accounts
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update({ is_primary: false })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Set the selected account as primary
      const { error: setPrimaryError } = await supabase
        .from("email_accounts")
        .update({ is_primary: true })
        .eq("id", accountId);

      if (setPrimaryError) throw setPrimaryError;

      toast.success("Primary email account updated");
      fetchEmailAccounts();
    } catch (error: any) {
      console.error("Error setting primary account:", error);
      toast.error("Failed to set primary account");
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
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold text-primary">Use Your Email to Send Collections</h1>
          <p className="text-muted-foreground mt-2">
            Connect your business email so invoices and reminders come from you — not Recouply.ai
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Why connect your email?</strong> Using your own email increases deliverability by 2-4x 
            and ensures your customers trust the message is truly from you.
          </AlertDescription>
        </Alert>

        {emailAccounts.length > 0 && (
          <EmailHealthDashboard 
            accounts={emailAccounts} 
            onRefresh={fetchEmailAccounts}
            onDelete={handleDeleteAccount}
            onTest={handleTestConnection}
            onSetPrimary={handleSetPrimary}
          />
        )}

        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">Step-by-Step Setup</TabsTrigger>
            <TabsTrigger value="advanced">Advanced (SMTP / Custom)</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            {!selectedProvider ? (
              <Card>
                <CardHeader>
                  <CardTitle>Choose Your Email Provider</CardTitle>
                  <CardDescription>
                    Select your email provider to begin the setup process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ProviderTile
                      provider="gmail"
                      title="Gmail / Google Workspace"
                      description="Connect using Google OAuth"
                      icon={<Mail className="h-8 w-8" />}
                      recommended
                      onClick={() => handleProviderSelect("gmail")}
                    />
                    <ProviderTile
                      provider="outlook"
                      title="Outlook / Office 365"
                      description="Connect using Microsoft OAuth"
                      icon={<Mail className="h-8 w-8" />}
                      onClick={() => handleProviderSelect("outlook")}
                    />
                    <ProviderTile
                      provider="yahoo"
                      title="Yahoo Mail"
                      description="Connect with App Password"
                      icon={<Mail className="h-8 w-8" />}
                      onClick={() => handleProviderSelect("yahoo")}
                    />
                    <ProviderTile
                      provider="icloud"
                      title="iCloud Mail"
                      description="Connect with App Password"
                      icon={<Mail className="h-8 w-8" />}
                      onClick={() => handleProviderSelect("icloud")}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {selectedProvider === "gmail" && (
                  <GmailWizard onComplete={handleWizardComplete} onCancel={() => setSelectedProvider(null)} />
                )}
                {selectedProvider === "outlook" && (
                  <OutlookWizard onComplete={handleWizardComplete} onCancel={() => setSelectedProvider(null)} />
                )}
                {selectedProvider === "yahoo" && (
                  <YahooWizard onComplete={handleWizardComplete} onCancel={() => setSelectedProvider(null)} />
                )}
                {selectedProvider === "icloud" && (
                  <ICloudWizard onComplete={handleWizardComplete} onCancel={() => setSelectedProvider(null)} />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <CustomSMTPWizard onComplete={handleWizardComplete} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default BringYourOwnEmail;
