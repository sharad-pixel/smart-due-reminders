import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Mail, Info, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GmailWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const GmailWizard = ({ onComplete, onCancel }: GmailWizardProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleConnectGmail = async () => {
    setLoading(true);
    try {
      toast.error("Gmail OAuth requires Google Cloud credentials to be configured. Please use Custom SMTP with an App Password instead, or contact support for OAuth setup assistance.");
      setLoading(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to connect Gmail");
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Connect Gmail / Google Workspace
        </CardTitle>
        <CardDescription>Step {step} of 4</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Gmail OAuth Setup Required</strong>
                <br />
                Gmail OAuth requires Google Cloud project credentials and API configuration. 
                This feature is not yet configured for your account.
              </AlertDescription>
            </Alert>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Recommended Alternative: Use Custom SMTP with App Password</strong>
                <br />
                For immediate Gmail integration, we recommend using the Custom SMTP option with a Gmail App Password. 
                This is faster to set up and works reliably.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">To use Gmail with Custom SMTP:</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Go to your Google Account settings</li>
                <li>Enable 2-Step Verification if not already enabled</li>
                <li>Generate an App Password for "Mail"</li>
                <li>Use the Custom SMTP option with these settings:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>SMTP Host: smtp.gmail.com</li>
                    <li>SMTP Port: 587</li>
                    <li>Use your Gmail address and App Password</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Need OAuth instead?</h4>
              <p className="text-sm text-muted-foreground mb-2">
                OAuth setup requires Google Cloud configuration. Contact support for assistance with:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Creating a Google Cloud project</li>
                <li>Enabling Gmail API</li>
                <li>Configuring OAuth 2.0 credentials</li>
                <li>Setting up redirect URLs</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Back to Email Setup
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Gmail OAuth requires additional setup</span>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Please use the Custom SMTP option with a Gmail App Password for immediate integration,
                or contact support for help setting up OAuth.
              </AlertDescription>
            </Alert>

            <Button onClick={onCancel}>
              Back to Email Setup
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
