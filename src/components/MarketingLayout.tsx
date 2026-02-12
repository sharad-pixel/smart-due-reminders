import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import NicolasChat from "@/components/NicolasChat";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Brain, Bot, BarChart3, Zap, Building2, Rocket, Users, ChevronDown, Menu, X, Linkedin, ShieldCheck, User, CreditCard } from "lucide-react";
import { useState } from "react";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

// Company Information
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Collection Intelligence Platform",
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

  const platformItems = [
    { icon: Brain, title: "Collection Intelligence", description: "AI-powered insights & predictions", path: "/collection-intelligence" },
    { icon: Bot, title: "AI Agents", description: "Autonomous collection personas", path: "/personas" },
    { icon: Zap, title: "Automation", description: "Workflow & outreach automation", path: "/features" },
    { icon: BarChart3, title: "Analytics", description: "Real-time AR dashboards", path: "/features#analytics" },
  ];

  const solutionsItems = [
    { icon: User, title: "Solo Pro", description: "Full power for independents", path: "/solutions/solo-pro" },
    { icon: Rocket, title: "Startups", description: "Scale collections from day one", path: "/startups" },
    { icon: Users, title: "SMB", description: "Right-sized for growing teams", path: "/smb" },
    { icon: Building2, title: "Enterprise", description: "Full-scale deployment", path: "/enterprise" },
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
            <NavDropdown label="Platform" items={platformItems} navigate={navigate} />
            <NavDropdown label="Solutions" items={solutionsItems} navigate={navigate} />
            <button 
              onClick={() => navigate("/integrations")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              Integrations
            </button>
            <button 
              onClick={() => navigate("/pricing")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              Pricing
            </button>
            <button 
              onClick={() => navigate("/about")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              About
            </button>
            <button 
              onClick={() => navigate("/blog")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              Blog
            </button>
            <button 
              onClick={() => navigate("/debtor-portal")}
              className="text-foreground hover:text-primary transition-colors py-2"
            >
              Payment Portal
            </button>
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <Button onClick={() => navigate("/login")} variant="ghost" size="sm">
                Sign In
              </Button>
              <Button onClick={() => navigate("/signup")} size="sm">
                Get Started
              </Button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <Button onClick={() => navigate("/login")} variant="ghost" size="sm">
              Sign In
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
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Platform</div>
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
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Solutions</div>
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
                <button onClick={() => { navigate("/integrations"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">Integrations</button>
                <button onClick={() => { navigate("/pricing"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">Pricing</button>
                <button onClick={() => { navigate("/about"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">About</button>
                <button onClick={() => { navigate("/blog"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm">Blog</button>
                <button onClick={() => { navigate("/debtor-portal"); setMobileMenuOpen(false); }} className="text-left py-2 text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Payment Portal
                </button>
                <Button onClick={() => { navigate("/signup"); setMobileMenuOpen(false); }} className="w-full mt-2">
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <MarketingFooter />
      <NicolasChat />
    </div>
  );
};

export default MarketingLayout;
