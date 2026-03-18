import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Lightbulb, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPageOnboardingContent } from '@/lib/onboardingContent';
import { useNicolasPreferences } from '@/hooks/useNicolasPreferences';
import { Link } from 'react-router-dom';
import nicolasAvatar from '@/assets/personas/nicolas.png';

export const NicolasPageTip = () => {
  const location = useLocation();
  const { preferences, isLoaded, dismissPageTip } = useNicolasPreferences();
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const content = getPageOnboardingContent(location.pathname);

  // Don't show if:
  // - Not loaded yet
  // - Assistant is disabled
  // - No content for this page
  // - User dismissed this page's tips
  if (
    !isLoaded ||
    !preferences.assistantEnabled ||
    !content ||
    preferences.dismissedPageTips.includes(location.pathname)
  ) {
    return null;
  }

  const handleDismiss = () => {
    dismissPageTip(location.pathname);
  };

  const nextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % content.tips.length);
  };

  const prevTip = () => {
    setCurrentTipIndex((prev) => (prev - 1 + content.tips.length) % content.tips.length);
  };

  if (isMinimized) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-24 right-6 z-40 shadow-lg bg-card border-primary/20 hover:border-primary/40"
        onClick={() => setIsMinimized(false)}
      >
        <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
        Tips
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-24 right-6 z-40 w-80 shadow-xl border-primary/20 animate-in slide-in-from-right-5">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <img 
              src={nicolasAvatar} 
              alt="Nicolas" 
              className="h-8 w-8 rounded-full object-cover"
            />
            <div>
              <Badge variant="secondary" className="text-xs">
                <Lightbulb className="h-3 w-3 mr-1" />
                {content.title}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(true)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Welcome message */}
        <p className="text-sm text-muted-foreground mb-3">
          {content.welcomeMessage}
        </p>

        {/* Current tip */}
        <div className="bg-muted/50 rounded-lg p-3 mb-3">
          <p className="text-sm font-medium">
            💡 {content.tips[currentTipIndex]}
          </p>
        </div>

        {/* Tip navigation */}
        {content.tips.length > 1 && (
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevTip}
              className="h-7 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Tip {currentTipIndex + 1} of {content.tips.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextTip}
              className="h-7 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Quick actions */}
        {content.quickActions && content.quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {content.quickActions.map((action) => (
              <Link key={action.path} to={action.path}>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        )}

        {/* Dismiss link */}
        <div className="mt-3 pt-2 border-t">
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Don't show tips for this page
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
