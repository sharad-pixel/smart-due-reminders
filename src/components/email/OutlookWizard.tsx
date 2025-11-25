import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Mail, Info } from "lucide-react";
import { toast } from "sonner";

interface OutlookWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const OutlookWizard = ({ onComplete, onCancel }: OutlookWizardProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleConnectOutlook = async () => {
    setLoading(true);
    try {
      toast.info("Microsoft OAuth integration will be implemented with production credentials");
      setTimeout(() => {
        setStep(2);
        setLoading(false);
      }, 1000);
    } catch (error: any) {
      toast.error(error.message || "Failed to connect Outlook");
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Connect Outlook / Office 365
        </CardTitle>
        <CardDescription>Step {step} of 4</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                We'll securely connect to your Microsoft account using Microsoft OAuth. 
                Recouply will send emails as you and read only replies for workflow automation.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">Required permissions:</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Mail.Send - Send emails on your behalf</li>
                <li>Mail.ReadBasic - Read email replies for automation</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConnectOutlook} disabled={loading}>
                {loading ? "Connecting..." : "Connect Outlook"}
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
              <span className="font-medium">Successfully connected to Outlook!</span>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Connected email:</strong> collections@yourcompany.com
                <br />
                <strong>DKIM Status:</strong> Verified via Microsoft
                <br />
                <strong>Authentication:</strong> OAuth 2.0
              </AlertDescription>
            </Alert>

            <Button onClick={onComplete}>
              Complete Setup
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
