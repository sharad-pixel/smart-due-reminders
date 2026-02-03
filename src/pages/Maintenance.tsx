import { Wrench, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import { COMPANY_INFO } from "@/lib/companyConfig";

const Maintenance = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header with Logo */}
      <header className="w-full py-6 px-6">
        <div className="max-w-lg mx-auto">
          <RecouplyLogo size="lg" animated />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Wrench className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-4">
              We're Improving the Platform
            </h1>
            <p className="text-muted-foreground text-lg mb-2">
              {COMPANY_INFO.displayName} is currently undergoing scheduled maintenance to bring you new features and improvements.
            </p>
            <p className="text-muted-foreground">
              We'll be back online shortly. Thank you for your patience!
            </p>
          </div>

          <div className="bg-card border rounded-lg p-6 mb-8">
            <h2 className="font-semibold mb-2">What to expect:</h2>
            <ul className="text-sm text-muted-foreground space-y-1 text-left">
              <li>• Enhanced performance and reliability</li>
              <li>• New features and improvements</li>
              <li>• Better user experience</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Need urgent assistance? Contact us at{" "}
              <a 
                href={`mailto:${COMPANY_INFO.emails.support}`}
                className="text-primary hover:underline"
              >
                {COMPANY_INFO.emails.support}
              </a>
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-6">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            {COMPANY_INFO.legal.copyright()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Maintenance;
