import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Shield, Zap, Info } from "lucide-react";

const BringYourOwnEmail = () => {
  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Email Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Recouply.ai handles all email sending and receiving through our secure platform infrastructure
          </p>
        </div>

        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>No email setup required!</strong> Recouply.ai sends and receives emails through its own 
            secure infrastructure. Your collection emails are ready to send immediately.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Platform Email Infrastructure</CardTitle>
            </div>
            <CardDescription>
              All emails are sent and received through Recouply.ai's verified email system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Outbound
                  </Badge>
                </div>
                <p className="font-medium">Sending Address</p>
                <p className="text-sm text-muted-foreground font-mono">
                  notifications@send.inbound.services.recouply.ai
                </p>
                <p className="text-sm text-muted-foreground">
                  All collection emails are sent from this verified Recouply.ai address
                </p>
              </div>

              <div className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Inbound
                  </Badge>
                </div>
                <p className="font-medium">Reply Handling</p>
                <p className="text-sm text-muted-foreground font-mono">
                  invoice+[id]@inbound.services.recouply.ai
                </p>
                <p className="text-sm text-muted-foreground">
                  Debtor replies are automatically captured and linked to invoices
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Security & Deliverability</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">SPF Verified</p>
                  <p className="text-sm text-muted-foreground">
                    Sender Policy Framework configured
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">DKIM Signed</p>
                  <p className="text-sm text-muted-foreground">
                    All emails are cryptographically signed
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">DMARC Compliant</p>
                  <p className="text-sm text-muted-foreground">
                    Domain authentication enabled
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>How It Works</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Send Collection Emails</p>
                  <p className="text-sm text-muted-foreground">
                    When you send a collection message, it goes out from our verified Recouply.ai address with proper authentication.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Automatic Reply Routing</p>
                  <p className="text-sm text-muted-foreground">
                    Each email includes a unique reply-to address that links responses back to the specific invoice or debtor.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">AI-Powered Processing</p>
                  <p className="text-sm text-muted-foreground">
                    Incoming replies are analyzed by AI to extract action items like payment promises, disputes, or W9 requests.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Want to use your own domain?</strong> Enterprise customers can configure custom sending domains. 
            Contact support@recouply.ai to learn more.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default BringYourOwnEmail;
