import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface YahooWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const YahooWizard = ({ onComplete, onCancel }: YahooWizardProps) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSaveCredentials = async () => {
    if (!email || !appPassword || !displayName) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // TODO: Implement encryption for app password
      const { error } = await supabase.from("email_accounts").insert({
        user_id: user.id,
        email_address: email,
        provider: "yahoo",
        display_name: displayName,
        auth_method: "app_password",
        smtp_host: "smtp.mail.yahoo.com",
        smtp_port: 465,
        smtp_username: email,
        smtp_password_encrypted: appPassword, // Should be encrypted
        smtp_use_tls: true,
        connection_status: "pending",
      });

      if (error) throw error;

      toast.success("Yahoo Mail account connected successfully!");
      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Failed to save Yahoo credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Yahoo Mail</CardTitle>
        <CardDescription>Step {step} of 5</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Yahoo Mail requires an App Password for third-party access. 
                Follow these steps to generate one.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                  1
                </div>
                <span className="text-sm">Log in to your Yahoo Mail account</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                  2
                </div>
                <span className="text-sm">Go to Account Security settings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                  3
                </div>
                <span className="text-sm">Enable 2-step Verification if not already enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                  4
                </div>
                <span className="text-sm">Generate an App Password and label it "Recouply.ai"</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => window.open("https://login.yahoo.com/account/security", "_blank")}
            >
              Open Yahoo Account Security
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>

            <div className="flex gap-2">
              <Button onClick={() => setStep(2)}>
                I have my App Password
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Yahoo Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="yourname@yahoo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your Company Collections"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appPassword">App Password</Label>
              <Input
                id="appPassword"
                type="password"
                placeholder="Enter your Yahoo App Password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This is the 16-character password you generated in Yahoo Account Security
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>SMTP Settings:</strong>
                <br />
                Server: smtp.mail.yahoo.com
                <br />
                Port: 465 (SSL)
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={handleSaveCredentials} disabled={loading}>
                {loading ? "Connecting..." : "Connect Yahoo Mail"}
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
