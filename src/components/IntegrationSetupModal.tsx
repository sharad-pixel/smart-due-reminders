import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  Users,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
} from "lucide-react";
import stripeLogo from "@/assets/stripe-logo.png";
import quickbooksLogo from "@/assets/quickbooks-logo.png";

interface IntegrationSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationType: "stripe" | "quickbooks" | null;
  onComplete?: () => void;
}

export const IntegrationSetupModal = ({
  open,
  onOpenChange,
  integrationType,
  onComplete,
}: IntegrationSetupModalProps) => {
  const navigate = useNavigate();
  const [stripeKey, setStripeKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleStripeConnect = async () => {
    if (!stripeKey.trim()) {
      toast.error("Please enter your Stripe Secret Key");
      return;
    }

    if (!stripeKey.startsWith("sk_")) {
      toast.error("Invalid Stripe key format. It should start with 'sk_'");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("save-stripe-credentials", {
        body: { secret_key: stripeKey },
      });

      if (error) throw error;

      toast.success("Stripe connected successfully!");
      setStripeKey("");
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      console.error("Stripe connection error:", error);
      toast.error(error.message || "Failed to connect Stripe");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickBooksConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-oauth-start");

      if (error) throw error;
      if (!data?.authUrl) throw new Error("No auth URL returned");

      window.location.href = data.authUrl;
    } catch (error: any) {
      toast.error(error.message || "Could not start QuickBooks connection");
      setConnecting(false);
    }
  };

  const handleClose = () => {
    setStripeKey("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {integrationType === "stripe" && (
              <>
                <img src={stripeLogo} alt="Stripe" className="h-6 w-6 object-contain" />
                Connect Stripe
              </>
            )}
            {integrationType === "quickbooks" && (
              <>
                <img src={quickbooksLogo} alt="QuickBooks" className="h-6 w-6 rounded-full object-cover" />
                Connect QuickBooks
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {integrationType === "stripe"
              ? "Connect your Stripe account to automatically sync invoices and payments."
              : "Connect your QuickBooks Online account to import customers, invoices, and payments."}
          </DialogDescription>
        </DialogHeader>

        {integrationType === "stripe" && (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your API key is encrypted and stored securely. We use it only to sync invoice and payment data.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="stripe-key">Stripe Secret Key</Label>
              <Input
                id="stripe-key"
                type="password"
                placeholder="sk_live_..."
                value={stripeKey}
                onChange={(e) => setStripeKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Find your key at{" "}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Stripe Dashboard → API Keys
                  <ExternalLink className="h-3 w-3 inline ml-1" />
                </a>
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">What gets synced:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  All invoices from Stripe
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Payment status and transactions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Customer information
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Credits and refunds
                </li>
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleStripeConnect} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect Stripe
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {integrationType === "quickbooks" && (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                You'll be redirected to QuickBooks to authorize the connection. Your data is synced securely.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">What gets synced:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Customers and contacts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Invoices and balances
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Payments and credits
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Email addresses for outreach
                </li>
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleQuickBooksConnect}
                disabled={connecting}
                className="flex-1 bg-[#2CA01C] hover:bg-[#238615]"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect QuickBooks
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IntegrationSetupModal;
