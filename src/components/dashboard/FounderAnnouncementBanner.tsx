import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Megaphone, Sparkles } from "lucide-react";
import { founderAnnouncements, FounderMessage } from "@/lib/founderMessaging";
import { founderConfig } from "@/lib/founderConfig";

const DISMISSED_KEY = "recouply_dismissed_announcements";

export const FounderAnnouncementBanner = () => {
  const [currentAnnouncement, setCurrentAnnouncement] = useState<FounderMessage | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedIds = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    const available = founderAnnouncements.filter((a) => !dismissedIds.includes(a.id));
    if (available.length > 0) {
      // Show the latest/first available announcement
      setCurrentAnnouncement(available[0]);
    }
  }, []);

  const handleDismiss = () => {
    if (currentAnnouncement) {
      const dismissedIds = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
      dismissedIds.push(currentAnnouncement.id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds));
    }
    setDismissed(true);
  };

  if (dismissed || !currentAnnouncement) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent overflow-hidden relative">
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">
                {currentAnnouncement.title}
              </span>
              <span className="text-xs text-muted-foreground">
                — {founderConfig.name}, {founderConfig.title}
              </span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed line-clamp-3">
              {currentAnnouncement.body.split("\n").slice(0, 3).join("\n")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-7 w-7"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
