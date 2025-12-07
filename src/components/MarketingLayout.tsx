import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import RecouplyLogo from "@/components/RecouplyLogo";
import NicolasChat from "@/components/NicolasChat";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

const MarketingLayout = ({ children }: MarketingLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full container mx-auto px-6 flex items-center justify-between">
          <RecouplyLogo variant="header" />
          <nav className="hidden lg:flex items-center gap-5">
            <button 
              onClick={() => navigate("/home")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Home
            </button>
            <button 
              onClick={() => navigate("/features")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Features
            </button>
            <button 
              onClick={() => navigate("/pricing")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Pricing
            </button>
            <div className="relative group">
              <button className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                Solutions
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute top-full left-0 mt-2 w-48 bg-card border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button onClick={() => navigate("/startups")} className="w-full text-left px-4 py-2 hover:bg-muted text-sm">Startups</button>
                <button onClick={() => navigate("/smb")} className="w-full text-left px-4 py-2 hover:bg-muted text-sm">SMB</button>
                <button onClick={() => navigate("/enterprise")} className="w-full text-left px-4 py-2 hover:bg-muted text-sm">Enterprise</button>
              </div>
            </div>
            <button 
              onClick={() => navigate("/personas")}
              className="text-foreground hover:text-primary transition-colors"
            >
              AI Agents
            </button>
            <button 
              onClick={() => navigate("/about")}
              className="text-foreground hover:text-primary transition-colors"
            >
              About
            </button>
            <Button onClick={() => navigate("/login")} variant="ghost">
              Login
            </Button>
            <Button onClick={() => navigate("/signup")}>
              Try Recouply.ai
            </Button>
          </nav>
          <div className="lg:hidden">
            <Button onClick={() => navigate("/login")} size="sm">Sign In</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-8 px-4 bg-card mt-auto">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <RecouplyLogo variant="footer" className="mb-4" />
              <p className="text-sm text-muted-foreground">
                AI-powered AR & Collections software. Not a collection agency.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={() => navigate("/features")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/solutions")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Solutions
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/pricing")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={() => navigate("/about")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/legal/terms")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/legal/privacy")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/security-public")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Security
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Get Started</h4>
              <Button 
                onClick={() => navigate("/signup")}
                className="w-full"
              >
                Start Free Trial
              </Button>
            </div>
          </div>
          <div className="text-center pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              &copy; 2024 Recouply.ai. Not a collection agency - Software as a Service.
            </p>
          </div>
        </div>
      </footer>
      <NicolasChat />
    </div>
  );
};

export default MarketingLayout;
