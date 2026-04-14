import { useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

interface PolicySection {
  title: string;
  bullets: string[];
}

interface TrustPolicyPageProps {
  title: string;
  metaDescription: string;
  canonicalPath: string;
  lastUpdated: string;
  intro: string;
  sections: PolicySection[];
}

const TrustPolicyPage = ({ title, metaDescription, canonicalPath, lastUpdated, intro, sections }: TrustPolicyPageProps) => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEOHead title={`${title} | Trust Center | Recouply.ai`} description={metaDescription} canonical={canonicalPath} />
      <div className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <button onClick={() => navigate("/trust")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-10 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trust Center
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide uppercase text-primary">Security Policy</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-3">{title}</h1>
          <p className="text-sm text-muted-foreground mb-4">Last updated: {lastUpdated}</p>
          <p className="text-muted-foreground leading-relaxed mb-12 border-l-2 border-primary/20 pl-4">{intro}</p>

          <div className="space-y-10">
            {sections.map((section, i) => (
              <div key={i}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  {section.title}
                </h2>
                <ul className="space-y-2.5 ml-8">
                  {section.bullets.map((bullet, j) => (
                    <li key={j} className="text-sm text-muted-foreground leading-relaxed relative pl-4 before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary/30">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 p-8 rounded-xl border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-1">Need this for a security review?</p>
              <p className="text-xs text-muted-foreground">We can provide this and more as part of your vendor diligence process.</p>
            </div>
            <Button onClick={() => navigate("/trust/security-review-resources")} className="shrink-0">
              Request Security Pack <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default TrustPolicyPage;
