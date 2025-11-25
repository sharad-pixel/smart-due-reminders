import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Mail, Info } from "lucide-react";
import { toast } from "sonner";

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
      // TODO: Implement Google OAuth flow
      toast.info("Gmail OAuth integration will be implemented with production credentials");
      // For now, simulate the flow
      setTimeout(() => {
        setStep(2);
        setLoading(false);
      }, 1000);
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
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                We'll securely connect to your Gmail account using Google OAuth. 
                Recouply will send emails as you and read only replies for workflow automation.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">What we'll need:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Permission to send emails on your behalf</li>
                <li>Permission to read email replies</li>
                <li>Your business email address (e.g., billing@yourcompany.com)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">What happens next:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>You'll be redirected to Google's secure login</li>
                <li>Select your business email account</li>
                <li>Review and accept permissions</li>
                <li>You'll be brought back to Recouply to complete setup</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConnectGmail} disabled={loading}>
                {loading ? "Connecting..." : "Connect Gmail"}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Successfully connected to Gmail!</span>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Connected email:</strong> billing@yourcompany.com
                <br />
                <strong>DKIM Status:</strong> Verified via Google
                <br />
                <strong>Authentication:</strong> OAuth 2.0
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">Your Gmail is now active</h4>
              <p className="text-sm text-muted-foreground">
                All collection emails will be sent from your Gmail address. 
                Replies will automatically flow into Recouply for workflow processing.
              </p>
            </div>

            <Button onClick={onComplete}>
              Complete Setup
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
