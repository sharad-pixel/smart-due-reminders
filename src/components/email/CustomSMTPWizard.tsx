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
  initialEmail?: string;
  detectedConfig?: any;
}

export const CustomSMTPWizard = ({ onComplete, initialEmail = "", detectedConfig }: CustomSMTPWizardProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState("");
  const [smtpHost, setSmtpHost] = useState(detectedConfig?.smtp?.host || "");
  const [smtpPort, setSmtpPort] = useState(detectedConfig?.smtp?.port?.toString() || "587");
  const [smtpUsername, setSmtpUsername] = useState(initialEmail);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [imapHost, setImapHost] = useState(detectedConfig?.imap?.host || "");
  const [imapPort, setImapPort] = useState(detectedConfig?.imap?.port?.toString() || "993");
  const [imapUsername, setImapUsername] = useState(initialEmail);
  const [imapPassword, setImapPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const isGmail = email.includes('@gmail.com') || smtpHost.includes('gmail.com');
  
  // Auto-populate Gmail settings when Gmail is detected
  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    setSmtpUsername(newEmail);
    setImapUsername(newEmail);
    
    if (newEmail.includes('@gmail.com')) {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort('587');
      setImapHost('imap.gmail.com');
      setImapPort('993');
    }
  };

  const handleSaveCredentials = async () => {
    if (!email || !displayName || !smtpHost || !smtpUsername || !smtpPassword) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate Gmail-specific requirements
    if (isGmail) {
      if (!smtpPassword || smtpPassword.replace(/\s/g, '').length !== 16) {
        toast.error("Gmail requires a 16-character App Password (no spaces)");
        return;
      }
      if (smtpHost !== "smtp.gmail.com") {
        toast.error("Gmail SMTP host must be: smtp.gmail.com");
        return;
      }
      if (smtpPort !== "465" && smtpPort !== "587") {
        toast.error("Gmail requires port 465 (SSL) or 587 (TLS)");
        return;
      }
      if (smtpUsername !== email) {
        toast.error("For Gmail, username must be your full email address");
        return;
      }
    }

    // Validate port is secure (SSL/TLS required)
    if (smtpPort === "25") {
      toast.error("Port 25 (unencrypted) is not allowed. Use 465 (SSL) or 587 (TLS)");
      return;
    }

    setLoading(true);
    try {
      // Send credentials to backend for encryption and storage
      const { data, error } = await supabase.functions.invoke('save-email-account', {
        body: {
          email_address: email,
          provider: detectedConfig?.name?.toLowerCase() || "smtp",
          display_name: displayName,
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort),
          smtp_username: smtpUsername,
          smtp_password: smtpPassword,
          imap_host: imapHost || null,
          imap_port: imapPort ? parseInt(imapPort) : null,
          imap_username: imapUsername || null,
          imap_password: imapPassword || null,
        }
      });

      if (error) throw error;

      toast.success("Custom email account connected successfully!");
      onComplete();
    } catch (error: any) {
      console.error("Save error:", error);
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
          {detectedConfig ? (
            <>Auto-detected settings for {detectedConfig.name}. Verify and adjust as needed.</>
          ) : (
            <>Configure any email provider using SMTP and IMAP settings</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isGmail && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Gmail Setup:</strong><br/>
              1. Use <code>smtp.gmail.com</code> as SMTP host<br/>
              2. Port 465 (SSL) or 587 (TLS)<br/>
              3. Username: Your full Gmail address<br/>
              4. Password: Generate a 16-digit App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">myaccount.google.com/apppasswords</a><br/>
              5. Enable 2-factor authentication first (required for App Passwords)
            </AlertDescription>
          </Alert>
        )}

        {!isGmail && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              If you don't know these values, search for "[your provider] SMTP settings" 
              or contact your email hosting provider (GoDaddy, Namecheap, Zoho, etc.)
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="billing@yourcompany.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
            />
            {isGmail && (
              <p className="text-xs text-success">✓ Gmail detected - settings auto-filled</p>
            )}
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
                    <SelectItem value="465">465 (SSL){isGmail ? " - Gmail Compatible" : ""}</SelectItem>
                    <SelectItem value="587">587 (TLS){isGmail ? " - Gmail Recommended" : " - Recommended"}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isGmail ? "Gmail requires port 465 (SSL) or 587 (TLS)" : "Unencrypted connections (port 25) are not allowed"}
                </p>
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
                  placeholder={isGmail ? "16-digit App Password (no spaces)" : "Your email password"}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
                {isGmail && (
                  <p className="text-xs text-muted-foreground">
                    Generate at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline text-primary">myaccount.google.com/apppasswords</a>
                    {smtpPassword && smtpPassword.replace(/\s/g, '').length !== 16 && (
                      <span className="text-destructive ml-2">Must be exactly 16 characters</span>
                    )}
                  </p>
                )}
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
