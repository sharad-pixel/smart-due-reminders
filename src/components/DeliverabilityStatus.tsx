import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DeliverabilityStatusProps {
  profile: {
    id: string;
    spf_validated: boolean;
    dkim_validated: boolean;
    dmarc_validated: boolean;
    bounce_rate: number;
    spam_complaint_rate: number;
    domain_reputation: string;
    verification_status: string;
  };
  onRefresh: () => void;
}

export const DeliverabilityStatus = ({ profile, onRefresh }: DeliverabilityStatusProps) => {
  const getStatusIcon = (validated: boolean) => {
    return validated ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getReputationBadge = (reputation: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      good: "default",
      average: "secondary",
      poor: "destructive",
      unknown: "secondary",
    };

    const labels: Record<string, string> = {
      good: "Good",
      average: "Average",
      poor: "Poor",
      unknown: "Unknown",
    };

    return (
      <Badge variant={variants[reputation] || "secondary"}>
        {labels[reputation] || reputation}
      </Badge>
    );
  };

  const handleReverify = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-dns-records", {
        body: { profileId: profile.id },
      });

      if (error) throw error;

      if (data.allVerified) {
        toast.success("All DNS records verified successfully!");
      } else {
        toast.warning("Some DNS records are not yet verified. Please check your DNS configuration.");
      }
      
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to reverify DNS records");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Deliverability Status</CardTitle>
            <CardDescription>
              Monitor your email authentication and domain reputation
            </CardDescription>
          </div>
          <Button onClick={handleReverify} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-verify
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="text-sm font-medium">SPF</div>
              <div className="text-xs text-muted-foreground">Sender Policy Framework</div>
            </div>
            {getStatusIcon(profile.spf_validated)}
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="text-sm font-medium">DKIM</div>
              <div className="text-xs text-muted-foreground">DomainKeys Identified Mail</div>
            </div>
            {getStatusIcon(profile.dkim_validated)}
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <div className="text-sm font-medium">DMARC</div>
              <div className="text-xs text-muted-foreground">Domain-based Authentication</div>
            </div>
            {getStatusIcon(profile.dmarc_validated)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-1">Bounce Rate</div>
            <div className="text-2xl font-bold">
              {profile.bounce_rate.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.bounce_rate < 2 ? "Excellent" : profile.bounce_rate < 5 ? "Good" : "Needs Attention"}
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-1">Spam Complaints</div>
            <div className="text-2xl font-bold">
              {profile.spam_complaint_rate.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.spam_complaint_rate < 0.1 ? "Excellent" : profile.spam_complaint_rate < 0.3 ? "Good" : "Needs Attention"}
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-1">Domain Reputation</div>
            <div className="mt-2">
              {getReputationBadge(profile.domain_reputation)}
            </div>
          </div>
        </div>

        {(!profile.spf_validated || !profile.dkim_validated || !profile.dmarc_validated) && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-yellow-600">Action Required</div>
              <div className="text-yellow-700 dark:text-yellow-300">
                Some DNS records are not verified. Please check your DNS configuration and click Re-verify.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
