import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";
import { Linkedin, ShieldCheck } from "lucide-react";
import { COMPANY_INFO } from "@/lib/companyConfig";

type Col = { title: string; links: { label: string; path: string; external?: boolean }[] };

const columns: Col[] = [
  {
    title: "Product",
    links: [
      { label: "Contract Intelligence", path: "/contract-intelligence" },
      { label: "Collection Intelligence", path: "/collection-intelligence" },
      { label: "Executive Insights", path: "/revenue-intelligence" },
      { label: "AI Agents", path: "/personas" },
      { label: "Automation", path: "/automation" },
      { label: "Analytics", path: "/analytics" },
      { label: "Integrations", path: "/integrations" },
      { label: "Pricing", path: "/pricing" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Solo Pro", path: "/solutions/solo-pro" },
      { label: "Startups", path: "/startups" },
      { label: "SMB", path: "/smb" },
      { label: "Enterprise", path: "/enterprise" },
      { label: "Professional Services", path: "/solutions/professional-services" },
      { label: "SaaS", path: "/solutions/saas" },
      { label: "Small Businesses", path: "/solutions/small-businesses" },
    ],
  },
  {
    title: "Customers",
    links: [
      { label: "Customer Stories", path: "/blog" },
      { label: "Collections ROI Calculator", path: "/roi-calculator" },
      { label: "Contract Intelligence ROI", path: "/contract-roi-calculator" },
      { label: "Payment Portal", path: "/debtor-portal" },
      { label: "Request a Demo", path: "/contact?intent=demo" },
      { label: "Contact Sales", path: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", path: "/about" },
      { label: "Blog", path: "/blog" },
      { label: "Careers", path: "/careers" },
      { label: "Investors", path: "/investors" },
      { label: "Design Partners", path: "/design-partners" },
      { label: "Trust Center", path: "/trust" },
      { label: "Security", path: "/security-public" },
      { label: "Knowledge Base", path: "/knowledge-base" },
    ],
  },
];

const MarketingFooter = () => {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/60 bg-card mt-auto">
      <div className="container mx-auto px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_3fr]">
          {/* Brand block */}
          <div>
            <RecouplyLogo size="lg" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Revenue Intelligence — from contract to cash. AI-native Contract Intelligence and Collection Intelligence in one system of record.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={() => navigate("/contact?intent=demo")}
                variant="outline"
                size="sm"
                className="w-fit border-border/70"
              >
                Book a Demo
              </Button>
              <a
                href={COMPANY_INFO.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Linkedin className="h-4 w-4" />
                Follow on LinkedIn
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-[0.14em] mb-4">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.path}>
                      <button
                        onClick={() => navigate(link.path)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {COMPANY_INFO.legalName} All rights reserved.
          </p>

          <div className="flex items-center gap-5">
            <nav aria-label="Legal" className="flex items-center gap-4 text-xs">
              <Link to="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/legal/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                Cookies
              </Link>
              <Link to="/support/login" className="text-muted-foreground hover:text-foreground transition-colors">
                Support
              </Link>
            </nav>

            <Link
              to="/security-public#responsible-ai"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/70 hover:border-foreground/40 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-foreground/70" />
              <span className="text-xs font-medium text-foreground/80">Responsible AI</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
