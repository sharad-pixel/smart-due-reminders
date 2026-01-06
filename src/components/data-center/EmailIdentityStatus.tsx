import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";

export function EmailIdentityStatus() {
  const { effectiveAccountId } = useEffectiveAccount();

  const { data: branding, isLoading } = useQuery({
    queryKey: ["branding-email-status", effectiveAccountId],
    queryFn: async () => {
      if (!effectiveAccountId) return null;

      const { data, error } = await supabase
        .from("branding_settings")
        .select("sending_mode, from_email_verified, verified_from_email, from_name, business_name")
        .eq("user_id", effectiveAccountId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveAccountId,
  });

  if (isLoading || !branding) return null;

  const sendingMode = branding.sending_mode || 'recouply_default';
  const isCustomerDomain = sendingMode === 'customer_domain';
  const isVerified = branding.from_email_verified === true;
  const displayName = branding.from_name || branding.business_name || 'Recouply.ai';

  // Determine what to show
  if (isCustomerDomain && !isVerified) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-yellow-800">
            <strong>Email Identity:</strong> Sending as Recouply.ai (your domain not yet verified)
          </span>
          <Link 
            to="/branding" 
            className="text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
          >
            Configure →
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (isCustomerDomain && isVerified) {
    return (
      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-green-50 border border-green-200">
        <div className="flex items-center gap-2 text-green-800">
          <Mail className="h-4 w-4" />
          <span className="text-sm">
            <strong>Email Identity:</strong> Sending as <span className="font-medium">{branding.verified_from_email}</span>
          </span>
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        </div>
        <Link 
          to="/branding" 
          className="text-sm text-green-700 hover:text-green-900"
        >
          Configure
        </Link>
      </div>
    );
  }

  // Default: recouply_default mode
  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Mail className="h-4 w-4" />
        <span className="text-sm">
          <strong>Email Identity:</strong> Sending as <span className="font-medium">{displayName}</span> via Recouply.ai
        </span>
      </div>
      <Link 
        to="/branding" 
        className="text-sm text-primary hover:underline"
      >
        Configure custom domain
      </Link>
    </div>
  );
}
