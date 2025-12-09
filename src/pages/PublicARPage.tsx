import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAppUrl } from "@/lib/appConfig";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertCircle,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import recouplyLogo from "@/assets/recouply-logo.png";

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

const CATEGORY_ICONS: Record<string, string> = {
  w9: "📋",
  ach_authorization: "🏦",
  wire_instructions: "💳",
  compliance: "✅",
  contract: "📝",
  insurance: "🛡️",
  other: "📄",
};

export default function PublicARPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ARPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const appUrl = getAppUrl();
    const isProduction = appUrl.includes('recouply.ai');
    
    const existingRobots = document.querySelector('meta[name="robots"]');
    if (existingRobots) {
      existingRobots.remove();
    }
    
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground font-medium">Loading AR Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-3">Page Not Available</h1>
            <p className="text-muted-foreground">
              {error || "This AR information page is not available or has been disabled."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { branding, documents } = data;
  const primaryColor = branding.primary_color || "#1e293b";
  const accentColor = branding.accent_color || "#3b82f6";

  const getDocumentUrl = (fileUrl: string) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Enterprise Header with Company Branding */}
      <header className="relative overflow-hidden">
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, ${primaryColor} 0%, transparent 50%), radial-gradient(circle at 80% 50%, ${accentColor} 0%, transparent 50%)`,
          }}
        />
        
        {/* Main Header Content */}
        <div 
          className="relative border-b-4"
          style={{ borderBottomColor: primaryColor }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Top Bar */}
            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>Secure AR Information Portal</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Updated: {branding.ar_page_last_updated_at 
                    ? format(new Date(branding.ar_page_last_updated_at), "MMM d, yyyy")
                    : "N/A"
                  }
                </span>
              </div>
            </div>
            
            {/* Company Branding */}
            <div className="py-8 sm:py-12">
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                {/* Company Logo */}
                <div className="flex-shrink-0">
                  {branding.logo_url ? (
                    <div className="relative">
                      <div 
                        className="absolute inset-0 rounded-2xl blur-xl opacity-20"
                        style={{ backgroundColor: primaryColor }}
                      />
                      <img 
                        src={branding.logo_url} 
                        alt={branding.business_name} 
                        className="relative h-20 sm:h-24 w-auto object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div 
                      className="h-20 sm:h-24 w-20 sm:w-24 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <Building2 className="h-10 sm:h-12 w-10 sm:w-12" style={{ color: primaryColor }} />
                    </div>
                  )}
                </div>
                
                {/* Company Info */}
                <div className="text-center sm:text-left">
                  <h1 
                    className="text-3xl sm:text-4xl font-bold tracking-tight"
                    style={{ color: primaryColor }}
                  >
                    {branding.business_name}
                  </h1>
                  <p className="mt-2 text-lg text-muted-foreground">
                    Accounts Receivable Information Portal
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified Business
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Secure Portal
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Options Card */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div 
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }}
              />
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: `${accentColor}15` }}
                  >
                    <CreditCard className="h-6 w-6" style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Payment Options</h2>
                    <p className="text-sm text-muted-foreground">Secure payment methods available</p>
                  </div>
                </div>
                
                {branding.supported_payment_methods && branding.supported_payment_methods.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Accepted Payment Methods</p>
                    <div className="flex flex-wrap gap-2">
                      {branding.supported_payment_methods.map((method: string) => (
                        <Badge 
                          key={method} 
                          variant="secondary"
                          className="px-4 py-2 text-sm font-medium"
                        >
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {branding.stripe_payment_link && (
                  <Button 
                    asChild
                    size="lg"
                    className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300"
                    style={{ 
                      backgroundColor: accentColor,
                      boxShadow: `0 4px 14px 0 ${accentColor}40`
                    }}
                  >
                    <a 
                      href={branding.stripe_payment_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      Make a Payment
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Documents Card */}
            {documents.length > 0 && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <div 
                  className="h-1.5"
                  style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }}
                />
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div 
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <FileText className="h-6 w-6" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Documents</h2>
                      <p className="text-sm text-muted-foreground">{documents.length} document{documents.length !== 1 ? 's' : ''} available</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {documents.map((doc) => {
                      const expired = isExpired(doc.expires_at);
                      return (
                        <div 
                          key={doc.id} 
                          className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-2xl">
                              {CATEGORY_ICONS[doc.category] || "📄"}
                            </div>
                            <div>
                              <p className="font-medium">
                                {CATEGORY_LABELS[doc.category] || doc.file_name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="truncate max-w-[200px]">{doc.file_name}</span>
                                {doc.status === "verified" && (
                                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                                {expired && (
                                  <Badge variant="destructive" className="text-xs">
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
                            className="opacity-70 group-hover:opacity-100 transition-opacity"
                          >
                            <a 
                              href={getDocumentUrl(doc.file_url)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              download
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Contact Information Card */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div 
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }}
              />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <User className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <h2 className="text-lg font-semibold">Contact Us</h2>
                </div>
                
                <div className="space-y-4">
                  {branding.ar_contact_email && (
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">AR Contact</p>
                      <a 
                        href={`mailto:${branding.ar_contact_email}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                        style={{ color: accentColor }}
                      >
                        <Mail className="h-4 w-4" />
                        {branding.ar_contact_email}
                      </a>
                    </div>
                  )}

                  {branding.escalation_contact_name && (
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Escalation Contact</p>
                      <p className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {branding.escalation_contact_name}
                      </p>
                      {branding.escalation_contact_email && (
                        <a 
                          href={`mailto:${branding.escalation_contact_email}`}
                          className="flex items-center gap-2 text-sm mt-2 hover:underline"
                          style={{ color: accentColor }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {branding.escalation_contact_email}
                        </a>
                      )}
                      {branding.escalation_contact_phone && (
                        <a 
                          href={`tel:${branding.escalation_contact_phone}`}
                          className="flex items-center gap-2 text-sm text-muted-foreground mt-1 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {branding.escalation_contact_phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            {branding.stripe_payment_link && (
              <Card className="shadow-lg border-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                    <h3 className="font-semibold">Quick Pay</h3>
                  </div>
                  <p className="text-sm text-slate-300 mb-4">
                    Pay your invoice instantly with our secure payment portal.
                  </p>
                  <Button 
                    asChild
                    variant="secondary"
                    className="w-full"
                  >
                    <a 
                      href={branding.stripe_payment_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Pay Now
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Enterprise Footer */}
      <footer className="mt-12 border-t bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {branding.footer_disclaimer && (
            <div className="mb-6 p-4 rounded-xl bg-white border text-sm text-muted-foreground">
              {branding.footer_disclaimer}
            </div>
          )}
          
          <Separator className="my-6" />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {branding.logo_url && (
                <img 
                  src={branding.logo_url} 
                  alt={branding.business_name} 
                  className="h-8 w-auto object-contain opacity-60"
                />
              )}
              <span className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} {branding.business_name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Powered by</span>
              <a 
                href="https://recouply.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <img 
                  src={recouplyLogo} 
                  alt="Recouply.ai" 
                  className="h-6 w-auto"
                />
                <span className="font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Recouply.ai
                </span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
