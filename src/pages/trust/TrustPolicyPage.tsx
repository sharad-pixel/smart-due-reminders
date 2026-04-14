import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

interface PolicySection {
  title: string;
  content: string[];
}

interface TrustPolicyPageProps {
  title: string;
  metaDescription: string;
  canonicalPath: string;
  lastUpdated: string;
  sections: PolicySection[];
}

const TrustPolicyPage = ({ title, metaDescription, canonicalPath, lastUpdated, sections }: TrustPolicyPageProps) => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEOHead title={`${title} | Trust Center | Recouply.ai`} description={metaDescription} canonical={canonicalPath} />
      <div className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <button onClick={() => navigate("/trust")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Trust Center
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Security Policy</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {lastUpdated}</p>

          <div className="space-y-10">
            {sections.map((section, i) => (
              <div key={i}>
                <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
                <div className="space-y-3">
                  {section.content.map((paragraph, j) => (
                    <p key={j} className="text-sm text-muted-foreground leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 p-6 rounded-xl border bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground mb-4">Need additional details for your security review?</p>
            <Button onClick={() => navigate("/trust/security-review-resources")}>
              Request Security Information <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default TrustPolicyPage;
