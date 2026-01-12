import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Mail, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Send,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SenderIdentitySectionProps {
  formData: {
    sending_mode?: string | null;
    from_name?: string | null;
    from_email?: string | null;
    reply_to_email?: string | null;
    from_email_verified?: boolean | null;
    from_email_verification_status?: string | null;
    verified_from_email?: string | null;
    last_test_email_sent_at?: string | null;
    business_name?: string | null;
  };
  onChange: (field: string, value: any) => void;
}

export function SenderIdentitySection({ formData, onChange }: SenderIdentitySectionProps) {
  const [isSendingTest, setIsSendingTest] = useState(false);

  const sendingMode = formData.sending_mode || 'recouply_default';
  const isCustomerDomain = sendingMode === 'customer_domain';
  const isVerified = formData.from_email_verified === true;
  const verificationStatus = formData.from_email_verification_status || 'unverified';

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to send a test email");
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-branding-test-email', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(`Test email sent to ${session.user.email}`);
      
      // Update last sent timestamp
      if (data?.message) {
        onChange('last_test_email_sent_at', new Date().toISOString());
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  const getVerificationBadge = () => {
    if (!isCustomerDomain) return null;

    switch (verificationStatus) {
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending Verification
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Verification Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Unverified
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Sender Identity
        </CardTitle>
        <CardDescription>
          Configure how emails are sent on behalf of your business
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sending Mode Selection */}
        <div className="space-y-2">
          <Label htmlFor="sending_mode">Sending Mode</Label>
          <Select
            value={sendingMode}
            onValueChange={(value) => onChange('sending_mode', value)}
          >
            <SelectTrigger id="sending_mode">
              <SelectValue placeholder="Select sending mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recouply_default">
                <div className="flex flex-col items-start">
                  <span>Send as Recouply.ai</span>
                  <span className="text-xs text-muted-foreground">Recommended - Always reliable</span>
                </div>
              </SelectItem>
              <SelectItem value="customer_domain">
                <div className="flex flex-col items-start">
                  <span>Send from my domain</span>
                  <span className="text-xs text-muted-foreground">Requires domain verification</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Customer Domain Warning */}
        {isCustomerDomain && !isVerified && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Your domain is not yet verified. Emails will be sent from Recouply.ai until verification is complete.
              Contact support@recouply.ai to verify your domain.
            </AlertDescription>
          </Alert>
        )}

        {/* From Name */}
        <div className="space-y-2">
          <Label htmlFor="from_name">From Name</Label>
          <Input
            id="from_name"
            value={formData.from_name || ""}
            onChange={(e) => onChange("from_name", e.target.value)}
            placeholder={formData.business_name || "Your Company Name"}
          />
          <p className="text-xs text-muted-foreground">
            This name appears as the sender in email clients
          </p>
        </div>

        {/* Customer Domain Fields */}
        {isCustomerDomain && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="from_email">From Email</Label>
                {getVerificationBadge()}
              </div>
              <Input
                id="from_email"
                type="email"
                value={formData.from_email || ""}
                onChange={(e) => onChange("from_email", e.target.value)}
                placeholder="ar@yourcompany.com"
              />
              <p className="text-xs text-muted-foreground">
                The email address emails will be sent from (requires domain verification)
              </p>
            </div>
          </>
        )}

        {/* Test Email Button */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Send Test Email</p>
              <p className="text-xs text-muted-foreground">
                Send a preview email to yourself to see how it looks
              </p>
              {formData.last_test_email_sent_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last sent: {new Date(formData.last_test_email_sent_at).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
