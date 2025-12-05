import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Bell, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLatestDigest } from '@/hooks/useDailyDigest';

export const DigestNotificationBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const { data: latestDigest, isLoading } = useLatestDigest();

  const today = new Date().toISOString().split('T')[0];
  const hasNewDigest = latestDigest?.digest_date === today;

  // Check if already dismissed today
  useEffect(() => {
    const dismissedDate = localStorage.getItem('digest-banner-dismissed');
    if (dismissedDate === today) {
      setDismissed(true);
    }
  }, [today]);

  const handleDismiss = () => {
    localStorage.setItem('digest-banner-dismissed', today);
    setDismissed(true);
  };

  if (isLoading || dismissed || !hasNewDigest) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-foreground">
            Your daily collections health summary is ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/daily-digest">
              View Digest
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
