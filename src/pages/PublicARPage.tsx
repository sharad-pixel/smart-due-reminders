import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAppUrl } from "@/lib/appConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Download, 
  Mail, 
  Phone, 
  User, 
  CreditCard, 
  Building2,
  Shield,
  Clock,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface ARPageData {
  branding: {
    id: string;
    business_name: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    ar_contact_email: string | null;
    escalation_contact_name: string | null;
    escalation_contact_email: string | null;
    escalation_contact_phone: string | null;
    supported_payment_methods: string[];
    stripe_payment_link: string | null;
    footer_disclaimer: string | null;
    ar_page_last_updated_at: string | null;
  };
  documents: Array<{
    id: string;
    file_name: string;
    file_url: string;
    category: string;
    status: string;
    expires_at: string | null;
    updated_at: string;
  }>;
  error?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  w9: "W-9 Form",
  ach_authorization: "ACH Authorization",
  wire_instructions: "Wire Instructions",
  compliance: "Compliance Document",
  contract: "Contract",
  insurance: "Insurance Certificate",
  other: "Other Document",
};

export default function PublicARPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ARPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set meta robots tag based on environment
  useEffect(() => {
    const appUrl = getAppUrl();
    const isProduction = appUrl.includes('recouply.ai');
    
    // Remove any existing robots meta tag
    const existingRobots = document.querySelector('meta[name="robots"]');
    if (existingRobots) {
      existingRobots.remove();
    }
    
    // Add robots meta tag - index only on production
    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = isProduction ? 'index, follow' : 'noindex, nofollow';
    document.head.appendChild(robotsMeta);
    
    return () => {
      robotsMeta.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError("Invalid page link");
        setLoading(false);
        return;
      }

      try {
        // Call the database function to get public AR page data
        const { data: result, error: fetchError } = await supabase
          .rpc("get_public_ar_page", { p_token: token });

        if (fetchError) {
          console.error("Error fetching AR page:", fetchError);
          setError("Unable to load page");
          setLoading(false);
          return;
        }

        const resultData = result as unknown as ARPageData;

        if (resultData?.error) {
          setError(resultData.error);
          setLoading(false);
          return;
        }

        setData(resultData);

        // Log access (fire and forget)
        if (resultData?.branding?.id) {
          supabase
            .from("ar_page_access_logs")
            .insert({
              branding_settings_id: resultData.branding.id,
              user_agent: navigator.userAgent,
            })
            .then(() => {});
        }
      } catch (err) {
        console.error("Error:", err);
        setError("An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Page Not Available</h1>
            <p className="text-muted-foreground">
              {error || "This AR information page is not available or has been disabled."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { branding, documents } = data;
  const primaryColor = branding.primary_color || "#000000";
  const accentColor = branding.accent_color || "#6366f1";

  const getDocumentUrl = (fileUrl: string) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header 
        className="border-b bg-card"
        style={{ borderBottomColor: primaryColor }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {branding.logo_url ? (
              <img 
                src={branding.logo_url} 
                alt={branding.business_name} 
                className="h-12 w-auto object-contain"
              />
            ) : (
              <Building2 className="h-12 w-12 text-muted-foreground" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{branding.business_name}</h1>
              <p className="text-sm text-muted-foreground">
                Accounts Receivable Information Portal
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Contact Information */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {branding.ar_contact_email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">AR Contact</p>
                      <a 
                        href={`mailto:${branding.ar_contact_email}`}
                        className="font-medium hover:underline"
                        style={{ color: accentColor }}
                      >
                        {branding.ar_contact_email}
                      </a>
                    </div>
                  </div>
                )}

                {branding.escalation_contact_name && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Escalation Contact</p>
                      <p className="font-medium">{branding.escalation_contact_name}</p>
                      {branding.escalation_contact_email && (
                        <a 
                          href={`mailto:${branding.escalation_contact_email}`}
                          className="text-sm hover:underline"
                          style={{ color: accentColor }}
                        >
                          {branding.escalation_contact_email}
                        </a>
                      )}
                      {branding.escalation_contact_phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {branding.escalation_contact_phone}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Payment Methods */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {branding.supported_payment_methods && branding.supported_payment_methods.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Accepted Payment Methods</p>
                  <div className="flex flex-wrap gap-2">
                    {branding.supported_payment_methods.map((method: string) => (
                      <Badge key={method} variant="secondary">
                        {method}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {branding.stripe_payment_link && (
                <div className="pt-2">
                  <Button 
                    asChild
                    className="w-full sm:w-auto"
                    style={{ backgroundColor: accentColor }}
                  >
                    <a 
                      href={branding.stripe_payment_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Make a Payment
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Documents */}
        {documents.length > 0 && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {documents.map((doc) => {
                    const expired = isExpired(doc.expires_at);
                    return (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {CATEGORY_LABELS[doc.category] || doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{doc.file_name}</span>
                              {doc.status === "verified" && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                              {expired && (
                                <Badge variant="destructive">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Expired
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          disabled={expired}
                        >
                          <a 
                            href={getDocumentUrl(doc.file_url)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            download
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground space-y-2">
            {branding.footer_disclaimer && (
              <p>{branding.footer_disclaimer}</p>
            )}
            <Separator className="my-4" />
            <div className="flex items-center justify-center gap-2">
              <p>
                Last updated: {branding.ar_page_last_updated_at 
                  ? format(new Date(branding.ar_page_last_updated_at), "MMM d, yyyy")
                  : "N/A"
                }
              </p>
            </div>
            <p className="text-xs">
              Powered by <span className="font-semibold">Recouply.ai</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}