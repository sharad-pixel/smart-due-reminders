import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

const MarketingLayout = ({ children }: MarketingLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 
            className="text-2xl font-bold text-primary cursor-pointer"
            onClick={() => navigate("/")}
          >
            Recouply.ai
          </h1>
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => navigate("/features")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Features
            </button>
            <button 
              onClick={() => navigate("/solutions")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Solutions
            </button>
            <button 
              onClick={() => navigate("/pricing")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Pricing
            </button>
            <Button onClick={() => navigate("/login")} variant="ghost">
              Sign In
            </Button>
            <Button onClick={() => navigate("/signup")}>
              Start Free Trial
            </Button>
          </nav>
          <div className="md:hidden">
            <Button onClick={() => navigate("/login")}>Sign In</Button>
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
              <h3 className="font-bold text-lg mb-4">Recouply.ai</h3>
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
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
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
    </div>
  );
};

export default MarketingLayout;
