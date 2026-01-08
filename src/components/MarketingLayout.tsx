import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import NicolasChat from "@/components/NicolasChat";
import LanguageSelector from "@/components/LanguageSelector";
import { Brain, Bot, BarChart3, Zap, Building2, Rocket, Users, ChevronDown, Menu, X, Linkedin } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

// Company Information
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  emails: {
    collections: "collections@recouply.ai",
    support: "support@recouply.ai",
    notifications: "notifications@recouply.ai",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/recouplyai-inc",
  },
} as const;

const NavDropdown = ({ 
  label, 
  items, 
  navigate 
}: { 
  label: string; 
  items: { icon: React.ElementType; title: string; description: string; path: string }[];
  navigate: (path: string) => void;
}) => {
  return (
    <div className="relative group">
      <button className="text-foreground hover:text-primary transition-colors flex items-center gap-1 py-2">
        {label}
        <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
      </button>
      <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="p-2">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full text-left px-3 py-3 hover:bg-muted rounded-lg transition-colors flex items-start gap-3 group/item"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover/item:bg-primary group-hover/item:text-primary-foreground transition-colors">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const MarketingLayout = ({ children }: MarketingLayoutProps) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const platformItems = [
    { icon: Brain, title: t('nav.collectionIntelligence'), description: t('marketing.aiInsights'), path: "/collection-intelligence" },
    { icon: Bot, title: t('nav.aiAgents'), description: t('marketing.autonomousPersonas'), path: "/personas" },
    { icon: Zap, title: t('nav.automation'), description: t('marketing.workflowAutomation'), path: "/features" },
    { icon: BarChart3, title: t('nav.analytics'), description: t('marketing.realtimeDashboards'), path: "/features#analytics" },
  ];

  const solutionsItems = [
    { icon: Rocket, title: t('nav.startups'), description: t('marketing.scaleFromDayOne'), path: "/startups" },
    { icon: Users, title: t('nav.smb'), description: t('marketing.rightSizedTeams'), path: "/smb" },
    { icon: Building2, title: t('nav.enterprise'), description: t('marketing.fullScaleDeployment'), path: "/enterprise" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div 
            className="cursor-pointer"
            onClick={() => navigate("/")}
          >
            <RecouplyLogo size="lg" />
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            <NavDropdown label={t('nav.platform')} items={platformItems} navigate={navigate} />
            <NavDropdown label={t('nav.solutions')} items={solutionsItems} navigate={navigate} />
            <button 
              onClick={() => navigate("/integrations")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              {t('nav.integrations')}
            </button>
            <button 
              onClick={() => navigate("/pricing")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              {t('nav.pricing')}
            </button>
            <button 
              onClick={() => navigate("/about")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              {t('nav.about')}
            </button>
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <Button onClick={() => navigate("/login")} variant="ghost" size="sm">
                {t('common.login')}
              </Button>
              <Button onClick={() => navigate("/signup")} size="sm">
                {t('common.getStarted')}
              </Button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <Button onClick={() => navigate("/login")} variant="ghost" size="sm">
              {t('common.login')}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-card">
            <div className="container mx-auto px-4 py-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('nav.platform')}</div>
                {platformItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-3"
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm">{item.title}</span>
                  </button>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('nav.solutions')}</div>
                {solutionsItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center gap-3"
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm">{item.title}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t">
                <button onClick={() => { navigate("/integrations"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">{t('nav.integrations')}</button>
                <button onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">{t('nav.pricing')}</button>
                <button onClick={() => { navigate("/about"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">{t('nav.about')}</button>
                <Button onClick={() => { navigate("/signup"); setMobileMenuOpen(false); }} className="w-full mt-2">
                  {t('common.getStarted')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-12 px-4 bg-card mt-auto">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <RecouplyLogo size="lg" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {t('footer.tagline')}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {t('footer.notAgency')}
              </p>
              <a 
                href={COMPANY_INFO.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="h-5 w-5" />
                <span className="text-sm">{t('footer.followUs')}</span>
              </a>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('nav.platform')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={() => navigate("/collection-intelligence")}
                    className="text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Brain className="h-3 w-3" />
                    {t('nav.collectionIntelligence')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/personas")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('nav.aiAgents')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/features")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.features')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/pricing")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('nav.pricing')}
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('footer.company')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={() => navigate("/about")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.about')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/investors")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.investors')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/legal/terms")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.terms')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/legal/privacy")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.privacy')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/security-public")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.security')}
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('footer.contact')}</h4>
              <ul className="space-y-2 text-sm mb-4">
                <li>
                  <button 
                    onClick={() => navigate("/contact")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.contact')}
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/contact?intent=demo")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {t('footer.requestDemo')}
                  </button>
                </li>
              </ul>
              <Button 
                onClick={() => navigate("/signup")}
                className="w-full"
              >
                {t('common.startFreeTrial')}
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {COMPANY_INFO.legalName} {t('footer.allRightsReserved')}
            </p>
            <LanguageSelector />
          </div>
        </div>
      </footer>
      <NicolasChat />
    </div>
  );
};

export default MarketingLayout;
