import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomSMTPWizardProps {
  onComplete: () => void;
}

export const CustomSMTPWizard = ({ onComplete }: CustomSMTPWizardProps) => {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSaveCredentials = async () => {
    if (!email || !displayName || !smtpHost || !smtpUsername || !smtpPassword) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Encrypt SMTP password
      const { data: encryptedSmtpData, error: encryptSmtpError } = await supabase.functions.invoke(
        "encrypt-field",
        { body: { value: smtpPassword } }
      );

      if (encryptSmtpError || !encryptedSmtpData?.encrypted) {
        throw new Error("Failed to encrypt SMTP password");
      }

      // Encrypt IMAP password if provided
      let encryptedImapPassword = null;
      if (imapPassword) {
        const { data: encryptedImapData, error: encryptImapError } = await supabase.functions.invoke(
          "encrypt-field",
          { body: { value: imapPassword } }
        );

        if (encryptImapError || !encryptedImapData?.encrypted) {
          throw new Error("Failed to encrypt IMAP password");
        }
        encryptedImapPassword = encryptedImapData.encrypted;
      }

      const { error } = await supabase.from("email_accounts").insert({
        user_id: session.user.id,
        email_address: email,
        provider: "smtp",
        display_name: displayName,
        auth_method: "smtp",
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort),
        smtp_username: smtpUsername,
        smtp_password_encrypted: encryptedSmtpData.encrypted,
        smtp_use_tls: true,
        imap_host: imapHost || null,
        imap_port: imapPort ? parseInt(imapPort) : null,
        imap_username: imapUsername || null,
        imap_password_encrypted: encryptedImapPassword,
        connection_status: "pending",
      });

      if (error) throw error;

      toast.success("Custom email account connected successfully!");
      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Failed to save email credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Custom Email Provider (SMTP/IMAP)</CardTitle>
        <CardDescription>
          Configure any email provider using SMTP and IMAP settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            If you don't know these values, search for "[your provider] SMTP settings" 
            or contact your email hosting provider (GoDaddy, Namecheap, Zoho, etc.)
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="billing@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              placeholder="Your Company Collections"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">SMTP Settings (Outgoing Mail)</h4>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP Host *</Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.yourprovider.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPort">SMTP Port *</Label>
                <Select value={smtpPort} onValueChange={setSmtpPort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 (Unencrypted)</SelectItem>
                    <SelectItem value="465">465 (SSL)</SelectItem>
                    <SelectItem value="587">587 (TLS) - Recommended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUsername">SMTP Username *</Label>
                <Input
                  id="smtpUsername"
                  placeholder="Usually your email address"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPassword">SMTP Password *</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  placeholder="Your email password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">IMAP Settings (Incoming Mail - Optional)</h4>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imapHost">IMAP Host</Label>
                <Input
                  id="imapHost"
                  placeholder="imap.yourprovider.com"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imapPort">IMAP Port</Label>
                <Select value={imapPort} onValueChange={setImapPort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="143">143 (Unencrypted)</SelectItem>
                    <SelectItem value="993">993 (SSL) - Recommended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imapUsername">IMAP Username</Label>
                <Input
                  id="imapUsername"
                  placeholder="Usually your email address"
                  value={imapUsername}
                  onChange={(e) => setImapUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imapPassword">IMAP Password</Label>
                <Input
                  id="imapPassword"
                  type="password"
                  placeholder="Your email password"
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSaveCredentials} disabled={loading} className="w-full">
            {loading ? "Connecting..." : "Connect Email Account"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
