import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Info, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  display_name: string;
  is_verified: boolean;
  connection_status: string;
  last_successful_send: string | null;
  is_primary?: boolean;
}

const BringYourOwnEmail = () => {
  const [loading, setLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
  });

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

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert email account configured for Resend
      const { error } = await supabase
        .from("email_accounts")
        .insert({
          user_id: user.id,
          email_address: formData.email,
          display_name: formData.displayName || formData.email.split('@')[0],
          provider: "resend",
          auth_method: "api",
          is_verified: false,
          connection_status: "pending",
        });

      if (error) throw error;

      toast.success("Email account added successfully!");
      setFormData({ email: "", displayName: "" });
      setShowAddForm(false);
      fetchEmailAccounts();
    } catch (error: any) {
      console.error("Error adding email account:", error);
      toast.error(error.message || "Failed to add email account");
    }
  };

  const handleTestConnection = async (accountId: string) => {
    try {
      const account = emailAccounts.find(a => a.id === accountId);
      if (!account) throw new Error("Account not found");

      toast.loading("Sending test email...");

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
      toast.error(error.message || "Failed to send test email");
    }
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
          <h1 className="text-4xl font-bold text-primary">Use Your Email to Send Collections</h1>
          <p className="text-muted-foreground mt-2">
            Add your business email so invoices and reminders come from you — not Recouply.ai
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Powered by Resend:</strong> We use Resend API for reliable email delivery. 
            Your emails will be sent from your domain with high deliverability rates.
          </AlertDescription>
        </Alert>

        {emailAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Connected Email Accounts</CardTitle>
              <CardDescription>Manage your email accounts for sending collections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {emailAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{account.email_address}</p>
                      <p className="text-sm text-muted-foreground">{account.display_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {account.is_verified ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-orange-600">
                            <AlertCircle className="h-3 w-3" />
                            Pending verification
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(account.id)}
                    >
                      Test Connection
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            Add Email Account
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Add Email Account</CardTitle>
              <CardDescription>
                Enter the email address you want to send from. Make sure this email is verified in your Resend account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@yourdomain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This email must be verified in your Resend account
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Your Name or Company"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    How your name will appear in emails
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Add Email Account
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({ email: "", displayName: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Verify Your Domain in Resend</h3>
              <p className="text-sm text-muted-foreground">
                Go to your Resend dashboard and verify the domain you want to send from. 
                This ensures high deliverability rates.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Add Your Email</h3>
              <p className="text-sm text-muted-foreground">
                Add the email address you verified in Resend. You can add multiple email addresses.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Test the Connection</h3>
              <p className="text-sm text-muted-foreground">
                Click "Test Connection" to send a test email and verify everything is working correctly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BringYourOwnEmail;
