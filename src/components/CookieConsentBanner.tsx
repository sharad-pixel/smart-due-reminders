import { Button } from '@/components/ui/button';
import { Cookie, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CookieConsentBannerProps {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onManagePreferences: () => void;
}

export function CookieConsentBanner({ 
  onAcceptAll, 
  onRejectAll, 
  onManagePreferences 
}: CookieConsentBannerProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t border-border shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">We value your privacy</h3>
              <p className="text-sm text-muted-foreground">
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                By clicking "Accept All", you consent to our use of cookies. Read our{' '}
                <Link to="/legal/cookies" className="text-primary hover:underline">
                  Cookie Policy
                </Link>{' '}
                for more information.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onManagePreferences}
              className="gap-1.5"
            >
              <Settings className="h-4 w-4" />
              Manage
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRejectAll}
            >
              Reject All
            </Button>
            <Button
              size="sm"
              onClick={onAcceptAll}
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
