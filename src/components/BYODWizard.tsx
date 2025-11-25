import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Copy, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface BYODWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export const BYODWizard = ({ open, onOpenChange, onComplete }: BYODWizardProps) => {
  const [step, setStep] = useState(1);
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [domain, setDomain] = useState("");
  const [dnsRecords, setDnsRecords] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const extractDomain = (email: string) => {
    const parts = email.split("@");
    return parts.length === 2 ? parts[1] : "";
  };

  const handleStep1Next = () => {
    if (!senderEmail || !senderName) {
      toast.error("Please fill in all fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const extractedDomain = extractDomain(senderEmail);
    setDomain(extractedDomain);
    generateDNSRecords(extractedDomain);
    setStep(2);
  };

  const generateDNSRecords = (domainName: string) => {
    const records = {
      spf: `v=spf1 include:spf.mtasv.net ~all`,
      dkim: `pm._domainkey.${domainName} CNAME dkim.${domainName}.pm.mtasv.net`,
      returnPath: `${domainName} CNAME pm-bounces.mtasv.net`,
      dmarc: `v=DMARC1; p=none; rua=mailto:postmaster@${domainName}; pct=100`,
    };
    setDnsRecords(records);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleCreateProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("email_sending_profiles")
        .insert({
          user_id: user.id,
          sender_name: senderName,
          sender_email: senderEmail,
          domain: domain,
          use_recouply_domain: false,
          verification_status: "pending",
          spf_record: dnsRecords.spf,
          dkim_record: dnsRecords.dkim,
          return_path_record: dnsRecords.returnPath,
          dmarc_record: dnsRecords.dmarc,
        })
        .select()
        .single();

      if (error) throw error;
      setProfileId(data.id);
      setStep(3);
    } catch (error: any) {
      toast.error(error.message || "Failed to create email profile");
    }
  };

  const handleVerifyDNS = async () => {
    if (!profileId) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-dns-records", {
        body: { profileId },
      });

      if (error) throw error;

      if (data.allVerified) {
        toast.success("Domain verified successfully! Sending test email...");
        await handleSendTestEmail();
      } else {
        const failedRecords = Object.entries(data.results)
          .filter(([_, verified]) => !verified)
          .map(([record]) => record.toUpperCase())
          .join(", ");
        
        toast.error(`DNS verification incomplete. Failed: ${failedRecords}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to verify DNS records");
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      const { error } = await supabase.functions.invoke("send-test-byod-email", {
        body: { profileId, recipientEmail: senderEmail },
      });

      if (error) throw error;
      
      toast.success("Test email sent! Check your inbox.");
      onComplete();
      resetWizard();
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSenderEmail("");
    setSenderName("");
    setDomain("");
    setDnsRecords(null);
    setProfileId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetWizard();
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Bring Your Own Domain - Step {step} of 3
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Sender Email Address</Label>
              <Input
                id="senderEmail"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="billing@mycompany.com"
              />
              <p className="text-sm text-muted-foreground">
                This must be an email address from your own domain
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senderName">Display Name</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="My Company Billing Team"
              />
              <p className="text-sm text-muted-foreground">
                This name will appear as the sender in emails
              </p>
            </div>

            <Button onClick={handleStep1Next} className="w-full">
              Continue to DNS Setup
            </Button>
          </div>
        )}

        {step === 2 && dnsRecords && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Add these DNS records to your domain: <strong>{domain}</strong>
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">SPF Record (TXT)</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(dnsRecords.spf, "SPF record")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="block p-2 bg-muted rounded text-sm break-all">
                    {dnsRecords.spf}
                  </code>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">DKIM Record (CNAME)</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(dnsRecords.dkim, "DKIM record")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="block p-2 bg-muted rounded text-sm break-all">
                    {dnsRecords.dkim}
                  </code>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Return-Path (CNAME)</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(dnsRecords.returnPath, "Return-Path record")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="block p-2 bg-muted rounded text-sm break-all">
                    {dnsRecords.returnPath}
                  </code>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">DMARC Record (TXT) - Optional but Recommended</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(dnsRecords.dmarc, "DMARC record")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="block p-2 bg-muted rounded text-sm break-all">
                    {dnsRecords.dmarc}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                DNS changes can take up to 48 hours to propagate, but usually complete within minutes.
                After adding these records to your DNS provider, click Continue to verify.
              </AlertDescription>
            </Alert>

            <Button onClick={handleCreateProfile} className="w-full">
              Continue to Verification
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                DNS records generated! Click the button below to verify your domain configuration.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>What happens next?</Label>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• We'll check that your DNS records are properly configured</li>
                <li>• Verify SPF, DKIM, DMARC, and Return-Path alignment</li>
                <li>• Send a test email to confirm delivery</li>
                <li>• Activate your domain for collections email sending</li>
              </ul>
            </div>

            <Button
              onClick={handleVerifyDNS}
              disabled={verifying}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying DNS Records...
                </>
              ) : (
                "Verify Domain & Send Test Email"
              )}
            </Button>

            <Button
              onClick={() => setStep(2)}
              variant="outline"
              className="w-full"
            >
              Back to DNS Records
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
